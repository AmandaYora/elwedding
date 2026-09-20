// Menyatukan angka ukuran halaman yang tadinya tersebar di 3 tempat
// (guests.service.ts:27, GuestsPage.tsx:186,188 - admin-ui-redesign
// PLAN.md §2.3) dan label status RSVP Bahasa Indonesia.

export const PAGE_SIZE = 20

export type RsvpStatus = 'pending' | 'attending' | 'not_attending' | 'remind_later'

export const STATUS_LABEL: Record<RsvpStatus, string> = {
  pending: 'Belum jawab',
  attending: 'Hadir',
  not_attending: 'Tidak hadir',
  remind_later: 'Perlu diingatkan',
}

export const STATUS_OPTIONS: RsvpStatus[] = ['attending', 'not_attending', 'remind_later', 'pending']

// Sub-filter status di menu Reservasi (guest-reservation-split) - semua
// STATUS_OPTIONS KECUALI 'pending', karena Reservasi hanya berisi tamu yang
// sudah merespons RSVP.
export const RESPONDED_STATUS_OPTIONS: RsvpStatus[] = ['attending', 'not_attending', 'remind_later']

// Filter "Tahap undangan" di /admin/guests (docs/plan/guest-stage-filter).
//
// GABUNGAN dua dimensi yang di database tersimpan terpisah: apakah admin sudah
// menghubungi tamu (guests.contacted_at) dan apa jawaban RSVP-nya
// (guests.rsvp_status). Itu sebabnya satu pilihan dropdown diterjemahkan jadi
// SEPASANG parameter API, bukan satu.

/** Nilai param `contacted`. String kosong = tanpa filter, sama seperti filter
 * lain. Backend hanya menerima ketiga nilai ini dan MENOLAK sisanya dengan 400
 * (parseContactedFilter) - salah ketik tidak boleh diam-diam berarti
 * "tampilkan semua". */
export type ContactedFilter = '' | 'true' | 'false'

export type GuestStage =
  | 'not_invited'
  | 'awaiting_confirmation'
  | 'confirmed_attending'
  | 'confirmed_not_attending'
  | 'remind_later'

// STAGE_LABEL sengaja TERPISAH dari STATUS_LABEL di atas, bukan duplikasi yang
// terlewat. Badge di baris tabel harus ringkas supaya muat di kolom sempit
// ("Hadir", "Belum jawab"), sedangkan dropdown filter punya ruang dan justru
// butuh menyebut tahapannya ("Konfirmasi hadir" vs "Belum diundang").
// Menyatukan keduanya memaksa salah satunya berkompromi.
export const STAGE_LABEL: Record<GuestStage, string> = {
  not_invited: 'Belum diundang',
  awaiting_confirmation: 'Menunggu konfirmasi',
  confirmed_attending: 'Konfirmasi hadir',
  confirmed_not_attending: 'Konfirmasi tidak hadir',
  remind_later: 'Minta diingatkan kembali',
}

export const STAGE_OPTIONS: GuestStage[] = [
  'not_invited',
  'awaiting_confirmation',
  'confirmed_attending',
  'confirmed_not_attending',
  'remind_later',
]

/**
 * Terjemahan satu pilihan dropdown -> sepasang parameter API. SATU-SATUNYA
 * tempat definisi kelima kategori hidup di frontend.
 *
 * Perhatikan bahwa `contacted` hanya membedakan DI DALAM 'pending'. Itu aturan
 * "jawaban tamu menang": tamu yang sudah menjawab apa pun jelas sudah diundang,
 * jadi ia masuk kategori jawabannya - walau contacted_at-nya kosong karena
 * undangannya dikirim di luar aplikasi (japri, lisan, undangan fisik).
 * Konsekuensinya kelima kategori ini adalah PARTISI KETAT: setiap tamu jatuh ke
 * tepat satu kategori, dan jumlah kelimanya selalu sama dengan total tamu.
 */
export const STAGE_QUERY: Record<GuestStage, { status: RsvpStatus; contacted: ContactedFilter }> = {
  not_invited: { status: 'pending', contacted: 'false' },
  awaiting_confirmation: { status: 'pending', contacted: 'true' },
  confirmed_attending: { status: 'attending', contacted: '' },
  confirmed_not_attending: { status: 'not_attending', contacted: '' },
  remind_later: { status: 'remind_later', contacted: '' },
}

// Field profil tamu (guest-fields-admin-layout).

export type Gender = 'male' | 'female'
export type InvitationType = 'online' | 'physical'
export type SouvenirType = 'regular' | 'vip'
export type Side = 'groom' | 'bride'

export const GENDER_LABEL: Record<Gender, string> = {
  male: 'Pria',
  female: 'Wanita',
}

export const GENDER_OPTIONS: Gender[] = ['male', 'female']

export const INVITATION_TYPE_LABEL: Record<InvitationType, string> = {
  online: 'Online',
  physical: 'Fisik',
}

export const INVITATION_TYPE_OPTIONS: InvitationType[] = ['online', 'physical']

export const SOUVENIR_TYPE_LABEL: Record<SouvenirType, string> = {
  regular: 'Souvenir reguler',
  vip: 'Souvenir VIP',
}

export const SOUVENIR_TYPE_OPTIONS: SouvenirType[] = ['regular', 'vip']

// SIDE_LABEL (keputusan #17): `side` berarti PIHAK MEMPELAI, bukan gender
// tamu. GuestsPage lama merender "Pria"/"Wanita" untuk kolom ini - begitu
// `gender` (yang label aslinya memang Pria/Wanita) ikut ditampilkan, dua
// kolom berbeda makna akan punya label identik. Label di bawah ini
// disengaja panjang untuk mencegah salah baca data.
export const SIDE_LABEL: Record<Side, string> = {
  groom: 'Mempelai Pria',
  bride: 'Mempelai Wanita',
}

export const SIDE_OPTIONS: Side[] = ['groom', 'bride']

// Label toggle "Diperkirakan hadir" (dashboard-wa-rsvp keputusan #1/#2) -
// dugaan admin, kolom terpisah dari rsvp_status milik tamu.
export const EXPECTED_ATTENDING_LABEL = 'Diperkirakan hadir'
export const EXPECTED_ATTENDING_DESCRIPTION =
  'Matikan bila Anda sudah tahu tamu ini kemungkinan tidak akan datang. Ini hanya label perkiraan, bukan jawaban RSVP tamu.'
