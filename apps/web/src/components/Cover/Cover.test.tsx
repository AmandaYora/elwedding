import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Cover from './Cover'
import type { InvitationContent } from '@/types/api'

function mockMatchMedia(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isMobile && query === '(max-width: 1024px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  })
}

const baseContent: InvitationContent = {
  brideName: 'Siti', brideParentsText: '', brideInstagram: '', bridePhotoUrl: '',
  groomName: 'Budi', groomParentsText: '', groomInstagram: '', groomPhotoUrl: '',
  weddingDateUnix: 0, weddingDateLabel: '', weddingDateRaw: '',
  hashtag: '', coverLogoUrl: '/logo.webp',
  coverImageDesktopUrl: '/media/uploads/gif-872375-1775705339-9344566539b63ad1a7e5d2b5.mp4',
  coverImageMobileUrl: '/media/uploads/gif-872371-1775705325-e8e2cfa87b364b0f5d80e465.gif',
  quoteText: '', thanksTitle: '', thanksDescription: '', musicUrl: '',
  videoGalleryTitle: '', videoGalleryYoutubeUrl: '', videoGalleryCaption: '',
  liveStreamingTitle: '', liveStreamingYoutubeUrl: '',
  instagramFilterTitle: '', instagramFilterCaption: '', instagramFilterPreviewPhotoUrl: '', instagramFilterLink: '',
  weddingGiftDescription: '', dresscodeTitle: '', dresscodeDescription: '', dresscodeNote: '',
}

describe('Cover', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hanya satu varian yang dirender (desktop saat isMobile false)', () => {
    mockMatchMedia(false)
    const { container } = render(<Cover content={baseContent} />)
    const pictures = container.querySelectorAll('#cover-main .picture')
    expect(pictures.length).toBe(1)
    expect(pictures[0].classList.contains('desktop')).toBe(true)
  })

  it('isMobile true → varian mobile', () => {
    mockMatchMedia(true)
    const { container } = render(<Cover content={baseContent} />)
    const pictures = container.querySelectorAll('#cover-main .picture')
    expect(pictures.length).toBe(1)
    expect(pictures[0].classList.contains('mobile')).toBe(true)
  })

  it('isVideoUrl: mp4 dirender sebagai <video>', () => {
    mockMatchMedia(false)
    const { container } = render(<Cover content={baseContent} />)
    expect(container.querySelector('#cover-main video')).not.toBeNull()
  })

  it('isVideoUrl: gif dirender sebagai <img> saat mobile', () => {
    mockMatchMedia(true)
    const mobileGifContent: InvitationContent = { ...baseContent, coverImageMobileUrl: '/a/b.gif', coverImageDesktopUrl: '/a/b.mp4' }
    const { container } = render(<Cover content={mobileGifContent} />)
    expect(container.querySelector('#cover-main img')).not.toBeNull()
    expect(container.querySelector('#cover-main video')).toBeNull()
  })

  it('Orn-31 memiliki fetchPriority high dan width/height', () => {
    mockMatchMedia(false)
    const { container } = render(<Cover content={baseContent} />)
    const orn31 = container.querySelector('img[src*="Orn-31"]')
    expect(orn31).not.toBeNull()
    expect(orn31?.getAttribute('fetchpriority')).toBe('high')
    expect(orn31?.getAttribute('width')).toBeTruthy()
    expect(orn31?.getAttribute('height')).toBeTruthy()
  })
})
