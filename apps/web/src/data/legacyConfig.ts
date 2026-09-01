import type { KadoDataConfig, RsvpConfig, RsvpDataConfig } from '@/types/legacy'

/**
 * Sisa config platform lama yang TIDAK dipindah ke backend (di luar scope
 * PLAN.md §4): widget RSVP/gift/guestbook lama tetap tidak berfungsi persis
 * seperti sebelumnya (README.md - butuh backend PHP live yang tidak ada).
 *
 * Nilai yang DULU statis di sini (music, eventTimestamp, bankOptions,
 * covers, manageSectionEnabled, invitationLayouts) sekarang datang dari API
 * (`useInvitationData`) dan disusun langsung di `useLegacyBootstrap.ts` -
 * lihat PLAN.md §5.3/§5.1.
 */

export const rsvp: RsvpConfig = {
  button_text: {
    attend: 'Will Attend',
    not_attend: 'Unable To Attend',
  },
}

export const rsvpData: RsvpDataConfig = {
  post: 'rsvp_request',
  request: 'get_rsvp',
  content: '',
  template: 'template_arsya',
  changeButton: '#changeRSVP',
  amountElement: '#rsvpAmountWrap',
}

export const kadoData: KadoDataConfig = {
  post: 'post_kado_data',
  request: 'getKado',
  content: '',
  template: 'template_arsya',
}

export const langId = false as const

export const croppedSong = { start: null as number | null, end: null as number | null }

export const languageToggle = 0

export const defaultLang = 'EN'

// Dipertahankan apa adanya (PLAN.md F10) - config platform lama yang tidak
// pernah diverifikasi bekerja untuk hide section (beda dengan
// INVITATION_LAYOUTS yang terbukti dipakai untuk reorder, lihat keputusan
// #6/#7). Section yang di-disable ditangani lewat "tidak dirender React
// sama sekali" (keputusan #7), bukan lewat mekanisme ini.
export const sectionHiddenClass: Record<string, string> = {
  greet_thanks: '',
  love_story: '',
  gallery_photo: '',
  gallery_video: '',
  rsvp: '',
  live_streaming: '',
  filter_instagram: '',
  health_protocol: '',
  save_the_date: '',
}
