import { httpClient } from '@/shared/services/http-client'
import { PAGE_SIZE, type RsvpStatus, type Gender, type InvitationType, type SouvenirType, type Side } from '@/shared/constants/guests'

export interface Guest {
  id: number
  name: string
  phone: string
  side: Side
  token: string
  rsvpStatus: RsvpStatus
  rsvpRespondedAt: string | null
  createdAt: string
  gender: Gender | null
  invitationType: InvitationType
  souvenirType: SouvenirType
  email: string
  address: string
  notes: string
  attendingCount: number
  isExpectedAttending: boolean
}

export interface GuestInput {
  name: string
  phone: string
  side: Side
  gender: Gender
  invitationType: InvitationType
  souvenirType: SouvenirType
  email: string
  address: string
  notes: string
  isExpectedAttending: boolean
}

// RecentResponse - satu baris kartu "Aktivitas RSVP terbaru" (dashboard-
// wa-rsvp §3.2).
export interface RecentResponse {
  name: string
  rsvpStatus: RsvpStatus
  attendingCount: number
  respondedAt: string
}

export interface GuestSummary {
  total: number
  attending: number
  notAttending: number
  remindLater: number
  pending: number
  invitationOnline: number
  invitationPhysical: number
  souvenirRegular: number
  souvenirVip: number
  attendingPax: number
  sideGroom: number
  sideBride: number
  genderMale: number
  genderFemale: number
  recentResponses: RecentResponse[]
}

/**
 * Parameter listGuests sebagai satu objek (guest-fields-admin-layout
 * keputusan #19): dengan 4 filter string berurutan, versi posisional
 * membuat menukar 2 argumen apa pun tidak terdeteksi compiler.
 */
export interface GuestListParams {
  page: number
  status: string
  q: string
  invitationType: string
  souvenirType: string
  respondedOnly: boolean
}

interface ApiListResponse {
  data: Guest[]
  meta: { page: number; limit: number; total: number; total_pages: number }
}

export interface ListResponse {
  data: Guest[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

/**
 * Perbaikan T1 (admin-ui-redesign/PLAN.md §2.3): backend mengirim
 * `total_pages` (snake_case, dikunci api-standard.md), bukan `totalPages`.
 * Dipetakan di SATU tempat ini, bukan diubah di envelope backend
 * (keputusan #12).
 */
export async function listGuests(params: GuestListParams): Promise<ListResponse> {
  const { page, status, q, invitationType, souvenirType, respondedOnly } = params
  const res = await httpClient.get<ApiListResponse>('/api/v1/admin/guests', {
    params: {
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(q ? { q } : {}),
      ...(invitationType ? { invitation_type: invitationType } : {}),
      ...(souvenirType ? { souvenir_type: souvenirType } : {}),
      ...(respondedOnly ? { responded: 'true' } : {}),
    },
  })
  return {
    data: res.data.data,
    meta: {
      page: res.data.meta.page,
      limit: res.data.meta.limit,
      total: res.data.meta.total,
      totalPages: res.data.meta.total_pages,
    },
  }
}

export async function getGuestSummary(): Promise<GuestSummary> {
  const res = await httpClient.get<{ data: GuestSummary }>('/api/v1/admin/guests/summary')
  return res.data.data
}

export async function createGuest(input: GuestInput): Promise<Guest> {
  const res = await httpClient.post<{ data: Guest }>('/api/v1/admin/guests', input)
  return res.data.data
}

export async function updateGuest(id: number, input: GuestInput): Promise<void> {
  await httpClient.put(`/api/v1/admin/guests/${id}`, input)
}

export async function deleteGuest(id: number): Promise<void> {
  await httpClient.delete(`/api/v1/admin/guests/${id}`)
}
