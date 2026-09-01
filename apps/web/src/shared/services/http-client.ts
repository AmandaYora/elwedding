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
  return config
})
