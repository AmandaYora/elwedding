import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { httpClient } from '@/shared/services/http-client'
import type { InvitationContent } from '@/types/api'
import RsvpConfirmation from './RsvpConfirmation'
import { resetGuestSessionCache } from '@/hooks/useGuestSession'

vi.mock('@/shared/services/http-client', () => ({
  httpClient: { get: vi.fn(), patch: vi.fn() },
}))

const mockedGet = vi.mocked(httpClient.get)
const mockedPatch = vi.mocked(httpClient.patch)

const content: InvitationContent = {
  brideName: 'Siti', brideParentsText: '', brideInstagram: '', bridePhotoUrl: '',
  groomName: 'Budi', groomParentsText: '', groomInstagram: '', groomPhotoUrl: '',
  weddingDateUnix: 1778904000, weddingDateLabel: 'Saturday, 16 May 2026', weddingDateRaw: '',
  hashtag: '', coverLogoUrl: '', coverImageDesktopUrl: '', coverImageMobileUrl: '',
  quoteText: '', thanksTitle: '', thanksDescription: '', musicUrl: '',
  videoGalleryTitle: '', videoGalleryYoutubeUrl: '', videoGalleryCaption: '',
  liveStreamingTitle: '', liveStreamingYoutubeUrl: '',
  instagramFilterTitle: '', instagramFilterCaption: '', instagramFilterPreviewPhotoUrl: '', instagramFilterLink: '',
  weddingGiftDescription: '', dresscodeTitle: '', dresscodeDescription: '', dresscodeNote: '', dresscodeImageUrl: '',
}

function setSearch(search: string) {
  window.history.pushState({}, '', `/${search}`)
}

afterEach(() => {
  mockedGet.mockReset()
  mockedPatch.mockReset()
  setSearch('')
  // Tiga test di bawah memakai token 'abc123' yang SAMA. Tanpa reset, cache
  // promise level modul di useGuestSession mengembalikan respons mock test
  // pertama ke test berikutnya.
  resetGuestSessionCache()
})

test('renders the 3 confirmation buttons and no QR on initial mount', () => {
  render(<RsvpConfirmation content={content} />)

  expect(screen.getByRole('button', { name: 'Akan Hadir' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tidak Hadir' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ingatkan Saya Nanti' })).toBeInTheDocument()
  expect(document.getElementById('rsvp-qr-canvas')).not.toBeInTheDocument()
})

// dashboard-wa-rsvp keputusan #2: klik "Akan Hadir" TIDAK langsung
// menampilkan QR - tamu memilih dulu 1/2 tamu.
test('klik "Akan Hadir" menampilkan pilihan 1/2 tamu, QR belum muncul', () => {
  render(<RsvpConfirmation content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Akan Hadir' }))

  expect(document.getElementById('rsvp-qr-canvas')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: '1 Tamu' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '2 Tamu' })).toBeInTheDocument()
})

test('memilih jumlah tamu menampilkan kartu QR dan tombol unduh', async () => {
  render(<RsvpConfirmation content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Akan Hadir' }))
  fireEvent.click(screen.getByRole('button', { name: '2 Tamu' }))

  await waitFor(() => expect(document.getElementById('rsvp-qr-canvas')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Unduh QR' })).toBeInTheDocument()
  expect(screen.getByText('2 tamu akan hadir.')).toBeInTheDocument()
})

test('tombol "Kembali" di langkah pilih jumlah tamu -> kembali ke 3 tombol awal', () => {
  render(<RsvpConfirmation content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Akan Hadir' }))
  fireEvent.click(screen.getByRole('button', { name: 'Kembali' }))

  expect(screen.getByRole('button', { name: 'Akan Hadir' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '1 Tamu' })).not.toBeInTheDocument()
})

test('shows a thank-you message and no QR after choosing "Tidak Hadir"', () => {
  render(<RsvpConfirmation content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Tidak Hadir' }))

  expect(screen.getByText('Terima Kasih')).toBeInTheDocument()
  expect(document.getElementById('rsvp-qr-canvas')).not.toBeInTheDocument()
})

test('shows a reminder message and no QR after choosing "Ingatkan Saya Nanti"', () => {
  render(<RsvpConfirmation content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Ingatkan Saya Nanti' }))

  expect(screen.getByText('Baik, Kami Tunggu')).toBeInTheDocument()
  expect(document.getElementById('rsvp-qr-canvas')).not.toBeInTheDocument()
})

test('returns to the 3 buttons when "Ubah pilihan" is clicked from the attending state', async () => {
  render(<RsvpConfirmation content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Akan Hadir' }))
  fireEvent.click(screen.getByRole('button', { name: '1 Tamu' }))
  await waitFor(() => expect(document.getElementById('rsvp-qr-canvas')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Ubah pilihan' }))

  expect(screen.getByRole('button', { name: 'Akan Hadir' })).toBeInTheDocument()
  expect(document.getElementById('rsvp-qr-canvas')).not.toBeInTheDocument()
})

// --- dashboard-wa-rsvp §9.3: integrasi token, attendingCount, & qrPayload ---

test('tanpa token -> memilih jumlah tamu TIDAK memicu PATCH, QR tetap muncul (mode preview)', async () => {
  setSearch('')
  render(<RsvpConfirmation content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Akan Hadir' }))
  fireEvent.click(screen.getByRole('button', { name: '1 Tamu' }))

  await waitFor(() => expect(document.getElementById('rsvp-qr-canvas')).toBeInTheDocument())
  expect(mockedPatch).not.toHaveBeenCalled()
})

test('dengan token -> memilih jumlah tamu memanggil PATCH dengan attendingCount', async () => {
  setSearch('?guest=abc123')
  mockedGet.mockResolvedValueOnce({
    data: { success: true, data: { name: 'Budi', side: 'groom', rsvpStatus: 'pending', attendingCount: 1 } },
  })
  mockedPatch.mockResolvedValueOnce({ data: { success: true, data: { qrPayload: 'QR-DARI-BACKEND' } } })

  render(<RsvpConfirmation content={content} />)
  await waitFor(() => expect(mockedGet).toHaveBeenCalled())

  fireEvent.click(screen.getByRole('button', { name: 'Akan Hadir' }))
  fireEvent.click(screen.getByRole('button', { name: '2 Tamu' }))

  await waitFor(() =>
    expect(mockedPatch).toHaveBeenCalledWith('/api/v1/public/guests/by-token/abc123/rsvp', {
      status: 'attending',
      attendingCount: 2,
    }),
  )
})

test('session.status tersimpan attending -> render QR langsung dari session.attendingCount, bukan 3 tombol', async () => {
  setSearch('?guest=abc123')
  mockedGet.mockResolvedValueOnce({
    data: { success: true, data: { name: 'Budi', side: 'groom', rsvpStatus: 'attending', attendingCount: 2 } },
  })

  render(<RsvpConfirmation content={content} />)

  await waitFor(() => expect(document.getElementById('rsvp-qr-canvas')).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Akan Hadir' })).not.toBeInTheDocument()
  // Regresi: tamu yang membuka ulang link (tanpa pernah melewati
  // handleConfirmAttending pada render ini) tetap melihat jumlah tamu yang
  // benar dari sesi, bukan default 1.
  expect(screen.getByText('2 tamu akan hadir.')).toBeInTheDocument()
})

test('PATCH gagal -> QR tetap tampil (fallback lokal), dengan indikator error', async () => {
  setSearch('?guest=abc123')
  mockedGet.mockResolvedValueOnce({
    data: { success: true, data: { name: 'Budi', side: 'groom', rsvpStatus: 'pending', attendingCount: 1 } },
  })
  mockedPatch.mockRejectedValueOnce(new Error('network error'))

  render(<RsvpConfirmation content={content} />)
  await waitFor(() => expect(mockedGet).toHaveBeenCalled())

  fireEvent.click(screen.getByRole('button', { name: 'Akan Hadir' }))
  fireEvent.click(screen.getByRole('button', { name: '1 Tamu' }))

  await waitFor(() => expect(document.getElementById('rsvp-qr-canvas')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByText(/Gagal menyimpan status/)).toBeInTheDocument())
})
