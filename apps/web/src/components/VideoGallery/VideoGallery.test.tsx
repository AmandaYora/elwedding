import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import VideoGallery from './VideoGallery'
import type { InvitationContent } from '@/types/api'

const content: InvitationContent = {
  brideName: '', brideParentsText: '', brideInstagram: '', bridePhotoUrl: '',
  groomName: '', groomParentsText: '', groomInstagram: '', groomPhotoUrl: '',
  weddingDateUnix: 0, weddingDateLabel: '', weddingDateRaw: '',
  hashtag: '', coverLogoUrl: '',
  coverImageDesktopUrl: '', coverImageMobileUrl: '',
  quoteText: '', thanksTitle: '', thanksDescription: '', musicUrl: '',
  videoGalleryTitle: 'Our Footage', videoGalleryYoutubeUrl: 'https://www.youtube.com/watch?v=dl_VqonCz6Y', videoGalleryCaption: 'Pre-Wedding',
  liveStreamingTitle: '', liveStreamingYoutubeUrl: '',
  instagramFilterTitle: '', instagramFilterCaption: '', instagramFilterPreviewPhotoUrl: '', instagramFilterLink: '',
  weddingGiftDescription: '', dresscodeTitle: '', dresscodeDescription: '', dresscodeNote: '', dresscodeImageUrl: '', shareImageUrl: '',
}

describe('VideoGallery', () => {
  it('section awal tidak ber-autoplay-video-section (facade)', () => {
    const { container } = render(<VideoGallery content={content} />)
    const section = container.querySelector('section.video-gallery')
    expect(section).not.toBeNull()
    expect(section?.classList.contains('autoplay-video-section')).toBe(false)
  })

  it('tombol play memiliki aria-label dan ikon aria-hidden', () => {
    const { container } = render(<VideoGallery content={content} />)
    const btn = container.querySelector('button.play-btn')
    expect(btn?.getAttribute('aria-label')).toBe('Putar video')
    const icon = btn?.querySelector('i')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
  })

  it('klik play tidak menambah autoplay class secara eager (modalVideo yang handle)', () => {
    // Setelah F1a, facade dihapus — klik tidak boleh memuat video.js
    // Jadi kelas tetap tidak ada setelah klik (karena kita hapus handler)
    const { container } = render(<VideoGallery content={content} />)
    const btn = container.querySelector('button.play-btn') as HTMLButtonElement
    // tidak ada handler loading, jadi klik tidak menambah kelas
    fireEvent.click(btn)
    const section = container.querySelector('section.video-gallery')
    // tetap tidak ada autoplay class — benar per F1a (hemat 661KB)
    expect(section?.classList.contains('autoplay-video-section')).toBe(false)
  })
})
