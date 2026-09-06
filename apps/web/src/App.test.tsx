import { render, screen } from '@testing-library/react'
import type { InvitationData } from '@/types/api'
import App from './App'
import { useInvitationData } from '@/hooks/useInvitationData'
import { useGuestSession, type GuestAccess } from '@/hooks/useGuestSession'

vi.mock('@/hooks/useInvitationData', () => ({ useInvitationData: vi.fn() }))
vi.mock('@/hooks/useLegacyBootstrap', () => ({ useLegacyBootstrap: vi.fn() }))
vi.mock('@/hooks/useGuestSession', () => ({ useGuestSession: vi.fn() }))

const mockedUseInvitationData = vi.mocked(useInvitationData)
const mockedUseGuestSession = vi.mocked(useGuestSession)

/** Undangan kini digerbangi token tamu, jadi setiap test yang mengharapkan
 * isinya WAJIB menyatakan aksesnya diberikan - kalau tidak, yang dirender
 * adalah GuestGate. */
function setAccess(access: GuestAccess) {
  mockedUseGuestSession.mockReturnValue({
    name: 'Tamu Undangan', side: null, status: 'pending',
    token: access === 'granted' ? 'tok' : null,
    attendingCount: 1, paxQuota: 2, resolved: access === 'granted', access,
  })
}

const baseContent: InvitationData['content'] = {
  brideName: 'Siti', brideParentsText: '', brideInstagram: '', bridePhotoUrl: '',
  groomName: 'Budi', groomParentsText: '', groomInstagram: '', groomPhotoUrl: '',
  weddingDateUnix: 1778904000, weddingDateLabel: 'Saturday, 16 May 2026', weddingDateRaw: '',
  hashtag: '', coverLogoUrl: '', coverImageDesktopUrl: '', coverImageMobileUrl: '',
  quoteText: 'Cinta itu indah', thanksTitle: '', thanksDescription: '', musicUrl: '',
  videoGalleryTitle: '', videoGalleryYoutubeUrl: '', videoGalleryCaption: '',
  liveStreamingTitle: '', liveStreamingYoutubeUrl: '',
  instagramFilterTitle: '', instagramFilterCaption: '', instagramFilterPreviewPhotoUrl: '', instagramFilterLink: '',
  weddingGiftDescription: '', dresscodeTitle: '', dresscodeDescription: '', dresscodeNote: '', dresscodeImageUrl: '', shareImageUrl: '',
}

const data: InvitationData = {
  content: baseContent,
  // "cover" sengaja TIDAK diikutkan - mensimulasikan section yang di-disable
  // admin (backend tidak pernah mengirim entry untuk section disabled,
  // keputusan #7 PLAN.md).
  sections: [
    { key: 'quote', order: 1 },
    { key: 'couple', order: 2 },
  ],
  agendaEvents: [],
  rundownItems: [],
  galleryPhotos: [],
  loveStoryChapters: [],
  giftBanks: [],
}

beforeEach(() => {
  setAccess('granted')
})

afterEach(() => {
  mockedUseInvitationData.mockReset()
  mockedUseGuestSession.mockReset()
})

test('loading -> tidak merender apa pun (null), bukan loading screen sendiri', () => {
  mockedUseInvitationData.mockReturnValue({ data: null, loading: true, error: false })
  const { container } = render(<App />)
  expect(container).toBeEmptyDOMElement()
})

test('error -> tampilkan pesan error, bukan crash', () => {
  mockedUseInvitationData.mockReturnValue({ data: null, loading: false, error: true })
  render(<App />)
  expect(screen.getByText(/Gagal memuat undangan/)).toBeInTheDocument()
})

test('section yang tidak ada di data.sections tidak dirender; urutan sesuai data; TIDAK ada footer/copyright', () => {
  mockedUseInvitationData.mockReturnValue({ data, loading: false, error: false })
  const { container } = render(<App />)

  const secondaryPane = container.querySelector('.secondary-pane')
  expect(secondaryPane).toBeInTheDocument()

  // "cover" section tidak ada di data.sections -> tidak boleh muncul.
  expect(container.querySelector('[data-section-order="cover"]')).not.toBeInTheDocument()

  // "quote" dan "couple" ada, dan urutannya (order 1, 2) sesuai DOM.
  const rendered = [...secondaryPane!.children].map((el) => el.getAttribute('data-section-order'))
  expect(rendered).toEqual(['quote', 'couple'])

  // Footer template dihapus atas permintaan user - tidak boleh ada copyright
  // sama sekali di bagian bawah undangan.
  expect(container.querySelector('[data-section-footer]')).not.toBeInTheDocument()
  expect(container.textContent).not.toMatch(/©|copyright/i)
})

// --- gerbang token tamu ---
// Undangan ini bukan halaman publik: identitas tamu, status RSVP, dan QR
// check-in semuanya berasal dari `?guest=<token>`. Tanpa token tidak ada
// "tamu" yang bisa ditampilkan sama sekali.

test('akses ditolak -> layar "tidak terdaftar" menyebut nama mempelai, bukan undangan', () => {
  setAccess('denied')
  mockedUseInvitationData.mockReturnValue({ data, loading: false, error: false })

  const { container } = render(<App />)

  expect(screen.getByText(/tidak terdaftar dalam list undangan/i)).toBeInTheDocument()
  // Urutan mempelai pria dulu, sama dengan Cover/TopCover/meta OG.
  expect(screen.getByText('Budi dan Siti')).toBeInTheDocument()
  // Isi undangannya sendiri TIDAK BOLEH ikut terkirim ke DOM.
  expect(container.querySelector('.secondary-pane')).not.toBeInTheDocument()
  expect(screen.queryByText('Cinta itu indah')).not.toBeInTheDocument()
})

test('akses masih diperiksa -> null, BUKAN undangan dan bukan pula penolakan', () => {
  setAccess('checking')
  mockedUseInvitationData.mockReturnValue({ data, loading: false, error: false })

  const { container } = render(<App />)

  // Menebak lebih awal berarti salah satu dari dua kesalahan: mengedipkan isi
  // undangan ke orang yang belum tentu berhak, atau menuduh tamu sah yang
  // jaringannya lambat.
  expect(container).toBeEmptyDOMElement()
})

// Gangguan jaringan BUKAN bukti bahwa orangnya tidak diundang. Menyamakan
// keduanya berarti menuduh tamu sah sebagai penyusup hanya karena sinyal
// putus - pembedaan yang sama sudah dipakai ScanPage di gate.
test('permintaan tidak sampai -> pesan koneksi, TIDAK menuduh tidak terdaftar', () => {
  setAccess('unavailable')
  mockedUseInvitationData.mockReturnValue({ data, loading: false, error: false })

  render(<App />)

  expect(screen.getByText(/sambungan ke server/i)).toBeInTheDocument()
  expect(screen.queryByText(/tidak terdaftar/i)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument()
})

// Konten gagal dimuat TIDAK boleh membuat orang yang salah membuka tautan
// menerima layar kosong tanpa penjelasan apa pun.
test('ditolak DAN konten kosong -> kalimatnya tetap utuh tanpa nama mempelai', () => {
  setAccess('denied')
  mockedUseInvitationData.mockReturnValue({ data: null, loading: false, error: false })

  render(<App />)

  expect(screen.getByText(/tidak terdaftar dalam list undangan/i)).toBeInTheDocument()
})
