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
      } catch {}
      try {
        h.delete('content-type')
      } catch {}
    }
    delete h['Content-Type']
    delete h['content-type']
    h['Content-Type'] = undefined
  }
  return config
})
