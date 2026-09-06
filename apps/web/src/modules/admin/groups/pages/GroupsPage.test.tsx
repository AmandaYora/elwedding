import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import GroupsPage from './GroupsPage'
import { listGroups, createGroup, updateGroup, deleteGroup } from '@/modules/admin/groups/services/groups.service'
import { ToastProvider } from '@/shared/components/toast/ToastProvider'

/** docs/plan/guest-groups/PLAN.md T18. */
function renderPage() {
  return render(
    <ToastProvider>
      <GroupsPage />
    </ToastProvider>,
  )
}

vi.mock('@/modules/admin/groups/services/groups.service', async (importOriginal) => {
  // GROUP_PAGE_SIZE ikut diimpor halaman - dipertahankan nilainya, hanya
  // fungsi jaringannya yang di-mock.
  const actual = await importOriginal<typeof import('@/modules/admin/groups/services/groups.service')>()
  return {
    ...actual,
    listGroups: vi.fn(),
    listAllGroups: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
  }
})

const mockedList = vi.mocked(listGroups)
const mockedCreate = vi.mocked(createGroup)
const mockedUpdate = vi.mocked(updateGroup)
const mockedDelete = vi.mocked(deleteGroup)

const groupKosong = { id: 4, name: 'Keluarga', description: 'Keluarga inti', guestCount: 0, defaultPax: 4, createdAt: '2026-01-01T00:00:00Z' }
const groupTerpakai = { id: 3, name: 'Teman Kantor', description: '', guestCount: 12, defaultPax: 2, createdAt: '2026-01-01T00:00:00Z' }

/** Meniru error Axios: pesan penolakan datang dari `response.data.message` -
 * itulah yang dibaca apiErrorMessage. */
function axiosError(status: number, message: string) {
  return { response: { status, data: { message } } }
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

  await waitFor(() => expect(screen.getByText('Belum ada group')).toBeInTheDocument())
})

// Kolom "Jumlah tamu" WAJIB tampil (T13) - dialah yang menjelaskan kenapa
// sebuah group tidak bisa dihapus, SEBELUM admin mencobanya.
test('daftar tampil beserta jumlah tamunya', async () => {
  mockedList.mockResolvedValue({
    data: [groupTerpakai, groupKosong],
    meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
  })

  renderPage()

  await waitFor(() => expect(screen.getByText('Teman Kantor')).toBeInTheDocument())
  const rowTerpakai = screen.getByText('Teman Kantor').closest('tr') as HTMLElement
  expect(within(rowTerpakai).getByText('12 tamu')).toBeInTheDocument()

  const rowKosong = screen.getByText('Keluarga').closest('tr') as HTMLElement
  expect(within(rowKosong).getByText('0 tamu')).toBeInTheDocument()
  expect(within(rowKosong).getByText('Keluarga inti')).toBeInTheDocument()
})

test('submit form tambah dengan nama kosong -> pesan error, createGroup tidak dipanggil', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada group')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah group' })[0])
  await screen.findByText('Tambah group')

  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  expect(await screen.findByText('Nama group wajib diisi')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

// Nama berisi spasi saja ditolak sama seperti kosong - kembar dengan
// validateGroupName di backend yang juga men-trim lebih dulu.
test('nama berisi spasi saja ditolak', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada group')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah group' })[0])
  await screen.findByText('Tambah group')

  fireEvent.change(screen.getByPlaceholderText('mis. Teman Kantor'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  expect(await screen.findByText('Nama group wajib diisi')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('isi form valid -> createGroup terpanggil dengan nilai ter-trim', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })
  mockedCreate.mockResolvedValueOnce(groupKosong)

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada group')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah group' })[0])
  await screen.findByText('Tambah group')

  fireEvent.change(screen.getByPlaceholderText('mis. Teman Kantor'), { target: { value: '  Keluarga  ' } })
  fireEvent.change(screen.getByPlaceholderText('Keterangan singkat (opsional)'), { target: { value: 'Keluarga inti' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith({ name: 'Keluarga', description: 'Keluarga inti', defaultPax: 2 }))
})

test('ubah group -> updateGroup terpanggil dengan id barisnya', async () => {
  mockedList.mockResolvedValue({ data: [groupKosong], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedUpdate.mockResolvedValueOnce(undefined)

  renderPage()
  await waitFor(() => expect(screen.getByText('Keluarga')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Ubah' }))
  await screen.findByText('Ubah group')

  fireEvent.change(screen.getByDisplayValue('Keluarga'), { target: { value: 'Keluarga Besar' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith(4, { name: 'Keluarga Besar', description: 'Keluarga inti', defaultPax: 4 }),
  )
})

test('klik Hapus -> modal konfirmasi muncul dan TIDAK menghapus sebelum dikonfirmasi', async () => {
  mockedList.mockResolvedValue({ data: [groupKosong], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Keluarga')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))

  expect(await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)).toBeInTheDocument()
  expect(mockedDelete).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
  expect(mockedDelete).not.toHaveBeenCalled()
})

test('konfirmasi hapus group kosong -> deleteGroup terpanggil dengan id yang benar', async () => {
  mockedList.mockResolvedValue({ data: [groupKosong], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedDelete.mockResolvedValueOnce(undefined)

  renderPage()
  await waitFor(() => expect(screen.getByText('Keluarga')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))
  await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)

  const dangerButtons = screen.getAllByRole('button', { name: 'Hapus' })
  fireEvent.click(dangerButtons[dangerButtons.length - 1])

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(4))
})

// K4: penolakan hapus menampilkan PESAN DARI BACKEND apa adanya, bukan
// kalimat yang ditulis ulang di frontend - hanya server yang punya hitungan
// yang segar.
test('hapus group yang masih dipakai ditolak -> pesan backend ditampilkan, baris tetap ada', async () => {
  mockedList.mockResolvedValue({ data: [groupTerpakai], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedDelete.mockRejectedValueOnce(axiosError(400, 'Group tidak bisa dihapus karena masih dipakai 12 tamu'))

  renderPage()
  await waitFor(() => expect(screen.getByText('Teman Kantor')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))
  await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)

  const dangerButtons = screen.getAllByRole('button', { name: 'Hapus' })
  fireEvent.click(dangerButtons[dangerButtons.length - 1])

  expect(await screen.findByText('Group tidak bisa dihapus karena masih dipakai 12 tamu')).toBeInTheDocument()
  // Baris tidak boleh hilang dari tabel hanya karena admin menekan Hapus.
  expect(screen.getAllByText('Teman Kantor').length).toBeGreaterThanOrEqual(1)
})

// Peringatan dini di modal konfirmasi - menghemat satu percobaan yang pasti
// ditolak backend.
test('modal hapus group yang masih dipakai menampilkan peringatan jumlah tamu', async () => {
  mockedList.mockResolvedValue({ data: [groupTerpakai], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Teman Kantor')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))

  expect(await screen.findByText(/masih dipakai 12 tamu/)).toBeInTheDocument()
})

test('nama duplikat ditolak backend -> pesan backend ditampilkan', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })
  mockedCreate.mockRejectedValueOnce(axiosError(400, 'Nama group sudah dipakai'))

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada group')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah group' })[0])
  await screen.findByText('Tambah group')

  fireEvent.change(screen.getByPlaceholderText('mis. Teman Kantor'), { target: { value: 'Keluarga' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  expect(await screen.findByText('Nama group sudah dipakai')).toBeInTheDocument()
})

test('daftar gagal dimuat -> ErrorState dengan tombol coba lagi', async () => {
  mockedList.mockRejectedValue(new Error('500'))

  renderPage()

  expect(await screen.findByText('Gagal memuat data group.')).toBeInTheDocument()
})

// --- Jatah kursi default (docs/plan/guest-pax-quota/PLAN.md T18) ---

test('form group punya field jatah kursi, terisi 2 untuk group baru', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada group')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah group' })[0])
  await screen.findByText('Tambah group')

  // 2 mengikuti DEFAULT kolomnya di migration 000017.
  expect(screen.getByLabelText('Jatah kursi default')).toHaveValue(2)
  expect(screen.getByText(/Bisa diubah per tamu/)).toBeInTheDocument()
})

test('jatah kursi di luar 1..20 -> ditolak sebelum menyentuh service', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada group')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah group' })[0])
  await screen.findByText('Tambah group')
  fireEvent.change(screen.getByPlaceholderText('mis. Teman Kantor'), { target: { value: 'Keluarga' } })

  // 21 lewat batas atas.
  fireEvent.change(screen.getByLabelText('Jatah kursi default'), { target: { value: '21' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
  expect(await screen.findByText('Jumlah tamu maksimal 20')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()

  // Dikosongkan -> Number('') = 0, ditolak batas bawah. Field yang dikosongkan
  // tidak boleh diam-diam tersimpan.
  fireEvent.change(screen.getByLabelText('Jatah kursi default'), { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))
  expect(await screen.findByText('Jumlah tamu minimal 1')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})
