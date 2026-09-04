/**
 * Kompresi image di browser sebelum dikirim sebagai base64 - docs/plan/
 * admin-content-upload-base64/PLAN.md §3.3 (keputusan K6), docs/plan/
 * admin-content-image-format-pipeline/PLAN.md (keputusan D1-D4), dan docs/plan/
 * admin-content-png-lossless-galeri-tajam/PLAN.md (keputusan K1/K2/D1-D3).
 * Tanpa dependency baru, hanya canvas & createImageBitmap bawaan browser.
 *
 * Output ditentukan PER-FIELD lewat parameter `format` (lossy | lossless | jpeg),
 * bukan ditebak dari isi gambar. PNG/JPEG pada format "lossy" dikonversi ke
 * WebP lewat canvas (fallback JPEG + latar putih bila browser tak punya
 * encoder WebP). Pada format "lossless" selalu keluar PNG TANPA flatten latar
 * apa pun - field yang memang butuh transparansi (mis. Logo) harus memakai
 * ini, bukan "lossy", supaya tidak jatuh ke fallback JPEG yang membakar alpha
 * jadi putih. GIF/WebP diteruskan APA ADANYA (passthrough) pada KEDUA format -
 * GIF lewat canvas hanya mengambil frame pertama, membunuh animasi (regresi
 * T2), dan WebP yang sudah WebP tidak perlu rugi generasi.
 */

export class ImageCompressError extends Error {}

const MAX_SOURCE_BYTES = 25 * 1024 * 1024 // 25 MB - batas berkas SUMBER sebelum dikompres
const MAX_DECODED_BYTES = 5 * 1024 * 1024 // 5 MB - harus sama dengan maxImageDecodedSize di BE (K4/D4)

const CONVERT_TYPES: readonly string[] = ['image/png', 'image/jpeg']
const PASSTHROUGH_TYPES: readonly string[] = ['image/gif', 'image/webp']
const ACCEPTED_TYPES: readonly string[] = [...CONVERT_TYPES, ...PASSTHROUGH_TYPES]

const EXT_BY_MIME: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
}

// Reverse dari EXT_BY_MIME (plus alias .jpeg) - dipakai effectiveSourceType saat
// file.type kosong/tidak dikenal, sebagian kombinasi OS/browser tidak mengisinya.
const MIME_BY_EXT: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
}

export interface CompressedImage {
  base64: string
  filename: string
  /** Apakah berkas SUMBER punya area transparan. Hanya diisi di jalur
   * KONVERSI (PNG/JPEG); pada jalur passthrough GIF/WebP tetap `undefined`
   * karena jalur itu sengaja tidak menyentuh kanvas sama sekali. `undefined`
   * berarti "tidak diketahui", BUKAN "tidak transparan". */
  hasAlpha?: boolean
}

interface EncodedImage {
  base64: string
  ext: string
}

/** "lossy": dikonversi ke WebP (fallback JPEG+latar putih) - dipakai field
 * foto. "lossless": selalu PNG tanpa flatten latar - WAJIB untuk field yang
 * butuh transparansi (docs/plan/admin-content-png-lossless-galeri-tajam/PLAN.md
 * K1). "jpeg": SELALU JPEG apa pun dukungan WebP browser - dipakai field
 * Gambar Preview Link, karena crawler WhatsApp tidak merender WebP dan PNG
 * fotografis 1200x630 bisa 1-2,5 MB sehingga preview berisiko diam-diam tidak
 * muncul (docs/plan/og-share-image-dinamis/PLAN.md K3). Bukan heuristik dari
 * isi gambar - field pemanggil yang menentukan. */
export type ImageOutputFormat = 'lossy' | 'lossless' | 'jpeg'

export interface EncodeTarget {
  mime: string
  quality: number | undefined
  background: string | undefined
}

export interface RetryPlan {
  maxDim: number
  quality: number
}

/** Menghitung ukuran target dengan sisi terpanjang dibatasi maxDim, menjaga rasio aspek,
 * dan TIDAK memperbesar gambar yang sisi terpanjangnya sudah <= maxDim. */
export function computeTargetSize(width: number, height: number, maxDim: number): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxDim) return { width, height }
  const scale = maxDim / longest
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Membuang prefix "data:<mime>;base64," dari sebuah data URL. String yang bukan data URL
 * dikembalikan apa adanya. */
export function stripDataUrlPrefix(dataUrl: string): string {
  const idx = dataUrl.indexOf(',')
  return dataUrl.startsWith('data:') && idx !== -1 ? dataUrl.slice(idx + 1) : dataUrl
}

/** Menghitung panjang byte hasil decode sebuah string base64 (bukan panjang string-nya),
 * termasuk memperhitungkan padding "=" / "==". */
export function base64ByteLength(base64: string): number {
  const clean = base64.replace(/\s/g, '')
  if (clean.length === 0) return 0
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return (clean.length / 4) * 3 - padding
}

/** Menentukan tipe efektif berkas sumber dari file.type, jatuh ke ekstensi nama
 * berkas bila file.type kosong/tidak dikenal. Mengembalikan null bila berkas
 * bukan salah satu dari PNG/JPEG/GIF/WebP (docs/plan/admin-content-image-format-pipeline/PLAN.md §3.1). */
export function effectiveSourceType(file: File): string | null {
  if (ACCEPTED_TYPES.includes(file.type)) return file.type

  const dot = file.name.lastIndexOf('.')
  const ext = dot === -1 ? '' : file.name.slice(dot).toLowerCase()
  return MIME_BY_EXT[ext] ?? null
}

/** Memetakan MIME hasil encode (blob.type SEBENARNYA, bukan tipe yang diminta -
 * memperbaiki T1) ke ekstensi nama berkas. Null bila MIME tidak dikenal. */
export function extFromMimeType(mime: string): string | null {
  return EXT_BY_MIME[mime] ?? null
}

/** Kualitas WebP per tipe sumber (D3): PNG dianggap grafis/logo (garis & teks
 * tajam) sehingga quality lebih tinggi; JPEG dianggap foto. GIF/WebP tidak
 * lewat sini sama sekali (passthrough). */
export function qualityForSourceType(mime: string): number {
  return mime === 'image/png' ? 0.92 : 0.82
}

/** Memutuskan mime/quality/background hasil encode dari format field pemanggil
 * dan ketersediaan encoder WebP. "lossless" TIDAK PERNAH mengembalikan
 * background - PNG mendukung alpha, jadi tidak ada alasan flatten dan tidak
 * ada jalur fallback yang bisa membakar transparansi jadi putih (beda dari
 * "lossy" tanpa encoder WebP, yang jatuh ke JPEG+putih karena JPEG memang
 * tidak mendukung alpha). */
export function encodeTargetFor(format: ImageOutputFormat, canWebp: boolean, quality: number): EncodeTarget {
  if (format === 'lossless') {
    return { mime: 'image/png', quality: undefined, background: undefined }
  }
  // "jpeg" SENGAJA mengabaikan canWebp: keandalan preview WhatsApp adalah
  // syaratnya, bukan hemat byte (K3). Latar putih benar di sini - JPEG memang
  // tidak mendukung alpha, jadi tanpa flatten area transparan jadi hitam.
  if (format === 'jpeg') {
    return { mime: 'image/jpeg', quality: 0.85, background: '#ffffff' }
  }
  if (canWebp) {
    return { mime: 'image/webp', quality, background: undefined }
  }
  return { mime: 'image/jpeg', quality: 0.85, background: '#ffffff' }
}

/** Ambang alpha untuk hasAlphaChannel. Dipasang di 250, bukan 255, supaya
 * piksel semi-transparan hasil penskalaan probe tetap terhitung transparan. */
const ALPHA_OPAQUE_THRESHOLD = 250

/** True bila ADA piksel dengan alpha < 250 pada buffer RGBA. Fungsi MURNI dan
 * bebas DOM supaya bisa dites di jsdom (jsdom tidak mengimplementasikan
 * canvas.toBlob/createImageBitmap - lihat catatan di image-compress.test.ts).
 *
 * Dipakai untuk MEMPERINGATKAN admin bila gambar yang diunggah ke field
 * lossless ternyata tidak punya area transparan - BUKAN untuk memindah format
 * secara diam-diam. Inilah yang membuat bug "logo berlatar putih" tidak bisa
 * terulang tanpa disadari (docs/plan/revisi-uat-logo-og-nama-tamu-dresscode/
 * PLAN.md D2). */
export function hasAlphaChannel(pixels: Uint8ClampedArray): boolean {
  // Langkah 4 = RGBA; indeks 3 adalah kanal alpha piksel pertama.
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < ALPHA_OPAQUE_THRESHOLD) return true
  }
  return false
}

/** Rencana percobaan kedua bila hasil pertama masih di atas MAX_DECODED_BYTES.
 * "lossless" (PNG) mengabaikan argumen quality canvas.toBlob, jadi satu-satunya
 * tuas ukuran adalah memperkecil dimensi. "lossy" mempertahankan nilai lama
 * (maxDim 1280, quality diturunkan 0.12) supaya jalur foto tetap identik byte. */
export function retryPlanFor(format: ImageOutputFormat, maxDim: number, quality: number): RetryPlan {
  if (format === 'lossless') {
    return { maxDim: Math.max(1, Math.round(maxDim / 2)), quality }
  }
  // Math.min, BUKAN 1280 tetap seperti cabang lossy di bawah: field preview
  // memakai maxDim 1200, dan mengembalikan 1280 justru MEMPERBESAR gambar
  // pada percobaan yang seharusnya mengecilkannya.
  if (format === 'jpeg') {
    return { maxDim: Math.min(maxDim, 1280), quality: Math.max(0.6, quality - 0.12) }
  }
  return { maxDim: 1280, quality: Math.max(0.6, quality - 0.12) }
}

let webpSupportCache: boolean | null = null

/** Probe (bukan tebakan) apakah browser ini bisa meng-encode WebP lewat canvas -
 * dipakai memutuskan target encoder, hasilnya di-memo sekali per sesi. */
function canEncodeWebp(): boolean {
  if (webpSupportCache !== null) return webpSupportCache
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    webpSupportCache = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    webpSupportCache = false
  }
  return webpSupportCache
}

function drawToCanvas(bitmap: ImageBitmap, width: number, height: number, background?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageCompressError('Browser tidak mendukung pemrosesan gambar.')
  if (background) {
    // Flatten alpha ke warna ini SEBELUM drawImage - JPEG tidak mendukung
    // transparansi, tanpa ini area transparan menjadi hitam (T4).
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas
}

/** Ukuran kanvas probe alpha. Kecil disengaja: 64x64 = 4.096 piksel (~16 KB)
 * alih-alih memindai gambar ukuran penuh (1280px = ~1,6 juta piksel / ~6,5 MB
 * per unggahan). Penskalaan ber-smoothing membuat area transparan tetap turun
 * di bawah alpha 255, sehingga ambang 250 di hasAlphaChannel menangkapnya. */
const ALPHA_PROBE_DIM = 64

/** Mendeteksi apakah bitmap SUMBER punya area transparan, lewat kanvas probe
 * kecil. Sengaja TIDAK dipanggil dari encodeAttempt: encodeAttempt bisa
 * berjalan dua kali (jalur retryPlanFor), sedangkan alpha adalah properti
 * berkas sumber - bukan properti percobaan encode. Mengembalikan `undefined`
 * bila probe gagal (mis. kanvas diblokir), supaya kegagalan probe tidak
 * pernah menggagalkan unggahan. */
function probeAlpha(bitmap: ImageBitmap): boolean | undefined {
  try {
    const { width, height } = computeTargetSize(bitmap.width, bitmap.height, ALPHA_PROBE_DIM)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.drawImage(bitmap, 0, 0, width, height)
    return hasAlphaChannel(ctx.getImageData(0, 0, width, height).data)
  } catch {
    return undefined
  }
}

function encodeCanvas(canvas: HTMLCanvasElement, mimeType: string, quality: number | undefined): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality))
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(stripDataUrlPrefix(String(reader.result)))
    reader.onerror = () => reject(new ImageCompressError('Gagal membaca hasil kompresi gambar.'))
    reader.readAsDataURL(blob)
  })
}

function withExt(filename: string, ext: string): string {
  const baseName = filename.replace(/\.[^./]+$/, '') || 'foto'
  return `${baseName}.${ext}`
}

async function encodeAttempt(
  bitmap: ImageBitmap,
  maxDim: number,
  quality: number,
  format: ImageOutputFormat,
): Promise<EncodedImage> {
  const { width, height } = computeTargetSize(bitmap.width, bitmap.height, maxDim)

  const target = encodeTargetFor(format, canEncodeWebp(), quality)
  const canvas = drawToCanvas(bitmap, width, height, target.background)

  const blob = await encodeCanvas(canvas, target.mime, target.quality)
  if (!blob) {
    throw new ImageCompressError('Browser tidak mendukung kompresi gambar ini.')
  }

  // Ekstensi dari blob.type SEBENARNYA, bukan dari target.mime yang diminta -
  // memperbaiki T1 (toBlob dengan tipe tak didukung menghasilkan PNG per
  // spesifikasi HTML, bukan null; ini menangkap kasus itu dengan benar alih-alih
  // salah menamainya .webp).
  const ext = extFromMimeType(blob.type)
  if (!ext) {
    throw new ImageCompressError('Format hasil kompresi tidak dikenali.')
  }

  const base64 = await blobToBase64(blob)
  return { base64, ext }
}

/** Menyiapkan satu File image untuk diunggah ke POST /api/v1/admin/uploads/base64.
 * `format` (default "lossy") menentukan encoder jalur KONVERSI (PNG/JPEG
 * sumber): "lossy" -> WebP (fallback JPEG+latar putih bila browser tak
 * mendukung encoder WebP), "lossless" -> PNG tanpa flatten latar apa pun -
 * pakai ini untuk field yang butuh transparansi (docs/plan/
 * admin-content-png-lossless-galeri-tajam/PLAN.md K1/K2). GIF/WebP diteruskan
 * apa adanya TANPA canvas pada KEDUA format itu, supaya animasi GIF tidak mati
 * dan WebP tidak rugi generasi (D1). "jpeg" -> SELALU JPEG, dan justru
 * MENOLAK sumber GIF/WebP alih-alih meneruskannya (D9) - dipakai field Gambar
 * Preview Link, yang hasilnya harus pasti dirender crawler WhatsApp.
 *
 * Melempar ImageCompressError (pesan berbahasa Indonesia) bila format tidak
 * didukung, berkas terlalu besar, atau (untuk jalur konversi) masih di atas
 * 5 MB setelah dua percobaan kompresi. */
export async function prepareImageForUpload(
  file: File,
  maxDim: number,
  format: ImageOutputFormat = 'lossy',
): Promise<CompressedImage> {
  const sourceType = effectiveSourceType(file)
  if (!sourceType) {
    throw new ImageCompressError('Format tidak didukung. Pilih PNG, JPG, JPEG, GIF, atau WebP.')
  }

  // Penjagaan D9: `accept` pada <input type="file"> hanyalah filter dialog,
  // bukan penegakan - user bisa memilih "All files". Tanpa cek ini sebuah
  // .webp menempuh jalur passthrough di bawah dan tersimpan tetap .webp,
  // sehingga preview WhatsApp rusak lagi (crawler WA tidak merender WebP).
  // SENGAJA di sini, sebelum blok passthrough, dan HANYA untuk format
  // 'jpeg' - perilaku passthrough untuk lossy/lossless tidak boleh berubah,
  // itu yang menjaga animasi GIF tetap hidup.
  if (format === 'jpeg' && PASSTHROUGH_TYPES.includes(sourceType)) {
    throw new ImageCompressError(
      'WhatsApp tidak bisa merender WebP dan GIF pada preview link, jadi gambar preview harus PNG atau JPG.',
    )
  }

  if (PASSTHROUGH_TYPES.includes(sourceType)) {
    if (file.size > MAX_DECODED_BYTES) {
      throw new ImageCompressError(
        'GIF dan WebP tidak dikompres agar animasinya tidak hilang, jadi ukurannya harus di bawah 5 MB.',
      )
    }
    const base64 = await blobToBase64(file)
    const ext = extFromMimeType(sourceType) ?? 'gif'
    return { base64, filename: withExt(file.name, ext) }
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageCompressError('Ukuran gambar terlalu besar (maks 25 MB sebelum dikompres).')
  }

  let bitmap: ImageBitmap
  try {
    // imageOrientation: 'from-image' memaksa rotasi sesuai EXIF - tanpa ini,
    // foto potret dari HP bisa tersimpan terputar permanen (T3), karena WebP
    // hasil re-encode tidak membawa EXIF untuk dikoreksi belakangan.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new ImageCompressError('Gagal membaca gambar. Coba berkas lain.')
  }

  try {
    // SEKALI saja, sebelum encode - alpha adalah properti berkas SUMBER, dan
    // encodeAttempt di bawah bisa berjalan dua kali (jalur retryPlanFor).
    const hasAlpha = probeAlpha(bitmap)

    const quality = qualityForSourceType(sourceType)
    let result = await encodeAttempt(bitmap, maxDim, quality, format)
    if (base64ByteLength(result.base64) > MAX_DECODED_BYTES) {
      const retry = retryPlanFor(format, maxDim, quality)
      result = await encodeAttempt(bitmap, retry.maxDim, retry.quality, format)
    }
    if (base64ByteLength(result.base64) > MAX_DECODED_BYTES) {
      // PNG lossless mengabaikan quality canvas.toBlob - pesan "lossy" lama
      // menyiratkan ada kompresi lossy yang bisa diturunkan lagi, padahal
      // untuk jalur lossless tidak ada tuas itu sama sekali.
      throw new ImageCompressError(
        format === 'lossless'
          ? 'Gambar logo terlalu kompleks untuk disimpan tanpa kompresi. Gunakan berkas logo yang lebih sederhana.'
          : 'Ukuran gambar masih terlalu besar setelah dikompres. Coba gambar lain.',
      )
    }

    return { base64: result.base64, filename: withExt(file.name, result.ext), hasAlpha }
  } finally {
    bitmap.close()
  }
}
