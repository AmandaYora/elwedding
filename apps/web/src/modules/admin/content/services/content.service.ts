import { httpClient } from '@/shared/services/http-client'
import { prepareImageForUpload, type ImageOutputFormat } from '@/shared/lib/image-compress'
import type { InvitationContent } from '@/types/api'

// Payload PATCH memakai weddingDate (format datetime-local), BUKAN
// weddingDateUnix - lihat Go DTO UpdateInvitationContentInput. Field ini
// harus SELALU dikirim lengkap (read-modify-write), karena endpoint
// mengganti seluruh baris singleton, bukan partial update.
export type ContentFormValues = Omit<
  InvitationContent,
  'weddingDateUnix' | 'weddingDateLabel' | 'weddingDateRaw'
> & {
  weddingDate: string
}

export async function getContent(): Promise<InvitationContent> {
  const res = await httpClient.get<{ data: InvitationContent }>('/api/v1/admin/content')
  return res.data.data
}

export async function updateContent(values: ContentFormValues): Promise<void> {
  await httpClient.patch('/api/v1/admin/content', values)
}

/** Ekstensi audio yang BENAR-BENAR diterima backend. Harus sama persis
 * dengan allowedUploadExt di
 * apps/api/internal/modules/content/application/service_upload.go - kalau
 * daftar ini lebih longgar, berkasnya baru ditolak SESUDAH terunggah penuh
 * (415), yang untuk berkas 6 MB berarti menunggu lama demi sebuah error. */
export const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg'] as const

/** Nilai atribut `accept` untuk input musik. MIME **dan** ekstensi ditulis
 * dua-duanya, mengikuti pola yang sudah dipakai field foto di ContentPage.
 * `audio/*` saja TIDAK cukup: dialog berkas Windows menerjemahkan wildcard
 * itu lewat pemetaan MIME di registry, sehingga sebuah .mp3 bisa tampil
 * abu-abu / tidak bisa dipilih kalau asosiasi .mp3 di mesin admin rusak atau
 * diambil alih aplikasi lain. Menyebut ekstensinya eksplisit membuat berkas
 * tetap bisa dipilih tanpa bergantung registry. */
export const AUDIO_ACCEPT = 'audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg'

/** Batas ukuran berkas audio. Cermin maxUploadSize di
 * apps/api/internal/modules/content/presentation/handler.go (10 MB), yang
 * dipasang sebagai http.MaxBytesReader pada SELURUH body multipart - jadi
 * berkas yang mepet 10 MB tetap bisa ditolak server karena overhead
 * multipart. Dicek di klien supaya admin dapat pesan seketika, bukan setelah
 * menunggu unggahan panjang. */
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024

export class AudioUploadError extends Error {}

/** Khusus musik latar (audio) - jalur multipart lama dipertahankan apa
 * adanya (docs/plan/admin-content-upload-base64/PLAN.md keputusan K2).
 * JANGAN dipakai untuk foto - lihat uploadImageBase64 di bawah. */
export async function uploadAudioFile(file: File): Promise<string> {
  const dot = file.name.lastIndexOf('.')
  const ext = dot === -1 ? '' : file.name.slice(dot).toLowerCase()
  if (!(AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AudioUploadError('Format audio tidak didukung. Pilih berkas MP3, WAV, atau OGG.')
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new AudioUploadError(
      `Ukuran berkas ${(file.size / 1024 / 1024).toFixed(1)} MB melebihi batas 10 MB. Kompres dulu audionya.`,
    )
  }

  const formData = new FormData()
  formData.append('file', file)
  // timeout dinaikkan dari default 30 detik (http-client.ts), sejalan dengan
  // uploadImageBase64 di bawah. Berkas musik berukuran megabyte-an dikirim
  // APA ADANYA tanpa kompresi, jadi pada koneksi unggah rumahan yang lambat
  // sebuah MP3 6 MB gampang melewati 30 detik - dan axios membatalkannya di
  // tengah jalan, yang di layar admin tidak bisa dibedakan dari "file
  // ditolak".
  const res = await httpClient.post<{ data: { url: string } }>('/api/v1/admin/uploads', formData, {
    timeout: 300000,
  })
  return res.data.data.url
}

/** Foto di /admin/content - dikompres di browser lalu dikirim sebagai base64
 * ke endpoint image-only (keputusan K1/K5). `format` (default "lossy" - WebP
 * dengan fallback JPEG) ditentukan PER-FIELD oleh pemanggil; field yang butuh
 * transparansi (mis. Logo) mengirim "lossless" (PNG) - docs/plan/
 * admin-content-png-lossless-galeri-tajam/PLAN.md K1/K2. timeout di-override
 * lebih panjang dari default 30s karena unggahan bisa menunggu kompresi +
 * pengiriman body base64 yang lebih besar dari file asli.
 *
 * `onAlphaInfo` (opsional) melaporkan apakah berkas SUMBER punya area
 * transparan - `undefined` berarti tidak diketahui (jalur passthrough
 * GIF/WebP). Disampaikan lewat callback, BUKAN lewat nilai kembalian, karena
 * fungsi ini dipasang langsung sebagai `onUploadPhoto={uploadImageBase64}` di
 * lima SimpleListEditor yang tipenya `=> Promise<string>`; mengubah bentuk
 * kembaliannya akan menggagalkan typecheck di kelima tempat itu (docs/plan/
 * revisi-uat-logo-og-nama-tamu-dresscode/PLAN.md T3). */
export async function uploadImageBase64(
  file: File,
  maxDim = 1920,
  format: ImageOutputFormat = 'lossy',
  onAlphaInfo?: (hasAlpha: boolean | undefined) => void,
): Promise<string> {
  const { base64, filename, hasAlpha } = await prepareImageForUpload(file, maxDim, format)
  onAlphaInfo?.(hasAlpha)
  const res = await httpClient.post<{ data: { url: string } }>(
    '/api/v1/admin/uploads/base64',
    { filename, data: base64 },
    { timeout: 120000 },
  )
  return res.data.data.url
}

/** content (DTO baca) -> form values (siap di-PATCH), memakai weddingDateRaw
 * sebagai nilai awal input datetime-local. */
export function toFormValues(content: InvitationContent): ContentFormValues {
  const rest = { ...content } as Partial<InvitationContent>
  const weddingDate = content.weddingDateRaw
  delete rest.weddingDateUnix
  delete rest.weddingDateLabel
  delete rest.weddingDateRaw
  return { ...(rest as Omit<InvitationContent, 'weddingDateUnix' | 'weddingDateLabel' | 'weddingDateRaw'>), weddingDate }
}
