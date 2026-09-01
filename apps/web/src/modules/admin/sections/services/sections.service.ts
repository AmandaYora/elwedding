import { httpClient } from '@/shared/services/http-client'

export interface AdminSection {
  key: string
  label: string
  isEnabled: boolean
  sortOrder: number
}

export async function listSections(): Promise<AdminSection[]> {
  const res = await httpClient.get<{ data: AdminSection[] }>('/api/v1/admin/sections')
  return res.data.data
}

export async function updateSections(
  updates: Array<{ key: string; isEnabled: boolean; sortOrder: number }>,
): Promise<void> {
  await httpClient.patch('/api/v1/admin/sections', { updates })
}
