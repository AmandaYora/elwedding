import { httpClient } from '@/shared/services/http-client'
import { PAGE_SIZE, type RsvpStatus, type Gender, type InvitationType, type SouvenirType, type Side } from '@/shared/constants/guests'

export interface Guest {
  id: number
  name: string
  phone: string
  side: Side
  token: string
  rsvpStatus: RsvpStatus
  rsvpRespondedAt: string | null
  createdAt: string
  gender: Gender | null
  invitationType: InvitationType
  souvenirType: SouvenirType
  email: string
  address: string
  notes: string
  attendingCount: number
  isExpectedAttending: boolean
  /** JATAH kursi undangan ini, diisi ADMIN (docs/plan/guest-pax-quota).
   * Jangan tertukar dengan `attendingCount` di atas: itu JANJI tamu, diisi
   * tamu sendiri saat RSVP. `attendingCount` tidak pernah melebihi ini. */
  paxQuota: number
  /** Kapan admin membuka WhatsApp lewat tombol "Kirim Undangan". `null` =
   * belum pernah dihubungi.
   *
   * BUKAN bukti pesan terkirim — wa.me tidak bisa melaporkan balik apa pun,
   * jadi yang tercatat hanyalah bahwa admin membuka WhatsApp untuk tamu ini.
   * Label di UI harus berbunyi "Dihubungi", jangan pernah "Terkirim". */
  contactedAt: string | null
  /** null = tamu lama yang belum pernah disunting sejak migration 000016
   * (guest-groups §2.6). Namanya dipetakan di halaman dari daftar group yang
   * sudah dimuat sekali (D2) - backend sengaja hanya mengirim id-nya. */
  groupId: number | null
}

export interface GuestInput {
  name: string
  phone: string
  side: Side
  gender: Gender
  invitationType: InvitationType
  souvenirType: SouvenirType
  email: string
  address: string
  notes: string
  isExpectedAttending: boolean
  /** WAJIB terisi (>0). Bukan `| null`: form tidak boleh mengirim tamu tanpa
   * group, dan backend menolaknya juga (D4). */
  groupId: number
  /** WAJIB 1..20. Terisi otomatis dari `defaultPax` group saat admin memilih
   * group, lalu boleh diubah untuk tamu yang jumlahnya berbeda. */
  paxQuota: number
}

// RecentResponse - satu baris kartu "Aktivitas RSVP terbaru" (dashboard-
// wa-rsvp §3.2).
export interface RecentResponse {
  name: string
  rsvpStatus: RsvpStatus
  attendingCount: number
  respondedAt: string
}

export interface GuestSummary {
  total: number
  attending: number
  notAttending: number
  remindLater: number
  pending: number
  invitationOnline: number
  invitationPhysical: number
  souvenirRegular: number
  souvenirVip: number
  attendingPax: number
  sideGroom: number
  sideBride: number
  genderMale: number
  genderFemale: number
  recentResponses: RecentResponse[]

  /** Proyeksi catering (docs/plan/guest-pax-quota/PLAN.md §5).
   *
   * Ketiganya berSATUAN ORANG, beda satuan dengan `total`/`sideGroom`/
   * `sideBride` di atas yang menghitung UNDANGAN. Jangan pernah disandingkan
   * sebagai "X dari Y".
   *
   * `confirmed*` FAKTA (tamu sudah menjawab hadir), `expected*` TEBAKAN (tamu
   * belum menjawab, dipakai jatahnya). `projected*` menjumlahkan keduanya -
   * dan justru karena ia campuran, UI wajib menampilkan ketiga barisnya. */
  confirmedPaxGroom: number
  confirmedPaxBride: number
  confirmedPaxTotal: number
  expectedPaxGroom: number
  expectedPaxBride: number
  expectedPaxTotal: number
  projectedPaxGroom: number
  projectedPaxBride: number
  projectedPaxTotal: number
  /** BerSATUAN UNDANGAN (bukan orang) dan tidak dipecah per pihak. Ada supaya
   * tidak ada tamu yang hilang diam-diam dari total. */
  excludedNotAttending: number
  excludedNotExpected: number
}

/**
 * Parameter listGuests sebagai satu objek (guest-fields-admin-layout
 * keputusan #19): dengan 4 filter string berurutan, versi posisional
 * membuat menukar 2 argumen apa pun tidak terdeteksi compiler.
 */
export interface GuestListParams {
  page: number
  status: string
  q: string
  invitationType: string
  souvenirType: string
  /** String kosong = tanpa filter, sama seperti dua filter di atasnya.
   * Dikirim sebagai `group_id` (snake_case) hanya bila terisi. */
  groupId: string
  respondedOnly: boolean
}

interface ApiListResponse {
  data: Guest[]
  meta: { page: number; limit: number; total: number; total_pages: number }
}

export interface ListResponse {
  data: Guest[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Perbaikan T1 (admin-ui-redesign/PLAN.md §2.3): backend mengirim
 * `total_pages` (snake_case, dikunci api-standard.md), bukan `totalPages`.
 * Dipetakan di SATU tempat ini, bukan diubah di envelope backend
 * (keputusan #12).
 */
export async function listGuests(params: GuestListParams): Promise<ListResponse> {
  const { page, status, q, invitationType, souvenirType, groupId, respondedOnly } = params
  const res = await httpClient.get<ApiListResponse>('/api/v1/admin/guests', {
    params: {
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
      ...(invitationType ? { invitation_type: invitationType } : {}),
      ...(souvenirType ? { souvenir_type: souvenirType } : {}),
      ...(groupId ? { group_id: groupId } : {}),
      ...(respondedOnly ? { responded: 'true' } : {}),
    },
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

export async function getGuestSummary(): Promise<GuestSummary> {
  const res = await httpClient.get<{ data: GuestSummary }>('/api/v1/admin/guests/summary')
  return res.data.data
}

export async function createGuest(input: GuestInput): Promise<Guest> {
  const res = await httpClient.post<{ data: Guest }>('/api/v1/admin/guests', input)
  return res.data.data
}

export async function updateGuest(id: number, input: GuestInput): Promise<void> {
  await httpClient.put(`/api/v1/admin/guests/${id}`, input)
}

export async function deleteGuest(id: number): Promise<void> {
  await httpClient.delete(`/api/v1/admin/guests/${id}`)
}

/**
 * Menghapus RESERVASI, bukan tamunya (docs/plan/reservation-reset-contacted-flag
 * /PLAN.md K1). Baris tamu, token, dan QR-nya tetap utuh — statusnya balik ke
 * 'pending' sehingga tamu bisa mengisi RSVP lagi lewat link yang sama.
 *
 * Jangan tertukar dengan `deleteGuest` di atas, yang benar-benar menghapus
 * tamunya. Perbedaan keduanya cuma satu segmen di URL, jadi mudah salah pakai.
 */
export async function resetRsvp(id: number): Promise<void> {
  await httpClient.delete(`/api/v1/admin/guests/${id}/rsvp`)
}

/** Menyalakan/mematikan penanda "sudah dihubungi". Dipanggil otomatis saat
 * admin menekan "Kirim Undangan" (`true`), dan saat ia membatalkan penandanya
 * (`false`). */
export async function setContacted(id: number, contacted: boolean): Promise<void> {
  await httpClient.patch(`/api/v1/admin/guests/${id}/contacted`, { contacted })
}
