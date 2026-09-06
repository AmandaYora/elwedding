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

  expect(result.current).toEqual({
    // paxQuota 2, bukan 1 (docs/plan/guest-pax-quota/PLAN.md T21): inilah
    // nilai mode pratinjau, dan 2 mempertahankan dua tombol seperti sebelum
    // fitur jatah kursi ada.
    name: 'Tamu Undangan', side: null, status: 'pending', token: null,
    attendingCount: 1, paxQuota: 2, resolved: false, access: 'denied',
  })
  expect(mockedGet).not.toHaveBeenCalled()
})

test('dengan token valid -> resolve nama, status, & jumlah tamu dari API', async () => {
  setSearch('?guest=abc123')
  mockedGet.mockResolvedValueOnce({
    data: {
      success: true,
      data: { name: 'Budi Santoso', side: 'groom', rsvpStatus: 'attending', attendingCount: 2, paxQuota: 4 },
    },
  })

  const { result } = renderHook(() => useGuestSession())

  await waitFor(() => expect(result.current.name).toBe('Budi Santoso'))
  expect(result.current).toEqual({
    name: 'Budi Santoso', side: 'groom', status: 'attending', token: 'abc123',
    attendingCount: 2, paxQuota: 4, resolved: true, access: 'granted',
  })
  expect(mockedGet).toHaveBeenCalledWith('/api/v1/public/guests/by-token/abc123')
})

// --- keputusan akses (gerbang undangan) ---
// HANYA 404 yang boleh berarti "tidak terdaftar". 404 adalah jawaban TEGAS
// server bahwa token itu tidak cocok dengan baris tamu mana pun; kegagalan
// lain tidak membuktikan apa pun tentang undangan si pembuka.

test('token invalid (404) -> akses ditolak, identitas tetap fallback', async () => {
  setSearch('?guest=invalid-token')
  mockedGet.mockRejectedValueOnce({ response: { status: 404 } })

  const { result } = renderHook(() => useGuestSession())

  await waitFor(() => expect(result.current.access).toBe('denied'))
  expect(result.current.name).toBe('Tamu Undangan')
  expect(result.current.status).toBe('pending')
  expect(result.current.resolved).toBe(false)
})

// Regresi paling mahal di berkas ini: kalau gangguan jaringan ikut dibaca
// sebagai 'denied', tamu undangan yang sinyalnya putus sesaat akan dituduh
// tidak terdaftar di undangan yang sebenarnya memang miliknya.
test('permintaan tidak sampai (tanpa response) -> unavailable, BUKAN denied', async () => {
  setSearch('?guest=abc123')
  mockedGet.mockRejectedValueOnce(new Error('Network Error'))

  const { result } = renderHook(() => useGuestSession())

  await waitFor(() => expect(result.current.access).toBe('unavailable'))
})

test('server bermasalah (500) -> unavailable, BUKAN denied', async () => {
  setSearch('?guest=abc123')
  mockedGet.mockRejectedValueOnce({ response: { status: 500 } })

  const { result } = renderHook(() => useGuestSession())

  await waitFor(() => expect(result.current.access).toBe('unavailable'))
})

// Sebelum jawaban tiba, aksesnya BELUM boleh diputuskan ke arah mana pun.
test('selama menunggu jawaban -> access tetap "checking"', () => {
  setSearch('?guest=abc123')
  mockedGet.mockReturnValueOnce(new Promise(() => {})) // tidak pernah selesai

  const { result } = renderHook(() => useGuestSession())

  expect(result.current.access).toBe('checking')
})
