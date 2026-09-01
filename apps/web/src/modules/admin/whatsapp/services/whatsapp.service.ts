import { httpClient } from '@/shared/services/http-client'

export interface WhatsAppStatus {
  loggedIn: boolean
  pairing: boolean
  pairingQR: string
  pairingError: string
}

export interface WhatsAppConfig {
  messageTemplate: string
  isEnabled: boolean
}

export type SendLogStatus = 'pending' | 'sent' | 'failed'

export interface SendLog {
  id: number
  guestId: number
  guestName: string
  phone: string
  attendingCount: number
  status: SendLogStatus
  errorMessage: string | null
  sentAt: string | null
  createdAt: string
}

export interface ListLogsResponse {
  data: SendLog[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

interface ApiListLogsResponse {
  data: SendLog[]
  meta: { page: number; limit: number; total: number; total_pages: number }
}

export async function getStatus(): Promise<WhatsAppStatus> {
  const res = await httpClient.get<{ data: WhatsAppStatus }>('/api/v1/admin/whatsapp/status')
  return res.data.data
}

export async function startPairing(): Promise<void> {
  await httpClient.post('/api/v1/admin/whatsapp/pair/start')
}

export async function logout(): Promise<void> {
  await httpClient.post('/api/v1/admin/whatsapp/logout')
}

export async function getConfig(): Promise<WhatsAppConfig> {
  const res = await httpClient.get<{ data: WhatsAppConfig }>('/api/v1/admin/whatsapp/config')
  return res.data.data
}

export async function updateConfig(input: WhatsAppConfig): Promise<void> {
  await httpClient.put('/api/v1/admin/whatsapp/config', input)
}

// Pemetaan total_pages -> totalPages mengikuti pola yang sama dengan
// guests.service.ts:listGuests (backend selalu snake_case, api-standard.md).
export async function listLogs(page: number): Promise<ListLogsResponse> {
  const res = await httpClient.get<ApiListLogsResponse>('/api/v1/admin/whatsapp/logs', {
    params: { page },
  })
  return {
    data: res.data.data,
    meta: {
      page: res.data.meta.page,
      limit: res.data.meta.limit,
      total: res.data.meta.total,
      totalPages: res.data.meta.total_pages,
    },
  }
}

export async function resendLog(id: number): Promise<void> {
  await httpClient.post(`/api/v1/admin/whatsapp/logs/${id}/resend`)
}
