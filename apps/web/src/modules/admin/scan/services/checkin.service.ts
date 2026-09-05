import { httpClient } from '@/shared/services/http-client'

/**
 * Kontrak menu Scan (docs/plan/scan-checkin-gate/PLAN.md T15). Semua lewat
 * `httpClient` - satu instance Axios, sesuai frontend-react.md.
 *
 * Bentuknya cermin CheckinResultDTO/CheckinSearchItemDTO di backend, yang
 * SENGAJA tidak membawa phone/email/address/notes/token: akun petugas gate
 * tidak boleh menerima kredensial undangan tamu mana pun (D3).
 */
export interface CheckinResult {
  id: number
  name: string
  side: string
  invitationType: string
  souvenirType: string
  rsvpStatus: string
  attendingCount: number
  /** RFC3339, bukan teks siap tampil - diformat di layar. */
  checkedInAt: string
  /** true = tamu ini SUDAH pernah check-in; jangan dihitung ganda (K3). */
  alreadyCheckedIn: boolean
  /** Nama group tamu, sudah di-resolve DI SERVER (docs/plan/guest-groups
   * PLAN.md D8) - akun petugas tidak bisa memanggil /api/v1/admin/groups
   * untuk memetakannya sendiri, seluruh prefix itu dijaga RequireFullAdmin.
   *
   * String kosong bila tamu belum bergroup ATAU bila pembacaan group gagal
   * (D9) - kegagalan itu tidak pernah menggagalkan check-in, jadi layar WAJIB
   * tetap utuh saat field ini kosong. */
  groupName: string
}

export interface CheckinSearchItem {
  id: number
  name: string
  side: string
  rsvpStatus: string
  attendingCount: number
  checkedIn: boolean
}

interface Envelope<T> {
  success: boolean
  message: string
  data: T
}

/** Mengirim isi QR mentah apa adanya - backend yang memutuskan sah/tidak
 * (parseCheckinCode), supaya aturan prefiks hanya punya satu penegak. */
export async function scanCode(code: string): Promise<CheckinResult> {
  const res = await httpClient.post<Envelope<CheckinResult>>('/api/v1/admin/checkin/scan', { code })
  return res.data.data
}

export async function checkinById(id: number): Promise<CheckinResult> {
  const res = await httpClient.post<Envelope<CheckinResult>>(`/api/v1/admin/checkin/${id}`)
  return res.data.data
}

/** Hasil sudah dibatasi 20 baris di backend dan TIDAK berpaginasi - tidak ada
 * `meta` pada responsnya. */
export async function searchGuests(q: string): Promise<CheckinSearchItem[]> {
  const res = await httpClient.get<Envelope<CheckinSearchItem[]>>('/api/v1/admin/checkin/search', {
    params: { q },
  })
  return res.data.data ?? []
}

/** Satu baris menu "Tamu Masuk". Sama seperti dua tipe di atas: tanpa
 * phone/email/token - akun petugas tidak pernah menerimanya dari server. */
export interface ArrivalItem {
  id: number
  name: string
  side: string
  souvenirType: string
  attendingCount: number
  /** RFC3339. Diformat jadi jam di layar, bukan dikirim siap-tampil. */
  checkedInAt: string
}

/** Angka kartu ringkasan gate.
 *
 * `arrived*` dan `totalGuests` satu satuan: BARIS TAMU (undangan), jadi
 * "12 dari 80" selalu apple-to-apple. `arrivedPax` beda satuan (ORANG) dan
 * berasal dari `attendingCount` yang DIJANJIKAN tamu saat RSVP - bukan hitung
 * kepala di pintu, karena sistem ini memang tidak merekamnya. Labelnya di UI
 * harus jujur soal itu. */
export interface CheckinSummary {
  arrivedGroom: number
  arrivedBride: number
  arrivedTotal: number
  arrivedPax: number
  totalGuests: number
}

interface PaginatedEnvelope<T> {
  success: boolean
  message: string
  data: T
  meta: { page: number; limit: number; total: number; total_pages: number }
}

export interface ArrivalsPage {
  data: ArrivalItem[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export async function listArrivals(page: number, limit = 20): Promise<ArrivalsPage> {
  const res = await httpClient.get<PaginatedEnvelope<ArrivalItem[]>>('/api/v1/admin/checkin/arrivals', {
    params: { page, limit },
  })
  const m = res.data.meta
  return {
    data: res.data.data ?? [],
    meta: { page: m.page, limit: m.limit, total: m.total, totalPages: m.total_pages },
  }
}

export async function getCheckinSummary(): Promise<CheckinSummary> {
  const res = await httpClient.get<Envelope<CheckinSummary>>('/api/v1/admin/checkin/summary')
  return res.data.data
}
