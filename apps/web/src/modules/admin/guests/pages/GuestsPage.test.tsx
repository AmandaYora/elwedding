import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import GuestsPage from './GuestsPage'
import { listGuests, deleteGuest } from '@/modules/admin/guests/services/guests.service'
import { ToastProvider } from '@/shared/components/toast/ToastProvider'

function renderPage() {
  return render(
    <ToastProvider>
      <GuestsPage />
    </ToastProvider>,
  )
}

vi.mock('@/modules/admin/guests/services/guests.service', () => ({
  listGuests: vi.fn(),
  createGuest: vi.fn(),
  updateGuest: vi.fn(),
  deleteGuest: vi.fn(),
}))

const mockedList = vi.mocked(listGuests)
const mockedDelete = vi.mocked(deleteGuest)

const sampleGuest = {
  id: 1,
  name: 'Budi Santoso',
  phone: '0812345678',
  side: 'groom' as const,
  token: 'abc123',
  rsvpStatus: 'attending' as const,
  rsvpRespondedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  gender: 'male' as const,
  invitationType: 'online' as const,
  souvenirType: 'regular' as const,
  email: 'budi@example.com',
  address: 'Jl. Merdeka No. 1',
  notes: '',
  attendingCount: 1,
  isExpectedAttending: true,
}

afterEach(() => {
  mockedList.mockReset()
  mockedDelete.mockReset()
})

test('daftar kosong -> EmptyState', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()

  await waitFor(() => expect(screen.getByText('Belum ada tamu')).toBeInTheDocument())
})

test('ketik pencarian -> service dipanggil dengan q (setelah debounce)', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', respondedOnly: false }),
  )

  fireEvent.change(screen.getByPlaceholderText('Cari nama, telepon, atau email...'), { target: { value: 'budi' } })

  await waitFor(
    () => expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: 'budi', invitationType: '', souvenirType: '', respondedOnly: false }),
    { timeout: 2000 },
  )
})

test('klik Hapus -> modal konfirmasi muncul dan TIDAK menghapus sebelum dikonfirmasi', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))

  expect(await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)).toBeInTheDocument()
  expect(mockedDelete).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
  expect(mockedDelete).not.toHaveBeenCalled()
})

test('konfirmasi hapus -> memanggil deleteGuest', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedDelete.mockResolvedValueOnce(undefined)

  renderPage()
  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))
  await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)

  const dangerButtons = screen.getAllByRole('button', { name: 'Hapus' })
  fireEvent.click(dangerButtons[dangerButtons.length - 1])

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(1))
})

// guest-fields-admin-layout E2-2: submit form tanpa gender harus
// menampilkan pesan error inline, bukan hilang tanpa jejak (regresi B3 -
// formErrors lama hanya mengenal name/phone).
test('submit form tambah tamu tanpa mengisi apa pun -> pesan error field wajib muncul', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada tamu')).toBeInTheDocument())

  // EmptyState juga merender tombol "+ Tambah tamu" saat daftar kosong,
  // jadi ambil tombol pertama (di PageHeader) - hindari ambiguitas.
  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah tamu' })[0])
  await screen.findByText('Tambah tamu')

  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  expect(await screen.findByText('Nama wajib diisi')).toBeInTheDocument()
})

// guest-fields-admin-layout E2-3: filter jenis undangan mengirim
// invitationType terisi ke listGuests.
test('ubah filter jenis undangan -> listGuests dipanggil dengan invitationType terisi', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', respondedOnly: false }),
  )

  fireEvent.change(screen.getByDisplayValue('Semua jenis undangan'), { target: { value: 'physical' } })

  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: '', invitationType: 'physical', souvenirType: '', respondedOnly: false }),
  )
})
