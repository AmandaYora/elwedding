import axios from 'axios'

// Sama-origin secara default (di-proxy Vite saat dev, disajikan binary Go
// yang sama saat produksi - lihat vite.config.ts & docker-deployment.md).
// Dipakai baik oleh hook undangan tamu (useInvitationData, useGuestSession)
// maupun seluruh halaman admin - satu instance terpusat (frontend.md).
export const httpClient = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Header Authorization hanya ditempel ke route admin - hook undangan tamu
// (public route) tidak pernah membawa token. Zustand auth store di-import
// dinamis (bukan di top-level) supaya tidak ikut ter-bundle ke chunk
// undangan tamu, yang tidak pernah membutuhkannya (index.html/main.tsx
// tidak boleh membawa kode admin sama sekali - keputusan #10 PLAN.md).
httpClient.interceptors.request.use(async (config) => {
  if (config.url?.includes('/api/v1/admin/')) {
    const { useAuthStore } = await import('@/shared/stores/auth.store')
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  // Biar browser set boundary untuk multipart (service_upload.go:49 ParseMultipartForm butuh boundary)
  // AxiosHeaders adalah class case-insensitive — delete via property saja tidak cukup di beberapa versi
  if (config.data instanceof FormData && config.headers) {
    const h = config.headers as unknown as Record<string, unknown> & { delete?: (k: string) => void }
    if (typeof h.delete === 'function') {
      try {
        h.delete('Content-Type')
      } catch {
        // Sebagian versi AxiosHeaders melempar untuk key yang tidak ada -
        // penghapusan via property di bawah yang jadi jaminannya.
      }
      try {
        h.delete('content-type')
      } catch {
        // idem
      }
    }
    delete h['Content-Type']
    delete h['content-type']
    h['Content-Type'] = undefined
  }
  return config
})

/** Path halaman login admin. basename router admin adalah "/admin"
 * (AdminApp.tsx), jadi rute "/login" berada di "/admin/login". */
const ADMIN_LOGIN_PATH = '/admin/login'

// Sesi admin yang kedaluwarsa harus MEMULANGKAN pengguna ke login, bukan
// meninggalkannya di halaman yang setiap permintaannya gagal.
//
// Tanpa ini, JWT yang lewat masa berlaku (JWT_EXPIRES_IN, default 24 jam)
// menyisakan token mati di localStorage: ProtectedRoute masih melihat `token`
// terisi sehingga tetap merender dasbor, sementara SETIAP panggilan API
// dibalas 401. Yang muncul di layar hanya pesan "Sesi berakhir, silakan login
// kembali" (api-error.ts) - kalimat yang menyuruh login tanpa menyediakan
// satu pun jalan ke sana selain menemukan tombol Keluar sendiri. Paling
// berbahaya di hari-H: petugas gate memindai QR dan hanya melihat kegagalan
// beruntun.
//
// HANYA route admin. Login sendiri (/api/v1/auth/login) juga membalas 401
// saat password salah, dan itu BUKAN sesi kedaluwarsa - ikut ditangani di
// sini berarti melempar pengguna keluar dari halaman login yang sedang dia
// isi. Route publik undangan tamu tidak pernah membawa token sama sekali.
//
// 403 SENGAJA tidak ikut: itu balasan RequireFullAdmin untuk akun petugas
// yang menyentuh endpoint admin penuh (authmw/middleware.go). Sesinya sah -
// mengeluarkannya justru menghapus sesi yang masih berlaku.
httpClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = (error as { response?: { status?: number } })?.response?.status
    const url = (error as { config?: { url?: string } })?.config?.url
    if (status === 401 && url?.includes('/api/v1/admin/')) {
      const { useAuthStore } = await import('@/shared/stores/auth.store')
      useAuthStore.getState().logout()
      // Interceptor ini hidup di luar pohon React dan tidak punya akses ke
      // router, jadi navigasinya lewat window.location - sekaligus membuang
      // seluruh state halaman yang sudah tidak punya sesi.
      if (typeof window !== 'undefined' && window.location.pathname !== ADMIN_LOGIN_PATH) {
        window.location.assign(ADMIN_LOGIN_PATH)
      }
    }
    // Selalu diteruskan: pemanggil tetap perlu menangani errornya sendiri.
    return Promise.reject(error)
  },
)
