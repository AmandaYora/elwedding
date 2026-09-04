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

/** Khusus musik latar (audio) - jalur multipart lama dipertahankan apa
 * adanya (docs/plan/admin-content-upload-base64/PLAN.md keputusan K2).
 * JANGAN dipakai untuk foto - lihat uploadImageBase64 di bawah. */
export async function uploadAudioFile(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await httpClient.post<{ data: { url: string } }>('/api/v1/admin/uploads', formData)
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
