import type { AxiosAdapter } from 'axios'
import { httpClient } from './http-client'
import { useAuthStore } from '@/shared/stores/auth.store'

/**
 * Interceptor 401 (audit 2026-09-05): sesi admin yang kedaluwarsa harus
 * MEMULANGKAN pengguna ke login. Sebelum ini, token mati tetap tersimpan di
 * localStorage sehingga ProtectedRoute terus merender dasbor sementara setiap
 * permintaan dibalas 401 - halaman yang tidak bisa dipakai tanpa satu pun
 * jalan ke login.
 *
 * Adapter Axios diganti (bukan network di-mock) supaya yang diuji benar-benar
 * jalur interceptor yang sesungguhnya, termasuk pencocokan URL-nya.
 */
const assign = vi.fn()

function respondWith(status: number): AxiosAdapter {
  return async (config) => {
    const err = new Error(`HTTP ${status}`) as Error & { response?: unknown; config?: unknown }
    err.response = { status, data: {}, statusText: '', headers: {}, config }
    err.config = config
    throw err
  }
}

let originalAdapter: unknown

beforeAll(() => {
  originalAdapter = httpClient.defaults.adapter
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { pathname: '/admin/guests', assign },
  })
})

afterAll(() => {
  httpClient.defaults.adapter = originalAdapter as AxiosAdapter
})

beforeEach(() => {
  assign.mockReset()
  useAuthStore.getState().setSession('token-lama', 'admin', 'admin')
})

test('401 di route admin -> sesi dibuang & dialihkan ke login', async () => {
  httpClient.defaults.adapter = respondWith(401)

  await expect(httpClient.get('/api/v1/admin/guests')).rejects.toBeTruthy()

  expect(useAuthStore.getState().token).toBeNull()
  expect(useAuthStore.getState().role).toBeNull()
  expect(assign).toHaveBeenCalledWith('/admin/login')
})

// 403 adalah balasan RequireFullAdmin untuk akun PETUGAS yang menyentuh
// endpoint admin penuh. Sesinya sah - mengeluarkannya justru menghapus sesi
// yang masih berlaku dan mengunci petugas dari menu Scan-nya sendiri.
test('403 di route admin -> sesi TIDAK dibuang', async () => {
  httpClient.defaults.adapter = respondWith(403)

  await expect(httpClient.get('/api/v1/admin/guests')).rejects.toBeTruthy()

  expect(useAuthStore.getState().token).toBe('token-lama')
  expect(assign).not.toHaveBeenCalled()
})

// Password salah juga 401. Kalau endpoint login ikut ditangani, pengguna
// terlempar keluar dari halaman login yang sedang dia isi.
test('401 dari endpoint login -> sesi TIDAK dibuang & tidak dialihkan', async () => {
  httpClient.defaults.adapter = respondWith(401)

  await expect(httpClient.post('/api/v1/auth/login', {})).rejects.toBeTruthy()

  expect(useAuthStore.getState().token).toBe('token-lama')
  expect(assign).not.toHaveBeenCalled()
})

// Route publik undangan tamu tidak pernah membawa token - 401 di sana tidak
// boleh menyentuh sesi admin sama sekali.
test('401 di route publik -> sesi admin tidak tersentuh', async () => {
  httpClient.defaults.adapter = respondWith(401)

  await expect(httpClient.get('/api/v1/public/guests/by-token/abc')).rejects.toBeTruthy()

  expect(useAuthStore.getState().token).toBe('token-lama')
  expect(assign).not.toHaveBeenCalled()
})
