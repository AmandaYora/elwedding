import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { httpClient } from '@/shared/services/http-client'
import type { InvitationContent } from '@/types/api'
import RsvpConfirmation from './RsvpConfirmation'
import { resetGuestSessionCache } from '@/hooks/useGuestSession'

/**
 * ISI QR, bukan tampilannya (docs/plan/scan-checkin-gate/PLAN.md T19).
 *
 * Berkas terpisah dari RsvpConfirmation.test.tsx karena butuh me-mock
 * `qrcode.react`: nilai QR dirender ke <canvas>, dan jsdom tidak
 * mengimplementasikan getContext() sehingga payload-nya tidak bisa dibaca
 * dari DOM. Mock di bawah menampilkannya sebagai atribut data.
 */
vi.mock('qrcode.react', () => ({
  QRCodeCanvas: ({ value, id }: { value: string; id?: string }) => (
    <canvas id={id} data-testid="qr" data-value={value} />
  ),
}))

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
  weddingGiftDescription: '', dresscodeTitle: '', dresscodeDescription: '', dresscodeNote: '', dresscodeImageUrl: '', shareImageUrl: '',
}

function setSearch(search: string) {
  window.history.pushState({}, '', `/${search}`)
}

afterEach(() => {
  mockedGet.mockReset()
  mockedPatch.mockReset()
  setSearch('')
  resetGuestSessionCache()
})

test('tamu bertoken -> QR berisi ELW1:<token>, bukan teks undangan', async () => {
  setSearch('?guest=tok-abc')
  mockedGet.mockResolvedValueOnce({
    data: { success: true, data: { name: 'Budi', side: 'groom', rsvpStatus: 'attending', attendingCount: 2 } },
  })

  render(<RsvpConfirmation content={content} />)

  const qr = await screen.findByTestId('qr')
  expect(qr).toHaveAttribute('data-value', 'ELW1:tok-abc')
})

test('PATCH sukses -> QR memakai qrPayload dari backend apa adanya', async () => {
  setSearch('?guest=tok-abc')
  mockedGet.mockResolvedValueOnce({
    data: { success: true, data: { name: 'Budi', side: 'groom', rsvpStatus: 'pending', attendingCount: 1 } },
  })
  mockedPatch.mockResolvedValueOnce({ data: { success: true, data: { qrPayload: 'ELW1:tok-dari-backend' } } })

  render(<RsvpConfirmation content={content} />)
  await waitFor(() => expect(mockedGet).toHaveBeenCalled())

  fireEvent.click(screen.getByRole('button', { name: 'Akan Hadir' }))
  fireEvent.click(screen.getByRole('button', { name: '1 Tamu' }))

  const qr = await screen.findByTestId('qr')
  await waitFor(() => expect(qr).toHaveAttribute('data-value', 'ELW1:tok-dari-backend'))
})

// Mode pratinjau (`/` tanpa ?guest=): QR sengaja TIDAK berprefiks. Tidak ada
// tamu yang diwakilinya, jadi pemindai memang harus menolaknya - itu benar,
// bukan bug (§3.2).
test('mode pratinjau tanpa token -> QR tetap teks lama, bukan ELW1', async () => {
  render(<RsvpConfirmation content={content} />)

  fireEvent.click(screen.getByRole('button', { name: 'Akan Hadir' }))
  fireEvent.click(screen.getByRole('button', { name: '1 Tamu' }))

  const qr = await screen.findByTestId('qr')
  const value = qr.getAttribute('data-value') ?? ''
  expect(value.startsWith('ELW1:')).toBe(false)
  expect(value).toContain('Wedding Invitation - Budi & Siti')
  expect(mockedPatch).not.toHaveBeenCalled()
})
