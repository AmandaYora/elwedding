import { computeTargetSize, stripDataUrlPrefix, base64ByteLength } from './image-compress'

// jsdom TIDAK mengimplementasikan canvas.toBlob maupun createImageBitmap, jadi
// compressImageToBase64 sendiri tidak diuji di sini - hanya fungsi murninya
// (docs/plan/admin-content-upload-base64/PLAN.md §6.2).

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
