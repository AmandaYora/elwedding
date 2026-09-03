/**
 * Ekstraksi pesan error API yang benar - docs/plan/admin-content-upload-base64/
 * PLAN.md T3: `err instanceof Error` yang dicek lebih dulu di 4 tempat membuat
 * pesan BE ("File terlalu besar (maks 10 MB)", dst.) tidak pernah terlihat,
 * karena AxiosError juga instance Error. Urutan di sini SENGAJA membaca pesan
 * BE dulu, baru fallback per status code, baru err.message sebagai upaya
 * terakhir - kebalikan dari urutan yang salah itu.
 */

interface AxiosLikeError {
  response?: {
    status?: number
    data?: { message?: string }
  }
  message?: string
}

function isAxiosLikeError(err: unknown): err is AxiosLikeError {
  return typeof err === 'object' && err !== null && 'response' in err
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (isAxiosLikeError(err)) {
    const beMessage = err.response?.data?.message
    if (typeof beMessage === 'string' && beMessage.length > 0) {
      return beMessage
    }

    // 413 dari nginx datang sebagai HTML (bukan envelope JSON proyek), jadi
    // beMessage di atas selalu undefined untuk kasus ini - fallback per status
    // WAJIB ada, bukan opsional.
    const status = err.response?.status
    if (status === 413) return 'Ukuran file terlalu besar.'
    if (status === 401) return 'Sesi berakhir, silakan login kembali.'
    if (typeof status === 'number' && status >= 500) return 'Terjadi gangguan pada server, coba lagi.'

    if (typeof err.message === 'string' && err.message.length > 0) return err.message
  }

  if (err instanceof Error && err.message) return err.message

  return fallback
}
