import { render, screen } from '@testing-library/react'
import type { InvitationData } from '@/types/api'
import App from './App'
import { useInvitationData } from '@/hooks/useInvitationData'

vi.mock('@/hooks/useInvitationData', () => ({ useInvitationData: vi.fn() }))
vi.mock('@/hooks/useLegacyBootstrap', () => ({ useLegacyBootstrap: vi.fn() }))

const mockedUseInvitationData = vi.mocked(useInvitationData)

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

afterEach(() => {
  mockedUseInvitationData.mockReset()
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

test('section yang tidak ada di data.sections tidak dirender; urutan sesuai data; Footer selalu ada', () => {
  mockedUseInvitationData.mockReturnValue({ data, loading: false, error: false })
  const { container } = render(<App />)

  const secondaryPane = container.querySelector('.secondary-pane')
  expect(secondaryPane).toBeInTheDocument()

  // "cover" section tidak ada di data.sections -> tidak boleh muncul.
  expect(container.querySelector('[data-section-order="cover"]')).not.toBeInTheDocument()

  // "quote" dan "couple" ada, dan urutannya (order 1, 2) sesuai DOM.
  const rendered = [...secondaryPane!.children].map((el) => el.getAttribute('data-section-order'))
  expect(rendered).toEqual(['quote', 'couple', null]) // null = Footer (data-section-footer, bukan data-section-order)

  expect(container.querySelector('[data-section-footer]')).toBeInTheDocument()
})
