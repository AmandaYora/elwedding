import { httpClient } from '@/shared/services/http-client'
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

export async function uploadPhoto(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await httpClient.post<{ data: { url: string } }>('/api/v1/admin/uploads', formData)
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
