import {
  computeTargetSize,
  stripDataUrlPrefix,
  base64ByteLength,
  effectiveSourceType,
  extFromMimeType,
  qualityForSourceType,
  encodeTargetFor,
  retryPlanFor,
  prepareImageForUpload,
  ImageCompressError,
} from './image-compress'

// jsdom TIDAK mengimplementasikan canvas.toBlob maupun createImageBitmap, jadi
// jalur KONVERSI (PNG/JPEG) tidak diuji ujung-ke-ujung di sini - hanya fungsi
// murninya dan jalur PASSTHROUGH (GIF/WebP), yang memang tidak menyentuh
// canvas sama sekali (docs/plan/admin-content-image-format-pipeline/PLAN.md §6.1).

test('computeTargetSize menjaga rasio aspek saat sisi terpanjang melebihi maxDim', () => {
  expect(computeTargetSize(4000, 3000, 1920)).toEqual({ width: 1920, height: 1440 })
  expect(computeTargetSize(3000, 4000, 1920)).toEqual({ width: 1440, height: 1920 })
})

test('computeTargetSize tidak memperbesar gambar yang sudah kecil', () => {
  expect(computeTargetSize(800, 600, 1920)).toEqual({ width: 800, height: 600 })
  expect(computeTargetSize(1920, 1080, 1920)).toEqual({ width: 1920, height: 1080 })
})

test('stripDataUrlPrefix membuang prefix data:...;base64,', () => {
  expect(stripDataUrlPrefix('data:image/webp;base64,AAAA')).toBe('AAAA')
  expect(stripDataUrlPrefix('data:image/png;base64,')).toBe('')
})

test('stripDataUrlPrefix membiarkan base64 polos apa adanya', () => {
  expect(stripDataUrlPrefix('AAAA')).toBe('AAAA')
})

test('base64ByteLength menghitung ukuran byte hasil decode termasuk padding', () => {
  expect(base64ByteLength('AAAA')).toBe(3) // tanpa padding
  expect(base64ByteLength('AAA=')).toBe(2) // padding 1 "="
  expect(base64ByteLength('AA==')).toBe(1) // padding 2 "="
  expect(base64ByteLength('')).toBe(0)
})

test('effectiveSourceType mengenali PNG/JPG/JPEG/GIF/WebP dari file.type', () => {
  expect(effectiveSourceType(new File([], 'a.png', { type: 'image/png' }))).toBe('image/png')
  expect(effectiveSourceType(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe('image/jpeg')
  expect(effectiveSourceType(new File([], 'a.jpeg', { type: 'image/jpeg' }))).toBe('image/jpeg')
  expect(effectiveSourceType(new File([], 'a.gif', { type: 'image/gif' }))).toBe('image/gif')
  expect(effectiveSourceType(new File([], 'a.webp', { type: 'image/webp' }))).toBe('image/webp')
})

test('effectiveSourceType jatuh ke ekstensi nama berkas saat file.type kosong', () => {
  expect(effectiveSourceType(new File([], 'foto.png', { type: '' }))).toBe('image/png')
  expect(effectiveSourceType(new File([], 'foto.JPG', { type: '' }))).toBe('image/jpeg')
  expect(effectiveSourceType(new File([], 'cover.GIF', { type: '' }))).toBe('image/gif')
})

test('effectiveSourceType mengembalikan null untuk format yang tidak didukung', () => {
  expect(effectiveSourceType(new File([], 'a.heic', { type: 'image/heic' }))).toBeNull()
  expect(effectiveSourceType(new File([], 'a.svg', { type: 'image/svg+xml' }))).toBeNull()
  expect(effectiveSourceType(new File([], 'a.avif', { type: 'image/avif' }))).toBeNull()
})

test('extFromMimeType memetakan keempat MIME yang dipakai dan null untuk yang tidak dikenal', () => {
  expect(extFromMimeType('image/webp')).toBe('webp')
  expect(extFromMimeType('image/jpeg')).toBe('jpg')
  expect(extFromMimeType('image/png')).toBe('png')
  expect(extFromMimeType('image/gif')).toBe('gif')
  expect(extFromMimeType('image/heic')).toBeNull()
})

test('qualityForSourceType: 0.92 untuk PNG, 0.82 untuk JPEG', () => {
  expect(qualityForSourceType('image/png')).toBe(0.92)
  expect(qualityForSourceType('image/jpeg')).toBe(0.82)
})

// Test regresi untuk bug latar putih (docs/plan/admin-content-png-lossless-galeri-tajam/
// PLAN.md §2.1): latar transparan sebelumnya bisa dibakar putih saat browser jatuh ke
// fallback JPEG. "lossless" HARUS selalu punya background undefined, apa pun status
// encoder WebP - itulah yang membedakannya secara struktural dari "lossy".
test('encodeTargetFor("lossless") selalu PNG tanpa background, baik canWebp true maupun false', () => {
  expect(encodeTargetFor('lossless', true, 0.92)).toEqual({ mime: 'image/png', quality: undefined, background: undefined })
  expect(encodeTargetFor('lossless', false, 0.92)).toEqual({ mime: 'image/png', quality: undefined, background: undefined })
})

test('encodeTargetFor("lossy") dengan encoder WebP tersedia menghasilkan WebP tanpa background', () => {
  expect(encodeTargetFor('lossy', true, 0.92)).toEqual({ mime: 'image/webp', quality: 0.92, background: undefined })
})

test('encodeTargetFor("lossy") tanpa encoder WebP jatuh ke JPEG dengan latar putih - HANYA di sini flatten sah', () => {
  expect(encodeTargetFor('lossy', false, 0.92)).toEqual({ mime: 'image/jpeg', quality: 0.85, background: '#ffffff' })
})

test('retryPlanFor("lossless") memperkecil dimensi karena PNG mengabaikan quality canvas.toBlob', () => {
  expect(retryPlanFor('lossless', 640, 0.92)).toEqual({ maxDim: 320, quality: 0.92 })
})

test('retryPlanFor("lossy") mempertahankan nilai retry lama (maxDim 1280, quality -0.12)', () => {
  const retry = retryPlanFor('lossy', 640, 0.92)
  expect(retry.maxDim).toBe(1280)
  expect(retry.quality).toBeCloseTo(0.8) // 0.92 - 0.12 tidak eksak di IEEE-754
})

test('prepareImageForUpload pada GIF meneruskan byte asli TANPA memanggil createImageBitmap', async () => {
  const createImageBitmapSpy = vi.fn()
  vi.stubGlobal('createImageBitmap', createImageBitmapSpy)

  try {
    const file = new File(['gif-bytes'], 'cover.gif', { type: 'image/gif' })
    const result = await prepareImageForUpload(file, 1920)

    expect(result.filename).toBe('cover.gif')
    expect(createImageBitmapSpy).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})

test('prepareImageForUpload pada GIF di atas 5 MB melempar error yang menyebut animasi', async () => {
  const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'cover.gif', { type: 'image/gif' })

  await expect(prepareImageForUpload(oversized, 1920)).rejects.toBeInstanceOf(ImageCompressError)
  await expect(prepareImageForUpload(oversized, 1920)).rejects.toThrow(/animasi/)
})

test('prepareImageForUpload pada tipe yang tidak diterima melempar error sebelum menyentuh canvas', async () => {
  const createImageBitmapSpy = vi.fn()
  vi.stubGlobal('createImageBitmap', createImageBitmapSpy)

  try {
    const file = new File(['heic-bytes'], 'foto.heic', { type: 'image/heic' })
    await expect(prepareImageForUpload(file, 1920)).rejects.toBeInstanceOf(ImageCompressError)
    expect(createImageBitmapSpy).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})

// D5: format "lossless" TIDAK boleh memengaruhi jalur passthrough GIF/WebP sama
// sekali - keduanya tetap lewat byte asli tanpa canvas, apa pun formatnya.
test('prepareImageForUpload pada GIF dengan format "lossless" tetap passthrough TANPA createImageBitmap', async () => {
  const createImageBitmapSpy = vi.fn()
  vi.stubGlobal('createImageBitmap', createImageBitmapSpy)

  try {
    const file = new File(['gif-bytes'], 'cover.gif', { type: 'image/gif' })
    const result = await prepareImageForUpload(file, 1920, 'lossless')

    expect(result.filename).toBe('cover.gif')
    expect(createImageBitmapSpy).not.toHaveBeenCalled()
  } finally {
    vi.unstubAllGlobals()
  }
})

test('prepareImageForUpload pada WebP dengan format "lossless" tetap passthrough, bukan di-re-encode ke PNG', async () => {
  const file = new File(['webp-bytes'], 'logo.webp', { type: 'image/webp' })
  const result = await prepareImageForUpload(file, 1920, 'lossless')

  expect(result.filename).toBe('logo.webp')
})
