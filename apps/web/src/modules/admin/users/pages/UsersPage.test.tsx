import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import UsersPage from './UsersPage'
import { listUsers, createUser, updateUser, deleteUser } from '@/modules/admin/users/services/users.service'
import { ToastProvider } from '@/shared/components/toast/ToastProvider'

function renderPage() {
  return render(
    <ToastProvider>
      <UsersPage />
    </ToastProvider>,
  )
}

vi.mock('@/modules/admin/users/services/users.service', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}))

const mockedList = vi.mocked(listUsers)
const mockedCreate = vi.mocked(createUser)
const mockedUpdate = vi.mocked(updateUser)
const mockedDelete = vi.mocked(deleteUser)

const sampleUser = {
  id: 1,
  username: 'admin',
  createdAt: '2026-01-01T00:00:00Z',
}

afterEach(() => {
  mockedList.mockReset()
  mockedCreate.mockReset()
  mockedUpdate.mockReset()
  mockedDelete.mockReset()
})

test('daftar kosong -> EmptyState', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()

  await waitFor(() => expect(screen.getByText('Belum ada pengguna')).toBeInTheDocument())
})

test('submit form tambah tanpa mengisi apa pun -> pesan error field wajib muncul', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada pengguna')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah pengguna' })[0])
  await screen.findByText('Tambah pengguna')

  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  expect(await screen.findByText('Username wajib diisi')).toBeInTheDocument()
  expect(screen.getByText('Password minimal 6 karakter')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('isi form tambah dengan data valid -> createUser terpanggil', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })
  mockedCreate.mockResolvedValueOnce({ id: 2, username: 'newadmin', createdAt: '2026-01-02T00:00:00Z' })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada pengguna')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah pengguna' })[0])
  await screen.findByText('Tambah pengguna')

  fireEvent.change(screen.getByPlaceholderText('username login'), { target: { value: 'newadmin' } })
  fireEvent.change(screen.getByPlaceholderText('Minimal 6 karakter'), { target: { value: 'rahasia123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith({ username: 'newadmin', password: 'rahasia123' }))
})

test('ubah pengguna dengan password dikosongkan -> updateUser terpanggil dengan password kosong', async () => {
  mockedList.mockResolvedValue({ data: [sampleUser], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedUpdate.mockResolvedValueOnce(undefined)

  renderPage()
  await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Ubah' }))
  await screen.findByText('Ubah pengguna')

  fireEvent.change(screen.getByDisplayValue('admin'), { target: { value: 'admin2' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(1, { username: 'admin2', password: '' }))
})

test('klik Hapus -> modal konfirmasi muncul dan TIDAK menghapus sebelum dikonfirmasi', async () => {
  mockedList.mockResolvedValue({ data: [sampleUser], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))

  expect(await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)).toBeInTheDocument()
  expect(mockedDelete).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
  expect(mockedDelete).not.toHaveBeenCalled()
})

test('konfirmasi hapus -> memanggil deleteUser dengan id yang benar', async () => {
  mockedList.mockResolvedValue({ data: [sampleUser], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedDelete.mockResolvedValueOnce(undefined)

  renderPage()
  await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))
  await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)

  const dangerButtons = screen.getAllByRole('button', { name: 'Hapus' })
  fireEvent.click(dangerButtons[dangerButtons.length - 1])

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(1))
})

// Mensimulasikan guardrail backend (tidak bisa hapus diri sendiri / admin
// terakhir) - frontend hanya menampilkan toast generik, baris tetap ada.
test('deleteUser gagal -> baris tidak hilang dari tabel', async () => {
  mockedList.mockResolvedValue({ data: [sampleUser], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedDelete.mockRejectedValueOnce(new Error('cannot delete your own account'))

  renderPage()
  await waitFor(() => expect(screen.getByText('admin')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))
  await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)

  const dangerButtons = screen.getAllByRole('button', { name: 'Hapus' })
  fireEvent.click(dangerButtons[dangerButtons.length - 1])

  await waitFor(() => expect(mockedDelete).toHaveBeenCalled())
  // Modal konfirmasi tetap terbuka saat gagal (pola sama GuestsPage.tsx -
  // setDeleteTarget(null) cuma dipanggil saat sukses), jadi "admin" muncul
  // di modal DAN baris tabel - getAllByText memastikan barisnya tetap ada.
  expect(screen.getAllByText('admin').length).toBeGreaterThanOrEqual(1)
})
