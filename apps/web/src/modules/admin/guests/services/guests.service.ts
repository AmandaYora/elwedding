import { httpClient } from '@/shared/services/http-client'
import { PAGE_SIZE, type RsvpStatus, type Gender, type InvitationType, type SouvenirType, type Side, type ContactedFilter } from '@/shared/constants/guests'

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
  /** Username Telegram tamu TANPA @ ("" = tidak punya). Dipakai pengiriman
   * QR otomatis lewat userbot Telegram saat tamu RSVP 'attending' - cermin
   * `phone` untuk WhatsApp. */
  usernameTelegram: string
  address: string
  notes: string
  attendingCount: number
  isExpectedAttending: boolean
  /** JATAH kursi undangan ini, diisi ADMIN (docs/plan/guest-pax-quota).
   * Jangan tertukar dengan `attendingCount` di atas: itu JANJI tamu, diisi
   * tamu sendiri saat RSVP. `attendingCount` tidak pernah melebihi ini. */
  paxQuota: number
  /** Kapan admin menghubungi tamu. `null` = belum pernah dihubungi.
   *
   * Dulu ini hanya berarti "admin membuka WhatsApp" (jalur wa.me murni klien
   * yang tidak bisa membuktikan pengiriman). Sejak undangan dikirim lewat
   * modul WhatsApp/Telegram, sukses kirim server-side MENYALAKANNYA otomatis -
   * pesannya benar-benar diterima server WA/TG. Tetap bisa dibatalkan manual
   * bila salah. */
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
  /** Opsional: "" = tamu tidak punya Telegram dan dilewati jalur kirim
   * Telegram. Boleh diawali @, dinormalisasi backend. */
  usernameTelegram: string
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
  /** Filter penanda "sudah dihubungi" (docs/plan/guest-stage-filter T8).
   * Dikirim sebagai `contacted` hanya bila terisi.
   *
   * OPSIONAL, menyimpang dari 7 field di atas yang wajib (D9). Alasannya
   * bukan gaya: ada 18 literal listGuests({...}) di repo ini, termasuk di
   * ReservationsPage dan tes yang mencocokkan argumen dengan
   * toHaveBeenCalledWith({...}) yang PERSIS. Field wajib memaksa ~16
   * suntingan mekanis tanpa manfaat, dan yang lebih penting: dengan
   * opsional, pemanggil yang tidak menyaring tetap mengirim objek yang
   * identik dengan sebelum fitur ini ada. */
  contacted?: ContactedFilter
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
  const { page, status, q, invitationType, souvenirType, groupId, respondedOnly, contacted } = params
  const res = await httpClient.get<ApiListResponse>('/api/v1/admin/guests', {
    params: {
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
      ...(invitationType ? { invitation_type: invitationType } : {}),
      ...(souvenirType ? { souvenir_type: souvenirType } : {}),
      ...(groupId ? { group_id: groupId } : {}),
      ...(contacted ? { contacted } : {}),
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
 * undangan terkirim lewat modul (`true`), saat admin menandai manual
 * (`true`), dan saat ia membatalkan penandanya (`false`). */
export async function setContacted(id: number, contacted: boolean): Promise<void> {
  await httpClient.patch(`/api/v1/admin/guests/${id}/contacted`, { contacted })
}

/** Kanal undangan manual per tamu: `wa` lewat modul WhatsApp (whatsmeow),
 * `tg` lewat userbot Telegram. */
export type InvitationChannel = 'wa' | 'tg'

/** Preview undangan yang di-render server dari template milik modul pengirim
 * (source of truth) - ditampilkan di modal sebelum admin menekan Kirim. */
export interface InvitationPreview {
  channel: InvitationChannel
  /** Nomor HP tujuan (wa) atau `@username` (tg). */
  target: string
  text: string
}

/** Mengambil preview pesan undangan untuk satu tamu. Tanpa efek samping. */
export async function previewInvitation(id: number, channel: InvitationChannel): Promise<InvitationPreview> {
  const res = await httpClient.get<{ data: InvitationPreview }>(`/api/v1/admin/guests/${id}/invitation-preview`, {
    params: { channel },
  })
  return res.data.data
}

/** Mengirim undangan lewat modul pengirim. Sukses otomatis menyalakan
 * penanda contacted_at di server; gagal melempar pesan yang layak tampil di
 * modal (template kosong, belum tertaut, koneksi belum siap, ...). */
export async function sendInvitation(id: number, channel: InvitationChannel): Promise<void> {
  await httpClient.post(`/api/v1/admin/guests/${id}/send-invitation`, { channel })
}
