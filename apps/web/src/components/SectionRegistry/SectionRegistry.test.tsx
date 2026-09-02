import { render } from '@testing-library/react'
import type { InvitationData } from '@/types/api'
import SectionRegistry from './SectionRegistry'

const data: InvitationData = {
  content: {
    brideName: 'Siti', brideParentsText: '', brideInstagram: '', bridePhotoUrl: '',
    groomName: 'Budi', groomParentsText: '', groomInstagram: '', groomPhotoUrl: '',
    weddingDateUnix: 1778904000, weddingDateLabel: 'Saturday, 16 May 2026', weddingDateRaw: '',
    hashtag: '', coverLogoUrl: '', coverImageDesktopUrl: '', coverImageMobileUrl: '',
    quoteText: 'Cinta itu indah', thanksTitle: '', thanksDescription: '', musicUrl: '',
    videoGalleryTitle: '', videoGalleryYoutubeUrl: '', videoGalleryCaption: '',
    liveStreamingTitle: '', liveStreamingYoutubeUrl: '',
    instagramFilterTitle: '', instagramFilterCaption: '', instagramFilterPreviewPhotoUrl: '', instagramFilterLink: '',
    weddingGiftDescription: '', dresscodeTitle: '', dresscodeDescription: '', dresscodeNote: '',
  },
  sections: [],
  agendaEvents: [],
  rundownItems: [],
  galleryPhotos: [],
  loveStoryChapters: [],
  giftBanks: [],
}

test('merender komponen yang benar untuk section-key "quote"', () => {
  const { container } = render(<SectionRegistry sectionKey="quote" data={data} />)
  expect(container.querySelector('[data-section-order="quote"]')).toBeInTheDocument()
  expect(container.querySelector('.quote-caption')?.textContent).toContain('Cinta itu indah')
})

test('merender komponen yang benar untuk section-key "rsvp" (RsvpSection)', () => {
  const { container } = render(<SectionRegistry sectionKey="rsvp" data={data} />)
  expect(container.querySelector('[data-section-order="rsvp"]')).toBeInTheDocument()
})

test('section-key tidak dikenal -> tidak merender apa pun (bukan error)', () => {
  const { container } = render(<SectionRegistry sectionKey="tidak_ada" data={data} />)
  expect(container).toBeEmptyDOMElement()
})

// keputusan #9/F8 (PLAN.md): elemen section HARUS anak langsung container,
// tidak boleh ada elemen wrapper tambahan dari SectionRegistry sendiri -
// bundle legacy memindahkan node berdasarkan `a[0].parentNode`.
test('TIDAK menghasilkan elemen wrapper - root section adalah anak langsung container', () => {
  const { container } = render(<SectionRegistry sectionKey="quote" data={data} />)
  const section = container.querySelector('[data-section-order="quote"]')
  expect(section?.parentElement).toBe(container)
})
