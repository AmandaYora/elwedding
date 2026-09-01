import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from './DashboardPage'
import { getGuestSummary } from '@/modules/admin/guests/services/guests.service'

vi.mock('@/modules/admin/guests/services/guests.service', () => ({
  getGuestSummary: vi.fn(),
}))

const mockedSummary = vi.mocked(getGuestSummary)

afterEach(() => {
  mockedSummary.mockReset()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

// dashboard-wa-rsvp: halaman ditulis ulang jadi KPI + proporsi + 4 kartu
// breakdown + kartu aktivitas terbaru. Angka breakdown sengaja unik (21-24,
// 41-44) supaya tidak bentrok dengan angka KPI (10/0/6/9) saat di-query
// lewat getByText - nilai KPI sendiri di-scope lewat getAllByRole('definition')
// karena hanya 4 <dd> KPI yang dirender (breakdown pakai <span> biasa,
// bukan <dt>/<dd>).
test('KPI, proporsi, breakdown, dan aktivitas terbaru sesuai data', async () => {
  mockedSummary.mockResolvedValueOnce({
    total: 10,
    attending: 6,
    notAttending: 1,
    remindLater: 3,
    pending: 0,
    invitationOnline: 41,
    invitationPhysical: 42,
    souvenirRegular: 43,
    souvenirVip: 44,
    attendingPax: 9,
    sideGroom: 21,
    sideBride: 22,
    genderMale: 23,
    genderFemale: 24,
    recentResponses: [{ name: 'Budi', rsvpStatus: 'attending', attendingCount: 2, respondedAt: new Date().toISOString() }],
  })

  renderPage()

  await waitFor(() => expect(screen.getAllByRole('definition')).toHaveLength(4))
  const kpiValues = screen.getAllByRole('definition').map((el) => el.textContent)
  // Urutan: Total tamu, Sudah konfirmasi (total-pending), Akan hadir (undangan/orang), Belum jawab.
  expect(kpiValues).toEqual(['10', '10', '6/9', '0'])

  // Panel breakdown Pihak/Gender/Jenis undangan/Jenis souvenir.
  expect(screen.getByText('21')).toBeInTheDocument()
  expect(screen.getByText('22')).toBeInTheDocument()
  expect(screen.getByText('23')).toBeInTheDocument()
  expect(screen.getByText('24')).toBeInTheDocument()
  expect(screen.getByText('41')).toBeInTheDocument()
  expect(screen.getByText('42')).toBeInTheDocument()
  expect(screen.getByText('43')).toBeInTheDocument()
  expect(screen.getByText('44')).toBeInTheDocument()

  // Kartu Aktivitas RSVP terbaru.
  expect(screen.getByText('Budi')).toBeInTheDocument()
})

// guest-reservation-split: kartu tetap tampil dengan nilai 0 saat belum ada
// data, bukan diganti EmptyState - sebelumnya EmptyState menggantikan
// seluruh blok KPI/breakdown/aktivitas saat total===0.
test('semua nol -> kartu tetap tampil dengan nilai 0, tanpa NaN', async () => {
  mockedSummary.mockResolvedValueOnce({
    total: 0,
    attending: 0,
    notAttending: 0,
    remindLater: 0,
    pending: 0,
    invitationOnline: 0,
    invitationPhysical: 0,
    souvenirRegular: 0,
    souvenirVip: 0,
    attendingPax: 0,
    sideGroom: 0,
    sideBride: 0,
    genderMale: 0,
    genderFemale: 0,
    recentResponses: [],
  })

  renderPage()

  await waitFor(() => expect(screen.getAllByRole('definition')).toHaveLength(4))
  const kpiValues = screen.getAllByRole('definition').map((el) => el.textContent)
  expect(kpiValues).toEqual(['0', '0', '0/0', '0'])

  expect(screen.queryByText('Belum ada tamu')).not.toBeInTheDocument()
  expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
  expect(screen.getByText('Sudah konfirmasi')).toBeInTheDocument()
  expect(screen.getByText('Belum ada tamu yang merespons RSVP.')).toBeInTheDocument()
})

test('gagal muat -> ErrorState dengan tombol coba lagi', async () => {
  mockedSummary.mockRejectedValueOnce(new Error('network error'))

  renderPage()

  await waitFor(() => expect(screen.getByText('Gagal memuat ringkasan.')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
})
