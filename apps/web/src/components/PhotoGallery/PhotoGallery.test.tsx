import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import PhotoGallery from './PhotoGallery'
import type { GalleryPhoto } from '@/types/api'

const photos: GalleryPhoto[] = [
  { id: 1, photoUrl: '/uploads/images/photo-1920.png', thumbUrl: '/uploads/images/photo-480.png', sortOrder: 1 },
  { id: 2, photoUrl: '/uploads/images/photo-1920-b.png', thumbUrl: '/uploads/images/photo-480-b.png', sortOrder: 2 },
]

describe('PhotoGallery', () => {
  it('display utama (.photo-nav) memakai photoUrl, bukan thumbUrl (docs/plan/admin-content-png-lossless-galeri-tajam/PLAN.md §2.2)', () => {
    const { container } = render(<PhotoGallery photos={photos} />)
    const img = container.querySelector('.photo-nav .photo-img')
    expect(img?.getAttribute('src')).toBe(photos[0].photoUrl)
  })

  it('strip kecil (.photo-slider) tetap memakai thumbUrl - tidak ikut berubah', () => {
    const { container } = render(<PhotoGallery photos={photos} />)
    const img = container.querySelector('.photo-slider .photo-img')
    expect(img?.getAttribute('src')).toBe(photos[0].thumbUrl)
  })

  it('href lightbox (a.photo-link) sama dengan src display utama - konsisten, tidak membuka foto lain', () => {
    const { container } = render(<PhotoGallery photos={photos} />)
    const link = container.querySelector('a.photo-link')
    const img = container.querySelector('.photo-nav .photo-img')
    expect(link?.getAttribute('href')).toBe(photos[0].photoUrl)
    expect(link?.getAttribute('href')).toBe(img?.getAttribute('src'))
  })
})
