import { httpClient } from '@/shared/services/http-client'

export interface TelegramStatus {
  /** Sesi tersimpan & masih sah di server. */
  loggedIn: boolean
  /** Pemeriksaan terakhir berhasil terhubung. Klien one-shot terhubung per
   * operasi, jadi tidak ada socket persisten seperti WhatsApp. */
  connected: boolean
  /** Kode OTP sudah dikirim dan menunggu dilengkapi lewat login/complete. */
  loginPending: boolean
  /** Alasan kegagalan login terakhir, string kosong bila tidak ada. */
  loginError: string
  /** RFC3339, string kosong bila belum pernah terhubung sejak boot. */
  lastConnectedAt: string | null
  /** Alasan gangguan terakhir, string kosong bila sehat. */
  lastError: string
}

export interface TelegramConfig {
  /** Template pesan QR otomatis (dikirim userbot sesudah tamu RSVP).
   * Placeholder: {nama}, {jumlah}, {mempelai}, {tanggal} - SAMA dengan
   * jalur WA supaya admin tidak menghafal dua kamus. */
  messageTemplate: string
  /** Template pesan undangan untuk tombol kirim per tamu di menu Tamu,
   * dikirim sebagai TEKS lewat userbot. Placeholder: {nama}, {mempelai},
   * {tanggal}, {link} - TANPA {jumlah}, karena saat undangan dikirim tamu
   * belum RSVP. Cermin invitationTemplate milik WhatsApp. */
  invitationTemplate: string
  /** Mengatur pengiriman QR otomatis Telegram. */
  isEnabled: boolean
}

export type SendLogStatus = 'pending' | 'sent' | 'failed' | 'retrying'

export interface SendLog {
  id: number
  guestId: number
  guestName: string
  telegramUsername: string
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

export async function getStatus(): Promise<TelegramStatus> {
  const res = await httpClient.get<{ data: TelegramStatus }>('/api/v1/admin/telegram/status')
  return res.data.data
}

export async function startLogin(): Promise<{ phone: string }> {
  const res = await httpClient.post<{ data: { phone: string } }>('/api/v1/admin/telegram/login/start')
  return res.data.data
}

export async function completeLogin(code: string, password: string): Promise<void> {
  await httpClient.post('/api/v1/admin/telegram/login/complete', { code, password })
}

export async function logout(): Promise<{ remoteRevoked: boolean }> {
  const res = await httpClient.post<{ data: { remoteRevoked: boolean } }>('/api/v1/admin/telegram/logout')
  return res.data.data
}

export async function getConfig(): Promise<TelegramConfig> {
  const res = await httpClient.get<{ data: TelegramConfig }>('/api/v1/admin/telegram/config')
  return res.data.data
}

export async function updateConfig(input: TelegramConfig): Promise<void> {
  await httpClient.put('/api/v1/admin/telegram/config', input)
}

// Pemetaan total_pages -> totalPages mengikuti pola yang sama dengan
// whatsapp.service.ts:listLogs (backend selalu snake_case, api-standard.md).
export async function listLogs(page: number): Promise<ListLogsResponse> {
  const res = await httpClient.get<ApiListLogsResponse>('/api/v1/admin/telegram/logs', {
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
  await httpClient.post(`/api/v1/admin/telegram/logs/${id}/resend`)
}
