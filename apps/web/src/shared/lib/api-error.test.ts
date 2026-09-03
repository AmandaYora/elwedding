import { apiErrorMessage } from './api-error'

// Regresi T3 (docs/plan/admin-content-upload-base64/PLAN.md): sebelumnya
// `err instanceof Error` dicek lebih dulu, jadi pesan BE tidak pernah
// terlihat karena AxiosError juga instance Error. apiErrorMessage HARUS
// membaca response.data.message lebih dulu.
test('pesan BE menang atas err.message bawaan axios', () => {
  const axiosLikeErr = Object.assign(new Error('Request failed with status code 400'), {
    response: { status: 400, data: { message: 'photoUrl wajib diisi' } },
  })
  expect(apiErrorMessage(axiosLikeErr, 'fallback')).toBe('photoUrl wajib diisi')
})

test('413 tanpa body JSON (dari nginx, HTML) tetap menghasilkan pesan ukuran file', () => {
  const err413 = Object.assign(new Error('Request failed with status code 413'), {
    response: { status: 413, data: undefined },
  })
  expect(apiErrorMessage(err413, 'fallback')).toBe('Ukuran file terlalu besar.')
})

test('401 menghasilkan pesan sesi berakhir', () => {
  const err401 = Object.assign(new Error('Request failed with status code 401'), {
    response: { status: 401 },
  })
  expect(apiErrorMessage(err401, 'fallback')).toBe('Sesi berakhir, silakan login kembali.')
})

test('5xx menghasilkan pesan gangguan server', () => {
  const err500 = Object.assign(new Error('Request failed with status code 500'), {
    response: { status: 500 },
  })
  expect(apiErrorMessage(err500, 'fallback')).toBe('Terjadi gangguan pada server, coba lagi.')
})

test('Error biasa (bukan axios) mengembalikan message-nya sendiri', () => {
  expect(apiErrorMessage(new Error('gagal membaca gambar'), 'fallback')).toBe('gagal membaca gambar')
})

test('unknown yang bukan Error menghasilkan fallback', () => {
  expect(apiErrorMessage('bukan error object', 'fallback')).toBe('fallback')
  expect(apiErrorMessage(undefined, 'fallback')).toBe('fallback')
})
