import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { httpClient } from '@/shared/services/http-client'
import WeddingWish from './WeddingWish'
import { resetGuestSessionCache } from '@/hooks/useGuestSession'

vi.mock('@/shared/services/http-client', () => ({
  httpClient: { get: vi.fn(), post: vi.fn() },
}))

const mockedGet = vi.mocked(httpClient.get)
const mockedPost = vi.mocked(httpClient.post)

function setSearch(search: string) {
  window.history.pushState({}, '', `/${search}`)
}

function sessionResponse(session: Record<string, unknown>) {
  return { data: { success: true, data: session } }
}

const baseSession = {
  name: 'Budi Santoso', side: 'groom', rsvpStatus: 'attending',
  attendingCount: 2, paxQuota: 2, hasWish: false, wishMessage: '',
}

/** GET by-token dipakai DUA jalur: sesi tamu dan daftar ucapan. Mock
 * membedakan keduanya lewat akhiran URL - persis pemisahan route di backend
 * (by-token/{token} vs by-token/{token}/wishes). */
function mockSessionAndWishes(session: Record<string, unknown>, wishes: unknown[]) {
  mockedGet.mockImplementation((url: unknown) => {
    if (typeof url === 'string' && url.endsWith('/wishes')) {
      return Promise.resolve({ data: { success: true, data: wishes } })
    }
    return Promise.resolve(sessionResponse(session))
  })
}

afterEach(() => {
  mockedGet.mockReset()
  mockedPost.mockReset()
  setSearch('')
  resetGuestSessionCache()
})

// F1: belum mengisi -> form tampil TANPA field Nama (D3: nama dari baris tamu).
test('hasWish false -> form tampil tanpa field Nama', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [])

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByPlaceholderText('Give your wish')).toBeInTheDocument())
  expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
})

// F2: sudah mengisi -> form tidak dirender, kartu "Ucapan Anda" berisi pesannya.
test('hasWish true -> kartu Ucapan Anda, form tidak dirender', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes({ ...baseSession, hasWish: true, wishMessage: 'Selamat ya!' }, [])

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Ucapan Anda')).toBeInTheDocument())
  expect(screen.getByText('Selamat ya!')).toBeInTheDocument()
  expect(screen.queryByPlaceholderText('Give your wish')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
})

// F3: daftar kosong -> slider tidak dirender, hanya form.
test('daftar kosong -> tidak ada slider', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [])

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByPlaceholderText('Give your wish')).toBeInTheDocument())
  expect(screen.queryByRole('tablist', { name: 'Pilih ucapan' })).not.toBeInTheDocument()
})

// Slider tampil saat ada ucapan (prasyarat F3 dibalik + D7).
test('daftar berisi -> slider menampilkan ucapan', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [
    { id: 1, guestName: 'Siti', guestSide: 'bride', message: 'Bahagia selalu!', createdAt: '2026-09-15T10:00:00+07:00' },
    { id: 2, guestName: 'Andi', guestSide: 'groom', message: 'Selamat menempuh hidup baru', createdAt: '2026-09-15T09:00:00+07:00' },
  ])

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())
  expect(screen.getByText('Siti')).toBeInTheDocument()
  expect(screen.getByText('Selamat menempuh hidup baru')).toBeInTheDocument()
})

// Kirim sukses -> kartu Ucapan Anda + daftar dimuat ulang.
test('kirim sukses -> form berganti kartu dan daftar dimuat ulang', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [])
  mockedPost.mockResolvedValue({ data: { success: true, data: null } })

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByPlaceholderText('Give your wish')).toBeInTheDocument())
  fireEvent.change(screen.getByPlaceholderText('Give your wish'), { target: { value: 'Turut berbahagia!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => expect(mockedPost).toHaveBeenCalledWith(
    '/api/v1/public/guests/by-token/tok123/wish',
    { message: 'Turut berbahagia!' },
  ))
  await waitFor(() => expect(screen.getByText('Ucapan Anda')).toBeInTheDocument())
  expect(screen.getByText('Turut berbahagia!')).toBeInTheDocument()
})

// F4: kirim gagal 400 "sudah pernah" -> pesan tampil dan form terkunci.
test('kirim ditolak sudah-pernah -> pesan tampil dan form terkunci', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [])
  mockedPost.mockRejectedValue({
    response: { status: 400, data: { success: false, message: 'Anda sudah pernah mengirim ucapan' } },
  })

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByPlaceholderText('Give your wish')).toBeInTheDocument())
  fireEvent.change(screen.getByPlaceholderText('Give your wish'), { target: { value: 'Halo!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => expect(screen.getByText('Anda sudah pernah mengirim ucapan')).toBeInTheDocument())
  expect(screen.queryByPlaceholderText('Give your wish')).not.toBeInTheDocument()
  expect(screen.getByText('Ucapan Anda')).toBeInTheDocument()
})
