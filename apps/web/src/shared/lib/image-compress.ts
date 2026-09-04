/**
 * Kompresi image di browser sebelum dikirim sebagai base64 - docs/plan/
 * admin-content-upload-base64/PLAN.md §3.3 (keputusan K6) dan docs/plan/
 * admin-content-image-format-pipeline/PLAN.md (keputusan D1-D4). Tanpa
 * dependency baru, hanya canvas & createImageBitmap bawaan browser.
 *
 * PNG/JPEG dikonversi ke WebP lewat canvas. GIF/WebP diteruskan APA ADANYA
 * (passthrough) - GIF lewat canvas hanya mengambil frame pertama, membunuh
 * animasi (regresi T2), dan WebP yang sudah WebP tidak perlu rugi generasi.
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
}

interface EncodedImage {
  base64: string
  ext: string
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

function encodeCanvas(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
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

async function encodeAttempt(bitmap: ImageBitmap, maxDim: number, quality: number): Promise<EncodedImage> {
  const { width, height } = computeTargetSize(bitmap.width, bitmap.height, maxDim)

  const useWebp = canEncodeWebp()
  const targetMime = useWebp ? 'image/webp' : 'image/jpeg'
  const targetQuality = useWebp ? quality : 0.85
  // Latar putih HANYA untuk target JPEG (tidak mendukung alpha) - WebP
  // mendukung alpha, jadi kanvasnya dibiarkan transparan (D3, T4).
  const canvas = drawToCanvas(bitmap, width, height, useWebp ? undefined : '#ffffff')

  const blob = await encodeCanvas(canvas, targetMime, targetQuality)
  if (!blob) {
    throw new ImageCompressError('Browser tidak mendukung kompresi gambar ini.')
  }

  // Ekstensi dari blob.type SEBENARNYA, bukan dari targetMime yang diminta -
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
 * PNG/JPEG dikonversi ke WebP (fallback JPEG bila browser tak mendukung encoder
 * WebP) lewat canvas. GIF/WebP diteruskan apa adanya TANPA canvas, supaya
 * animasi GIF tidak mati dan WebP tidak rugi generasi (D1).
 *
 * Melempar ImageCompressError (pesan berbahasa Indonesia) bila format tidak
 * didukung, berkas terlalu besar, atau (untuk jalur konversi) masih di atas
 * 5 MB setelah dua percobaan kompresi. */
export async function prepareImageForUpload(file: File, maxDim: number): Promise<CompressedImage> {
  const sourceType = effectiveSourceType(file)
  if (!sourceType) {
    throw new ImageCompressError('Format tidak didukung. Pilih PNG, JPG, JPEG, GIF, atau WebP.')
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
    const quality = qualityForSourceType(sourceType)
    let result = await encodeAttempt(bitmap, maxDim, quality)
    if (base64ByteLength(result.base64) > MAX_DECODED_BYTES) {
      result = await encodeAttempt(bitmap, 1280, Math.max(0.6, quality - 0.12))
    }
    if (base64ByteLength(result.base64) > MAX_DECODED_BYTES) {
      throw new ImageCompressError('Ukuran gambar masih terlalu besar setelah dikompres. Coba gambar lain.')
    }

    return { base64: result.base64, filename: withExt(file.name, result.ext) }
  } finally {
    bitmap.close()
  }
}
