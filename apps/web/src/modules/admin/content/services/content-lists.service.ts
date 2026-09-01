import { httpClient } from '@/shared/services/http-client'
import type {
  AgendaEvent,
  GalleryPhoto,
  LoveStoryChapter,
  RundownItem,
  WeddingGiftBank,
} from '@/types/api'

function makeResource<T extends { id: number }>(path: string) {
  return {
    list: async (): Promise<T[]> => (await httpClient.get<{ data: T[] }>(`/api/v1/admin/content/${path}`)).data.data,
    create: async (item: Omit<T, 'id'>): Promise<void> => {
      await httpClient.post(`/api/v1/admin/content/${path}`, item)
    },
    update: async (id: number, item: Omit<T, 'id'>): Promise<void> => {
      await httpClient.put(`/api/v1/admin/content/${path}/${id}`, item)
    },
    remove: async (id: number): Promise<void> => {
      await httpClient.delete(`/api/v1/admin/content/${path}/${id}`)
    },
  }
}

export const agendaEventsResource = makeResource<AgendaEvent>('agenda-events')
export const rundownItemsResource = makeResource<RundownItem>('rundown-items')
export const galleryPhotosResource = makeResource<GalleryPhoto>('gallery-photos')
export const loveStoryChaptersResource = makeResource<LoveStoryChapter>('love-story-chapters')
export const giftBanksResource = makeResource<WeddingGiftBank>('gift-banks')
