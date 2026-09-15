import { httpClient } from '@/shared/services/http-client'

/**
 * Kontrak menu Ucapan (docs/plan/wedding-wish/PLAN.md T18). Semua lewat
 * `httpClient` - satu instance Axios, sesuai frontend-react.md.
 *
 * Seluruh endpoint di bawah dijaga RequireFullAdmin di server: akun petugas
 * gate menerima 403. Rute frontend-nya pun tidak masuk SCANNER_ALLOWED_PATHS.
 */
export interface Wish {
  id: number
  guestId: number
  guestName: string
  guestSide: 'groom' | 'bride'
  message: string
  isHidden: boolean
  createdAt: string
}

interface ApiListResponse {
  data: Wish[]
  meta: { page: number; limit: number; total: number; total_pages: number }
}

export interface WishListResponse {
  data: Wish[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

/** Ukuran halaman menu Ucapan - sama dengan menu Tamu (PAGE_SIZE guests). */
export const WISH_PAGE_SIZE = 20

export async function listWishes(page: number): Promise<WishListResponse> {
  const res = await httpClient.get<ApiListResponse>('/api/v1/admin/wishes', {
    params: { page, limit: WISH_PAGE_SIZE },
  })
  // Envelope backend memakai snake_case `total_pages` (dikunci
  // api-standard.md) - dipetakan di SATU tempat ini, pola groups.service.ts.
  return {
    data: res.data.data ?? [],
    meta: {
      page: res.data.meta.page,
      limit: res.data.meta.limit,
      total: res.data.meta.total,
      totalPages: res.data.meta.total_pages,
    },
  }
}

export async function setWishHidden(id: number, hidden: boolean): Promise<void> {
  await httpClient.patch(`/api/v1/admin/wishes/${id}/hidden`, { hidden })
}

export async function deleteWish(id: number): Promise<void> {
  await httpClient.delete(`/api/v1/admin/wishes/${id}`)
}
