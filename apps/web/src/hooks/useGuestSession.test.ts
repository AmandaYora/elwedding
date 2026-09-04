import { renderHook, waitFor } from '@testing-library/react'
import { httpClient } from '@/shared/services/http-client'
import { useGuestSession, resetGuestSessionCache } from './useGuestSession'

vi.mock('@/shared/services/http-client', () => ({
  httpClient: { get: vi.fn() },
}))

const mockedGet = vi.mocked(httpClient.get)

function setSearch(search: string) {
  window.history.pushState({}, '', `/${search}`)
}

afterEach(() => {
  mockedGet.mockReset()
  setSearch('')
  // Cache promise level modul bertahan antar test - tanpa reset, test yang
  // memakai token sama akan menerima respons mock test sebelumnya.
  resetGuestSessionCache()
})

test('tanpa ?guest= -> fallback "Tamu Undangan", tanpa network call', () => {
  setSearch('')
  const { result } = renderHook(() => useGuestSession())

  expect(result.current).toEqual({ name: 'Tamu Undangan', side: null, status: 'pending', token: null, attendingCount: 1, resolved: false })
  expect(mockedGet).not.toHaveBeenCalled()
})

test('dengan token valid -> resolve nama, status, & jumlah tamu dari API', async () => {
  setSearch('?guest=abc123')
  mockedGet.mockResolvedValueOnce({
    data: { success: true, data: { name: 'Budi Santoso', side: 'groom', rsvpStatus: 'attending', attendingCount: 2 } },
  })

  const { result } = renderHook(() => useGuestSession())

  await waitFor(() => expect(result.current.name).toBe('Budi Santoso'))
  expect(result.current).toEqual({ name: 'Budi Santoso', side: 'groom', status: 'attending', token: 'abc123', attendingCount: 2, resolved: true })
  expect(mockedGet).toHaveBeenCalledWith('/api/v1/public/guests/by-token/abc123')
})

test('token invalid -> fallback tanpa crash', async () => {
  setSearch('?guest=invalid-token')
  mockedGet.mockRejectedValueOnce(new Error('404'))

  const { result } = renderHook(() => useGuestSession())

  await waitFor(() => expect(mockedGet).toHaveBeenCalled())
  expect(result.current.name).toBe('Tamu Undangan')
  expect(result.current.status).toBe('pending')
})
