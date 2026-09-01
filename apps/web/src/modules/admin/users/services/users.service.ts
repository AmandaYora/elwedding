import { httpClient } from '@/shared/services/http-client'

export interface AdminUser {
  id: number
  username: string
  createdAt: string
}

export interface CreateUserInput {
  username: string
  password: string
}

export interface UpdateUserInput {
  username: string
  password: string // kosong = tidak diganti
}

export interface ListResponse {
  data: AdminUser[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export async function listUsers(page: number): Promise<ListResponse> {
  const res = await httpClient.get<{ data: AdminUser[]; meta: { page: number; limit: number; total: number; total_pages: number } }>(
    '/api/v1/admin/users',
    { params: { page, limit: 20 } },
  )
  return {
    data: res.data.data,
    meta: { page: res.data.meta.page, limit: res.data.meta.limit, total: res.data.meta.total, totalPages: res.data.meta.total_pages },
  }
}

export async function createUser(input: CreateUserInput): Promise<AdminUser> {
  const res = await httpClient.post<{ data: AdminUser }>('/api/v1/admin/users', input)
  return res.data.data
}

export async function updateUser(id: number, input: UpdateUserInput): Promise<void> {
  await httpClient.put(`/api/v1/admin/users/${id}`, input)
}

export async function deleteUser(id: number): Promise<void> {
  await httpClient.delete(`/api/v1/admin/users/${id}`)
}
