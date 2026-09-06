import { httpClient } from '@/shared/services/http-client'

/**
 * Kontrak menu Group (docs/plan/guest-groups/PLAN.md T12). Semua lewat
 * `httpClient` - satu instance Axios, sesuai frontend-react.md.
 *
 * Seluruh endpoint di bawah dijaga RequireFullAdmin di server: akun petugas
 * gate menerima 403 (D10). Petugas tetap melihat NAMA group di hasil scan,
 * tapi lewat respons check-in yang me-resolve-nya di server (D8), bukan lewat
 * berkas ini.
 */
export interface GuestGroup {
  id: number
  name: string
  description: string
  /** Diisi server dari SATU query GROUP BY, bukan satu COUNT per baris.
   * Dialah yang menjelaskan kenapa sebuah group tidak bisa dihapus (K4). */
  guestCount: number
  /** Angka AWAL jatah kursi untuk tamu baru di group ini (docs/plan/
   * guest-pax-quota/PLAN.md D2/D8). Dipakai GuestsPage untuk mengisi field
   * "Jumlah tamu" saat admin memilih group - lookup di memori dari daftar
   * group yang memang sudah dimuat halaman itu, jadi TANPA request tambahan.
   * Bukan batas keras: yang mengikat adalah `paxQuota` milik tamu. */
  defaultPax: number
  createdAt: string
}

export interface GroupInput {
  name: string
  description: string
  defaultPax: number
}

interface ApiListResponse {
  data: GuestGroup[]
  meta: { page: number; limit: number; total: number; total_pages: number }
}

export interface GroupListResponse {
  data: GuestGroup[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

/** Ukuran halaman menu Group. Terpisah dari PAGE_SIZE tamu - jumlah group
 * jauh lebih kecil, dan halaman ini tidak punya filter apa pun (§3.2). */
export const GROUP_PAGE_SIZE = 20

/** Batas keras `pagination.MaxLimit` di backend (shared/pagination). Dipakai
 * listAllGroups di bawah; lihat catatan "batas yang diketahui" di §6 PLAN. */
const MAX_LIMIT = 100

function mapList(res: ApiListResponse): GroupListResponse {
  // Envelope backend memakai snake_case `total_pages` (dikunci
  // api-standard.md) - dipetakan di SATU tempat ini, pola users.service.ts.
  return {
    data: res.data ?? [],
    meta: {
      page: res.meta.page,
      limit: res.meta.limit,
      total: res.meta.total,
      totalPages: res.meta.total_pages,
    },
  }
}

export async function listGroups(page: number): Promise<GroupListResponse> {
  const res = await httpClient.get<ApiListResponse>('/api/v1/admin/groups', {
    params: { page, limit: GROUP_PAGE_SIZE },
  })
  return mapList(res.data)
}

/**
 * listAllGroups memuat SELURUH group sekali untuk dropdown & pemetaan
 * id -> nama di daftar Tamu (D2) - itulah yang membuat kolom "Group" di sana
 * tidak butuh JOIN maupun query per baris.
 *
 * BATAS YANG DIKETAHUI (§6): `limit: 100` adalah `pagination.MaxLimit` di
 * backend. Pada volume yang diasumsikan (group puluhan untuk satu pernikahan)
 * angka itu jauh di atas kebutuhan, dan halaman Group sendiri tetap
 * berpaginasi penuh sehingga semua group tetap bisa dikelola. Bila kelak
 * group memang bisa ratusan, tambahkan endpoint ringan tanpa paginasi -
 * JANGAN menaikkan angka ini sendirian, backend akan memotongnya kembali ke
 * 100 tanpa memberi tanda.
 */
export async function listAllGroups(): Promise<GuestGroup[]> {
  const res = await httpClient.get<ApiListResponse>('/api/v1/admin/groups', {
    params: { page: 1, limit: MAX_LIMIT },
  })
  return res.data.data ?? []
}

export async function createGroup(input: GroupInput): Promise<GuestGroup> {
  const res = await httpClient.post<{ data: GuestGroup }>('/api/v1/admin/groups', input)
  return res.data.data
}

export async function updateGroup(id: number, input: GroupInput): Promise<void> {
  await httpClient.put(`/api/v1/admin/groups/${id}`, input)
}

export async function deleteGroup(id: number): Promise<void> {
  await httpClient.delete(`/api/v1/admin/groups/${id}`)
}
