// Kontrak JSON dari apps/api (PLAN.md §5.2/§5.4). Nama field cocok persis
// dengan JSON tag di Go (camelCase) - lihat
// apps/api/internal/modules/content/application/dto.go dan
// apps/api/internal/modules/guest/application/dto.go.

export interface InvitationContent {
  brideName: string
  brideParentsText: string
  brideInstagram: string
  bridePhotoUrl: string

  groomName: string
  groomParentsText: string
  groomInstagram: string
  groomPhotoUrl: string

  /** Epoch DETIK - satu-satunya sumber untuk countdown (keputusan #16). */
  weddingDateUnix: number
  /** Hanya untuk tampilan/teks QR, JANGAN dihitung ulang di frontend. */
  weddingDateLabel: string
  /** Format "2006-01-02T15:04" - untuk mengisi ulang form admin saja. */
  weddingDateRaw: string
  hashtag: string

  coverLogoUrl: string
  coverImageDesktopUrl: string
  coverImageMobileUrl: string

  quoteText: string

  thanksTitle: string
  thanksDescription: string

  musicUrl: string

  videoGalleryTitle: string
  videoGalleryYoutubeUrl: string
  videoGalleryCaption: string
  liveStreamingTitle: string
  liveStreamingYoutubeUrl: string

  instagramFilterTitle: string
  instagramFilterCaption: string
  instagramFilterPreviewPhotoUrl: string
  instagramFilterLink: string

  weddingGiftDescription: string

  dresscodeTitle: string
  dresscodeDescription: string
  dresscodeNote: string
  /** Satu gambar yang menggantikan ikon dress + palet warna di Agenda.tsx
   * (R4). String kosong = belum ada gambar, dan Agenda.tsx merender
   * bersyarat - jangan render <img src=""> untuk nilai ini. */
  dresscodeImageUrl: string

  /** Gambar khusus preview link WhatsApp/Facebook (og:image), landscape
   * ~1200x630. String kosong = belum diunggah, dan itu keadaan SAH: server
   * jatuh ke coverImageDesktopUrl, lalu ke tag statis index.html
   * (docs/plan/og-share-image-dinamis/PLAN.md K4). Nilai ini TIDAK dirender
   * di halaman undangan - hanya dipakai injeksi meta server-side. */
  shareImageUrl: string
}

export interface SectionEntry {
  key: string
  order: number
}

export interface AgendaEvent {
  id: number
  eventLabel: string
  timeLabel: string
  venueName: string
  venueAddress: string
  city: string
  mapsUrl: string
  sortOrder: number
}

export interface RundownItem {
  id: number
  groupLabel: string
  timeLabel: string
  activityText: string
  sortOrder: number
}

export interface GalleryPhoto {
  id: number
  photoUrl: string
  thumbUrl: string
  sortOrder: number
}

export interface LoveStoryChapter {
  id: number
  photoUrl: string
  title: string
  caption: string
  sortOrder: number
}

export interface WeddingGiftBank {
  id: number
  bankName: string
  accountNumber: string
  accountName: string
  sortOrder: number
}

export interface InvitationData {
  content: InvitationContent
  sections: SectionEntry[]
  agendaEvents: AgendaEvent[]
  rundownItems: RundownItem[]
  galleryPhotos: GalleryPhoto[]
  loveStoryChapters: LoveStoryChapter[]
  giftBanks: WeddingGiftBank[]
}

export type RsvpStatus = 'pending' | 'attending' | 'not_attending' | 'remind_later'

export interface GuestSession {
  name: string
  side: 'groom' | 'bride' | null
  status: RsvpStatus
  token: string | null
  // dashboard-wa-rsvp, koreksi ditemukan saat implementasi: tanpa ini,
  // tamu yang membuka ulang link setelah RSVP 'attending' tidak tahu
  // jumlah tamu yang sudah dikonfirmasi untuk menyusun ulang QR.
  attendingCount: number
  // Jatah kursi undangan ini (docs/plan/guest-pax-quota/PLAN.md D5). Menentukan
  // BENTUK pertanyaan di RsvpConfirmation: 1 = tidak ditanya sama sekali,
  // 2 = dua tombol seperti sebelumnya, >=3 = daftar tombol sampai batas jatah.
  paxQuota: number
  // Status ucapan milik tamu ini (docs/plan/wedding-wish/PLAN.md T13).
  // Menumpang respons by-token supaya komponen WeddingWish tahu form atau
  // kartu "Ucapan Anda" yang ditampilkan - tanpa permintaan tambahan.
  hasWish: boolean
  wishMessage: string
}

// PublicWish - satu ucapan di slider undangan
// (docs/plan/wedding-wish/PLAN.md T13). Nama field cocok persis dengan JSON
// tag PublicWishDTO di backend (camelCase).
export interface PublicWish {
  id: number
  guestName: string
  guestSide: 'groom' | 'bride'
  message: string
  createdAt: string
}

// RsvpUpdateResponse - respons PATCH /public/guests/by-token/:token/rsvp
// (dashboard-wa-rsvp §6.5). qrPayload kosong untuk status selain 'attending'.
export interface RsvpUpdateResponse {
  qrPayload: string
}

export interface ApiEnvelope<T> {
  success: boolean
  message?: string
  data: T
  errors?: unknown
}
