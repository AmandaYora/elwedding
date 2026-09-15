import { httpClient } from '@/shared/services/http-client'

export interface WhatsAppStatus {
  loggedIn: boolean
  /** Socket hidup. Dipisah dari loggedIn (keputusan D3): sesi bisa ada
   * sementara socket mati, dan itulah akar defect koneksi ini. */
  connected: boolean
  pairing: boolean
  pairingQR: string
  pairingError: string
  /** RFC3339, string kosong bila belum pernah terhubung sejak boot. */
  lastConnectedAt: string | null
  /** Alasan gangguan terakhir, string kosong bila sehat. */
  lastError: string
}

export interface WhatsAppConfig {
  /** Template pesan QR otomatis (dikirim modul whatsapp/whatsmeow sesudah
   * tamu RSVP). Placeholder: {nama}, {jumlah}, {mempelai}, {tanggal}. */
  messageTemplate: string
  /** Template pesan undangan untuk tombol "Kirim Undangan" per tamu, yang
   * murni klien lewat wa.me. Placeholder: {nama}, {mempelai}, {tanggal},
   * {link} - TANPA {jumlah}, karena saat undangan dikirim tamu belum RSVP
   * (docs/plan/og-share-image-dinamis/PLAN.md K5). */
  invitationTemplate: string
  /** HANYA mengatur pengiriman QR otomatis - BUKAN tombol Kirim Undangan
   * (D12). */
  isEnabled: boolean
}

export type SendLogStatus = 'pending' | 'sent' | 'failed' | 'retrying'

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

export async function logout(): Promise<{ remoteRevoked: boolean }> {
  const res = await httpClient.post<{ data: { remoteRevoked: boolean } }>('/api/v1/admin/whatsapp/logout')
  return res.data.data
}

export async function reconnect(): Promise<void> {
  await httpClient.post('/api/v1/admin/whatsapp/reconnect')
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
