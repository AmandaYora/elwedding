import { httpClient } from '@/shared/services/http-client'
import { listGuests, getGuestSummary } from './guests.service'

vi.mock('@/shared/services/http-client', () => ({
  httpClient: { get: vi.fn() },
}))

const mockedGet = vi.mocked(httpClient.get)

afterEach(() => {
  mockedGet.mockReset()
})

// Regresi T1 (admin-ui-redesign/PLAN.md §2.3): backend mengirim
// `total_pages` (snake_case), harus dipetakan ke `totalPages`.
test('total_pages dari API terpetakan ke totalPages', async () => {
  mockedGet.mockResolvedValueOnce({
    data: { data: [], meta: { page: 1, limit: 20, total: 42, total_pages: 3 } },
  })

  const res = await listGuests({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false })

  expect(res.meta.totalPages).toBe(3)
  expect((res.meta as unknown as { total_pages?: number }).total_pages).toBeUndefined()
})

test('param q terkirim saat ada kata kunci', async () => {
  mockedGet.mockResolvedValueOnce({ data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 1 } } })

  await listGuests({ page: 1, status: '', q: 'budi', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false })

  expect(mockedGet).toHaveBeenCalledWith(
    '/api/v1/admin/guests',
    expect.objectContaining({ params: expect.objectContaining({ q: 'budi' }) }),
  )
})

test('q kosong tidak dikirim sebagai parameter', async () => {
  mockedGet.mockResolvedValueOnce({ data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 1 } } })

  await listGuests({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false })

  const params = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
  expect(params).not.toHaveProperty('q')
})

// guest-fields-admin-layout keputusan #19: 2 filter baru dikirim sebagai
// invitation_type/souvenir_type HANYA bila terisi, sama seperti pola q/status.
test('invitationType & souvenirType terkirim sebagai invitation_type/souvenir_type saat terisi', async () => {
  mockedGet.mockResolvedValueOnce({ data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 1 } } })

  await listGuests({ page: 1, status: '', q: '', invitationType: 'physical', souvenirType: 'vip', groupId: '', respondedOnly: false })

  expect(mockedGet).toHaveBeenCalledWith(
    '/api/v1/admin/guests',
    expect.objectContaining({ params: expect.objectContaining({ invitation_type: 'physical', souvenir_type: 'vip' }) }),
  )
})

test('invitationType & souvenirType kosong tidak dikirim sebagai parameter', async () => {
  mockedGet.mockResolvedValueOnce({ data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 1 } } })

  await listGuests({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false })

  const params = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
  expect(params).not.toHaveProperty('invitation_type')
  expect(params).not.toHaveProperty('souvenir_type')
})

// dashboard-wa-rsvp: GuestSummary diperluas dengan KPI/breakdown/aktivitas
// terbaru untuk dashboard berbasis kartu.
test('getGuestSummary mengembalikan seluruh field dashboard', async () => {
  const data = {
    total: 10,
    attending: 4,
    notAttending: 1,
    remindLater: 2,
    pending: 3,
    invitationOnline: 7,
    invitationPhysical: 3,
    souvenirRegular: 8,
    souvenirVip: 2,
    attendingPax: 6,
    sideGroom: 5,
    sideBride: 5,
    genderMale: 4,
    genderFemale: 6,
    recentResponses: [{ name: 'Budi', rsvpStatus: 'attending' as const, attendingCount: 2, respondedAt: '2026-01-01T00:00:00Z' }],
  }
  mockedGet.mockResolvedValueOnce({ data: { data } })

  const summary = await getGuestSummary()

  expect(summary).toEqual(data)
  expect(mockedGet).toHaveBeenCalledWith('/api/v1/admin/guests/summary')
})

// guest-groups T18: filter group dikirim sebagai `group_id` (snake_case)
// HANYA bila terisi, pola yang sama persis dengan invitation_type/souvenir_type.
test('groupId terkirim sebagai group_id saat terisi', async () => {
  mockedGet.mockResolvedValueOnce({ data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 1 } } })

  await listGuests({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '7', respondedOnly: false })

  expect(mockedGet).toHaveBeenCalledWith(
    '/api/v1/admin/guests',
    expect.objectContaining({ params: expect.objectContaining({ group_id: '7' }) }),
  )
})

test('groupId kosong tidak dikirim sebagai parameter', async () => {
  mockedGet.mockResolvedValueOnce({ data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 1 } } })

  await listGuests({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false })

  const params = mockedGet.mock.calls[0][1]?.params as Record<string, unknown>
  expect(params).not.toHaveProperty('group_id')
})
