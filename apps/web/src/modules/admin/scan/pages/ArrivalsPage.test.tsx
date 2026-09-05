import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ArrivalsPage from './ArrivalsPage'
import { getCheckinSummary, listArrivals } from '@/modules/admin/scan/services/checkin.service'

vi.mock('@/modules/admin/scan/services/checkin.service', () => ({
  listArrivals: vi.fn(),
  getCheckinSummary: vi.fn(),
}))

const mockedList = vi.mocked(listArrivals)
const mockedSummary = vi.mocked(getCheckinSummary)

const summary = {
  arrivedGroom: 3,
  arrivedBride: 5,
  arrivedTotal: 8,
  arrivedPax: 13,
  totalGuests: 20,
}

const arrivals = [
  {
    id: 1,
    name: 'Budi Santoso',
    side: 'groom',
    souvenirType: 'vip',
    attendingCount: 2,
    checkedInAt: '2026-05-16T19:30:00+07:00',
  },
  {
    id: 2,
    name: 'Siti Aminah',
    side: 'bride',
    souvenirType: 'regular',
    attendingCount: 1,
    checkedInAt: '2026-05-16T18:05:00+07:00',
  },
]

function pageOf(items: typeof arrivals, total = items.length, page = 1) {
  return { data: items, meta: { page, limit: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) } }
}

beforeEach(() => {
  mockedList.mockReset()
  mockedSummary.mockReset()
  mockedList.mockResolvedValue(pageOf(arrivals))
  mockedSummary.mockResolvedValue(summary)
})

test('menampilkan empat angka ringkasan gate', async () => {
  render(<ArrivalsPage />)

  // Tiap kartu dicek bersama labelnya, bukan lewat getByText(angka) polos -
  // beberapa angka bisa muncul lagi di legenda/progres.
  const groom = (await screen.findByText('Pihak Pria')).closest('div')?.parentElement
  expect(within(groom as HTMLElement).getByText('3')).toBeInTheDocument()

  const bride = screen.getByText('Pihak Wanita').closest('div')?.parentElement
  expect(within(bride as HTMLElement).getByText('5')).toBeInTheDocument()

  const arrived = screen.getByText('Total Masuk').closest('div')?.parentElement
  expect(within(arrived as HTMLElement).getByText('8')).toBeInTheDocument()

  const totalGuests = screen.getByText('Total Tamu').closest('div')?.parentElement
  expect(within(totalGuests as HTMLElement).getByText('20')).toBeInTheDocument()
})

test('menampilkan progres kedatangan beserta persentasenya', async () => {
  render(<ArrivalsPage />)

  expect(await screen.findByText('Progres kedatangan')).toBeInTheDocument()
  expect(screen.getByText('40%')).toBeInTheDocument() // 8 dari 20
  expect(screen.getByText(/dari 20 tamu/)).toBeInTheDocument()
})

test('daftar menampilkan nama, pihak, souvenir, dan jam masuk', async () => {
  render(<ArrivalsPage />)

  expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
  expect(screen.getByText('Mempelai Pria')).toBeInTheDocument()
  expect(screen.getByText('Souvenir VIP')).toBeInTheDocument()
  expect(screen.getByText('19.30')).toBeInTheDocument()

  expect(screen.getByText('Siti Aminah')).toBeInTheDocument()
  expect(screen.getByText('Mempelai Wanita')).toBeInTheDocument()
  expect(screen.getByText('Souvenir reguler')).toBeInTheDocument()
  expect(screen.getByText('18.05')).toBeInTheDocument()
})

test('belum ada tamu masuk -> EmptyState, bukan tabel kosong', async () => {
  mockedList.mockResolvedValue(pageOf([], 0))
  mockedSummary.mockResolvedValue({ ...summary, arrivedGroom: 0, arrivedBride: 0, arrivedTotal: 0, arrivedPax: 0 })

  render(<ArrivalsPage />)

  expect(await screen.findByText('Belum ada tamu yang masuk')).toBeInTheDocument()
})

// Daftar tamu masih kosong -> pembagi 0. Tanpa penjagaan, persentasenya
// jadi NaN dan tampil sebagai "NaN%" di layar gate.
test('total tamu 0 -> progres 0%, bukan NaN', async () => {
  mockedList.mockResolvedValue(pageOf([], 0))
  mockedSummary.mockResolvedValue({
    arrivedGroom: 0, arrivedBride: 0, arrivedTotal: 0, arrivedPax: 0, totalGuests: 0,
  })

  render(<ArrivalsPage />)

  expect(await screen.findByText('0%')).toBeInTheDocument()
  expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
})

test('gagal memuat -> ErrorState dengan tombol coba lagi', async () => {
  mockedList.mockRejectedValue(new Error('Network Error'))

  render(<ArrivalsPage />)

  expect(await screen.findByText('Gagal memuat daftar tamu masuk.')).toBeInTheDocument()
})

test('tombol Muat ulang mengambil ulang daftar dan ringkasan', async () => {
  render(<ArrivalsPage />)
  await screen.findByText('Budi Santoso')
  expect(mockedList).toHaveBeenCalledTimes(1)

  fireEvent.click(screen.getByRole('button', { name: /Muat ulang/ }))

  await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2))
  expect(mockedSummary).toHaveBeenCalledTimes(2)
})

// Daftar ini berpaginasi (beda dari pencarian di menu Scan) - halaman
// pertama diminta dengan page=1, dan ukurannya 20 sesuai paginasi admin.
test('memuat halaman pertama dengan ukuran 20', async () => {
  render(<ArrivalsPage />)
  await waitFor(() => expect(mockedList).toHaveBeenCalledWith(1, 20))
})
