/**
 * Kompresi image di browser sebelum dikirim sebagai base64 - docs/plan/
 * admin-content-upload-base64/PLAN.md §3.3 (keputusan K6). Tanpa dependency
 * baru, hanya canvas & createImageBitmap bawaan browser.
 */

export class ImageCompressError extends Error {}

const MAX_SOURCE_BYTES = 25 * 1024 * 1024 // 25 MB - batas berkas SUMBER sebelum dikompres
const MAX_DECODED_BYTES = 5 * 1024 * 1024 // 5 MB - harus sama dengan maxImageDecodedSize di BE (K4)

export interface CompressedImage {
  base64: string
  filename: string
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

function drawToCanvas(bitmap: ImageBitmap, width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageCompressError('Browser tidak mendukung pemrosesan gambar.')
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

async function encodeAttempt(bitmap: ImageBitmap, maxDim: number, quality: number): Promise<{ base64: string; ext: string }> {
  const { width, height } = computeTargetSize(bitmap.width, bitmap.height, maxDim)
  const canvas = drawToCanvas(bitmap, width, height)

  let blob = await encodeCanvas(canvas, 'image/webp', quality)
  let ext = 'webp'
  if (!blob) {
    // Browser tanpa dukungan encode WebP (toBlob mengembalikan null) - ulangi JPEG.
    blob = await encodeCanvas(canvas, 'image/jpeg', 0.85)
    ext = 'jpg'
  }
  if (!blob) {
    throw new ImageCompressError('Browser tidak mendukung kompresi gambar ini.')
  }

  const base64 = await blobToBase64(blob)
  return { base64, ext }
}

/** Mengompres satu File image menjadi base64 siap kirim ke POST /api/v1/admin/uploads/base64.
 * Melempar ImageCompressError (pesan berbahasa Indonesia) bila file bukan image, terlalu
 * besar sebelum dikompres, atau masih di atas 5 MB setelah dua percobaan kompresi. */
export async function compressImageToBase64(file: File, maxDim: number): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new ImageCompressError('Berkas yang dipilih bukan gambar.')
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new ImageCompressError('Ukuran gambar terlalu besar (maks 25 MB sebelum dikompres).')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new ImageCompressError('Gagal membaca gambar. Coba berkas lain.')
  }

  try {
    let result = await encodeAttempt(bitmap, maxDim, 0.82)
    if (base64ByteLength(result.base64) > MAX_DECODED_BYTES) {
      result = await encodeAttempt(bitmap, 1280, 0.7)
    }
    if (base64ByteLength(result.base64) > MAX_DECODED_BYTES) {
      throw new ImageCompressError('Ukuran gambar masih terlalu besar setelah dikompres. Coba gambar lain.')
    }

    const baseName = file.name.replace(/\.[^./]+$/, '') || 'foto'
    return { base64: result.base64, filename: `${baseName}.${result.ext}` }
  } finally {
    bitmap.close()
  }
}
