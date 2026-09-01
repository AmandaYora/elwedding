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
