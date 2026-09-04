import { renderHook } from '@testing-library/react'
import type { InvitationData } from '@/types/api'
import { __resetLegacyBootstrapForTest, useLegacyBootstrap } from './useLegacyBootstrap'

const data: InvitationData = {
  content: {
    brideName: 'Siti', brideParentsText: '', brideInstagram: '', bridePhotoUrl: '',
    groomName: 'Budi', groomParentsText: '', groomInstagram: '', groomPhotoUrl: '',
    weddingDateUnix: 1778904000, weddingDateLabel: 'Saturday, 16 May 2026', weddingDateRaw: '',
    hashtag: '#PernikahanBahagia', coverLogoUrl: '/logo.webp',
    coverImageDesktopUrl: '/cover-desktop.gif', coverImageMobileUrl: '/cover-mobile.gif',
    quoteText: '', thanksTitle: '', thanksDescription: '', musicUrl: '/music.mp3',
    videoGalleryTitle: '', videoGalleryYoutubeUrl: '', videoGalleryCaption: '',
    liveStreamingTitle: '', liveStreamingYoutubeUrl: '',
    instagramFilterTitle: '', instagramFilterCaption: '', instagramFilterPreviewPhotoUrl: '', instagramFilterLink: '',
    weddingGiftDescription: '', dresscodeTitle: '', dresscodeDescription: '', dresscodeNote: '', dresscodeImageUrl: '', shareImageUrl: '',
  },
  sections: [
    { key: 'opening_cover', order: 1 },
    { key: 'cover', order: 2 },
    { key: 'couple', order: 3 },
  ],
  agendaEvents: [],
  rundownItems: [],
  galleryPhotos: [],
  loveStoryChapters: [],
  giftBanks: [{ id: 1, bankName: 'BANK BRI', accountNumber: '001122301', accountName: 'Siti', sortOrder: 1 }],
}

beforeEach(() => {
  __resetLegacyBootstrapForTest()
  window.MANAGE_SECTION_ENABLED = undefined
  window.INVITATION_LAYOUTS = undefined
  window.EVENT = undefined
  window.COVERS = undefined
  window.BANK_OPTIONS = undefined
})

test('efek TIDAK jalan saat ready=false', () => {
  renderHook(() => useLegacyBootstrap(data, false))

  expect(window.INVITATION_LAYOUTS).toBeUndefined()
  expect(window.MANAGE_SECTION_ENABLED).toBeUndefined()
})

test('saat ready=true: INVITATION_LAYOUTS berbentuk object map (bukan array) dengan order numerik', () => {
  renderHook(() => useLegacyBootstrap(data, true))

  expect(Array.isArray(window.INVITATION_LAYOUTS)).toBe(false)
  expect(window.INVITATION_LAYOUTS).toEqual({
    opening_cover: { enabled: true, order: 1 },
    cover: { enabled: true, order: 2 },
    couple: { enabled: true, order: 3 },
  })
})

test('MANAGE_SECTION_ENABLED wajib true (F3)', () => {
  renderHook(() => useLegacyBootstrap(data, true))
  expect(window.MANAGE_SECTION_ENABLED).toBe(true)
})

test('window.EVENT bertipe number (epoch), bukan string/Date (F18)', () => {
  renderHook(() => useLegacyBootstrap(data, true))
  expect(typeof window.EVENT).toBe('number')
  expect(window.EVENT).toBe(1778904000)
})

test('window.COVERS entry MAIN memuat URL cover dari content (F16)', () => {
  renderHook(() => useLegacyBootstrap(data, true))

  const covers = window.COVERS as Array<{ position: string; details: { desktop: string; mobile: string } }>
  const main = covers.find((c) => c.position === 'MAIN')

  expect(main?.details.desktop).toContain('/cover-desktop.gif')
  expect(main?.details.mobile).toContain('/cover-mobile.gif')
})

test('BANK_OPTIONS diisi dari giftBanks (dipakai dropdown selectize legacy)', () => {
  renderHook(() => useLegacyBootstrap(data, true))

  expect(window.BANK_OPTIONS).toEqual([{ id: 1, title: 'BANK BRI', credential: '001122301' }])
})

test('window.COVERS MAIN membawa options.infinite===false (T11)', () => {
  renderHook(() => useLegacyBootstrap(data, true))
  const covers = window.COVERS as Array<{ position: string; options?: { infinite?: boolean; autoplay?: boolean } }>
  const main = covers.find((c) => c.position === 'MAIN')
  expect(main?.options).toEqual(expect.objectContaining({ infinite: false, autoplay: false }))
})

test('DEFERRED_SCRIPTS tidak dimuat saat bootstrap (T25)', async () => {
  const { CORE_SCRIPTS, DEFERRED_SCRIPTS } = await import('./useLegacyBootstrap')
  // Pastikan DEFERRED tidak ada di DOM setelah ready (hanya CORE yang mungkin dimuat)
  renderHook(() => useLegacyBootstrap(data, true))
  // tunggu microtask
  await new Promise((r) => setTimeout(r, 50))
  for (const src of DEFERRED_SCRIPTS) {
    expect(document.querySelector(`script[src="${src}"]`)).toBeNull()
  }
  // CORE terakhir harus fddf2641 dan 39d8abba
  expect(CORE_SCRIPTS[CORE_SCRIPTS.length - 2]).toContain('fddf2641.js')
  expect(CORE_SCRIPTS[CORE_SCRIPTS.length - 1]).toContain('39d8abba.js')
})
