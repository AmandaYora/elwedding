import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import WishesPage from './WishesPage'
import { listWishes, setWishHidden, deleteWish } from '@/modules/admin/wishes/services/wishes.service'
import { ToastProvider } from '@/shared/components/toast/ToastProvider'

/** docs/plan/wedding-wish/PLAN.md T23 (F5/F6). */
function renderPage() {
  return render(
    <ToastProvider>
      <WishesPage />
    </ToastProvider>,
  )
}

vi.mock('@/modules/admin/wishes/services/wishes.service', async (importOriginal) => {
  // WISH_PAGE_SIZE ikut diimpor halaman - dipertahankan nilainya, hanya
  // fungsi jaringannya yang di-mock (pola GroupsPage.test.tsx).
  const actual = await importOriginal<typeof import('@/modules/admin/wishes/services/wishes.service')>()
  return {
    ...actual,
    listWishes: vi.fn(),
    setWishHidden: vi.fn(),
    deleteWish: vi.fn(),
  }
})

const mockedList = vi.mocked(listWishes)
const mockedSetHidden = vi.mocked(setWishHidden)
const mockedDelete = vi.mocked(deleteWish)

const wishTampil = {
  id: 1, guestId: 3, guestName: 'Budi Santoso', guestSide: 'groom' as const,
  message: 'Selamat ya!', isHidden: false, createdAt: '2026-09-15T10:00:00+07:00',
}
const wishSembunyi = {
  id: 2, guestId: 5, guestName: 'Siti', guestSide: 'bride' as const,
  message: 'Bahagia selalu!', isHidden: true, createdAt: '2026-09-15T09:00:00+07:00',
}

afterEach(() => {
  mockedList.mockReset()
  mockedSetHidden.mockReset()
  mockedDelete.mockReset()
})

test('daftar kosong -> EmptyState', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()

  await waitFor(() => expect(screen.getByText('Belum ada ucapan')).toBeInTheDocument())
})

test('daftar gagal dimuat -> ErrorState dengan tombol coba lagi', async () => {
  mockedList.mockRejectedValue(new Error('500'))

  renderPage()

  await waitFor(() => expect(screen.getByText('Gagal memuat data ucapan.')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
})

// F5: daftar tampil; tombol Sembunyikan memanggil service lalu memuat ulang.
test('daftar tampil beserta statusnya; Sembunyikan memanggil service lalu memuat ulang', async () => {
  mockedList.mockResolvedValue({
    data: [wishTampil, wishSembunyi],
    meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
  })
  mockedSetHidden.mockResolvedValue(undefined)

  renderPage()

  await waitFor(() => expect(screen.getByText('Selamat ya!')).toBeInTheDocument())
  expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
  expect(screen.getByText('Tampil')).toBeInTheDocument()
  expect(screen.getByText('Disembunyikan')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Sembunyikan' }))

  await waitFor(() => expect(mockedSetHidden).toHaveBeenCalledWith(1, true))
  // Memuat ulang sesudah aksi: daftar diambil dua kali (awal + sesudah toggle).
  await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
})

test('Tampilkan pada ucapan tersembunyi memanggil service dengan hidden=false', async () => {
  mockedList.mockResolvedValue({
    data: [wishSembunyi],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  mockedSetHidden.mockResolvedValue(undefined)

  renderPage()

  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Tampilkan' }))

  await waitFor(() => expect(mockedSetHidden).toHaveBeenCalledWith(2, false))
})

// F6: hapus meminta konfirmasi lewat Modal lebih dulu.
test('klik Hapus -> modal konfirmasi muncul dan TIDAK menghapus sebelum dikonfirmasi', async () => {
  mockedList.mockResolvedValue({
    data: [wishTampil],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })

  renderPage()

  await waitFor(() => expect(screen.getByText('Selamat ya!')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))

  expect(await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)).toBeInTheDocument()
  expect(mockedDelete).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
  expect(mockedDelete).not.toHaveBeenCalled()
})

test('konfirmasi hapus -> deleteWish terpanggil dengan id yang benar', async () => {
  mockedList.mockResolvedValue({
    data: [wishTampil],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  mockedDelete.mockResolvedValue(undefined)

  renderPage()

  await waitFor(() => expect(screen.getByText('Selamat ya!')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Hapus' }))
  await screen.findByText(/Tindakan ini tidak bisa dibatalkan/)

  const dangerButtons = screen.getAllByRole('button', { name: 'Hapus' })
  fireEvent.click(dangerButtons[dangerButtons.length - 1])

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith(1))
})
