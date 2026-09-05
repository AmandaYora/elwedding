import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ReservationsPage from './ReservationsPage'
import { listGuests } from '@/modules/admin/guests/services/guests.service'

vi.mock('@/modules/admin/guests/services/guests.service', () => ({
  listGuests: vi.fn(),
}))

const mockedList = vi.mocked(listGuests)

const sampleGuest = {
  id: 1,
  name: 'Budi Santoso',
  phone: '0812345678',
  side: 'groom' as const,
  token: 'abc123',
  rsvpStatus: 'attending' as const,
  rsvpRespondedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  gender: 'male' as const,
  invitationType: 'online' as const,
  souvenirType: 'regular' as const,
  email: 'budi@example.com',
  address: 'Jl. Merdeka No. 1',
  notes: '',
  attendingCount: 2,
  isExpectedAttending: true,
  groupId: 3,
}

afterEach(() => {
  mockedList.mockReset()
})

test('mount awal -> memanggil listGuests dengan respondedOnly true', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  render(<ReservationsPage />)

  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: true }),
  )
})

test('tamu berstatus attending -> menampilkan badge & jumlah tamu', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  render(<ReservationsPage />)

  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())
  const row = screen.getByText('Budi Santoso').closest('tr') as HTMLElement
  expect(within(row).getByText('Hadir')).toBeInTheDocument()
  expect(within(row).getByText('2 org')).toBeInTheDocument()
})

test('memilih sub-filter status -> listGuests dipanggil ulang dengan status terpilih', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  render(<ReservationsPage />)
  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: true }),
  )

  fireEvent.change(screen.getByDisplayValue('Semua status'), { target: { value: 'not_attending' } })

  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({
      page: 1,
      status: 'not_attending',
      q: '',
      invitationType: '',
      souvenirType: '',
      groupId: '',
      respondedOnly: true,
    }),
  )
})

test('daftar kosong -> EmptyState "Belum ada tamu yang merespons"', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  render(<ReservationsPage />)

  await waitFor(() => expect(screen.getByText('Belum ada tamu yang merespons')).toBeInTheDocument())
})

test('gagal memuat -> ErrorState dengan tombol coba lagi', async () => {
  mockedList.mockRejectedValue(new Error('network error'))

  render(<ReservationsPage />)

  await waitFor(() => expect(screen.getByText('Gagal memuat data reservasi.')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
})

test('klik Detail -> modal menampilkan info kontak & status RSVP', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  render(<ReservationsPage />)
  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Detail' }))

  expect(await screen.findByText('budi@example.com')).toBeInTheDocument()
  expect(screen.getByText('2 orang')).toBeInTheDocument()
})

test('tidak ada tombol Tambah, Ubah, Hapus, atau Salin link', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  render(<ReservationsPage />)
  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())

  expect(screen.queryByRole('button', { name: /Tambah tamu/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Ubah' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Hapus' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Salin link/ })).not.toBeInTheDocument()
})
