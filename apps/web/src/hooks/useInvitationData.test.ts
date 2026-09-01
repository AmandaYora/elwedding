import { renderHook, waitFor } from '@testing-library/react'
import { httpClient } from '@/shared/services/http-client'
import type { InvitationData } from '@/types/api'
import { useInvitationData } from './useInvitationData'

vi.mock('@/shared/services/http-client', () => ({
  httpClient: { get: vi.fn() },
}))

const mockedGet = vi.mocked(httpClient.get)

afterEach(() => {
  mockedGet.mockReset()
})

const sampleData: InvitationData = {
  content: {
    brideName: 'Ariana', brideParentsText: '', brideInstagram: '', bridePhotoUrl: '',
    groomName: 'Adrian', groomParentsText: '', groomInstagram: '', groomPhotoUrl: '',
    weddingDateUnix: 1778904000, weddingDateLabel: 'Saturday, 16 May 2026', weddingDateRaw: '',
    hashtag: '', coverLogoUrl: '', coverImageDesktopUrl: '', coverImageMobileUrl: '',
    quoteText: '', thanksTitle: '', thanksDescription: '', musicUrl: '',
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

test('fetch sukses -> data ter-set, loading selesai', async () => {
  mockedGet.mockResolvedValueOnce({ data: { success: true, data: sampleData } })

  const { result } = renderHook(() => useInvitationData())
  expect(result.current.loading).toBe(true)

  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.data).toEqual(sampleData)
  expect(result.current.error).toBe(false)
})

test('fetch gagal -> error state, data tetap null', async () => {
  mockedGet.mockRejectedValueOnce(new Error('network error'))

  const { result } = renderHook(() => useInvitationData())
  await waitFor(() => expect(result.current.loading).toBe(false))

  expect(result.current.error).toBe(true)
  expect(result.current.data).toBeNull()
})

test('hanya fetch SEKALI walau komponen re-render (F14 - tidak ada refetch)', async () => {
  mockedGet.mockResolvedValue({ data: { success: true, data: sampleData } })

  const { rerender } = renderHook(() => useInvitationData())
  await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(1))

  rerender()
  rerender()

  expect(mockedGet).toHaveBeenCalledTimes(1)
})
