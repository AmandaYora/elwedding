import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import GuestsPage from './GuestsPage'
import { listGuests, createGuest, deleteGuest } from '@/modules/admin/guests/services/guests.service'
import { getConfig } from '@/modules/admin/whatsapp/services/whatsapp.service'
import { getContent } from '@/modules/admin/content/services/content.service'
import { listAllGroups } from '@/modules/admin/groups/services/groups.service'
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

// Tombol "Kirim Undangan" memuat dua singleton di samping daftar tamu
// (docs/plan/og-share-image-dinamis/PLAN.md T24). Keduanya di-mock supaya
// test tidak menembus httpClient.
vi.mock('@/modules/admin/whatsapp/services/whatsapp.service', () => ({
  getConfig: vi.fn(),
}))
vi.mock('@/modules/admin/content/services/content.service', () => ({
  getContent: vi.fn(),
}))

// Daftar group dimuat sekali oleh halaman ini (guest-groups D2/T16) - di-mock
// supaya test tidak menembus httpClient, sama seperti dua singleton di atas.
vi.mock('@/modules/admin/groups/services/groups.service', () => ({
  listAllGroups: vi.fn(),
}))

const mockedList = vi.mocked(listGuests)
const mockedDelete = vi.mocked(deleteGuest)
const mockedCreate = vi.mocked(createGuest)
const mockedGetConfig = vi.mocked(getConfig)
const mockedGetContent = vi.mocked(getContent)
const mockedListAllGroups = vi.mocked(listAllGroups)

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
  groupId: 3,
}

const sampleGroups = [
  { id: 3, name: 'Teman Kantor', description: '', guestCount: 1, createdAt: '2026-01-01T00:00:00Z' },
  { id: 4, name: 'Keluarga', description: '', guestCount: 0, createdAt: '2026-01-01T00:00:00Z' },
]

const sampleConfig = {
  messageTemplate: 'Halo {nama}, {jumlah} orang',
  invitationTemplate: 'Halo {nama}, undangan {mempelai} pada {tanggal}: {link}',
  isEnabled: true,
}

const sampleContent = {
  brideName: 'Ariana',
  groomName: 'Adrian',
  weddingDateLabel: 'Sabtu, 16 Mei 2026',
} as unknown as Awaited<ReturnType<typeof getContent>>

beforeEach(() => {
  // Default "jalan normal" - test yang menguji jalur gagal menimpanya sendiri.
  mockedGetConfig.mockResolvedValue(sampleConfig)
  mockedGetContent.mockResolvedValue(sampleContent)
  mockedListAllGroups.mockResolvedValue(sampleGroups)
})

afterEach(() => {
  mockedList.mockReset()
  mockedDelete.mockReset()
  mockedCreate.mockReset()
  mockedGetConfig.mockReset()
  mockedGetContent.mockReset()
  mockedListAllGroups.mockReset()
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
    expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false }),
  )

  fireEvent.change(screen.getByPlaceholderText('Cari nama, telepon, atau email...'), { target: { value: 'budi' } })

  await waitFor(
    () => expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: 'budi', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false }),
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
    expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false }),
  )

  fireEvent.change(screen.getByDisplayValue('Semua jenis undangan'), { target: { value: 'physical' } })

  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: '', invitationType: 'physical', souvenirType: '', groupId: '', respondedOnly: false }),
  )
})

// --- tombol "Kirim Undangan" (docs/plan/og-share-image-dinamis/PLAN.md T24) ---

test('tamu ber-nomor -> tombol Kirim Undangan berupa <a> wa.me dengan pesan terisi', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()

  const link = await screen.findByRole('link', { name: /Kirim Undangan/ })
  const href = link.getAttribute('href') as string

  // 0812345678 -> 62812345678 (aturan cermin normalizePhone Go).
  expect(href.startsWith('https://wa.me/62812345678?text=')).toBe(true)
  // Anchor WAJIB aman dibuka di tab baru.
  expect(link).toHaveAttribute('target', '_blank')
  expect(link).toHaveAttribute('rel', 'noopener noreferrer')

  // Pesannya utuh setelah didecode - bukti encodeURIComponent bekerja pada
  // '?' & '&' yang justru datang dari URL undangan itu sendiri.
  const text = decodeURIComponent(href.slice(href.indexOf('?text=') + '?text='.length))
  expect(text).toContain('Halo Budi Santoso')
  expect(text).toContain('Adrian & Ariana')
  expect(text).toContain('Sabtu, 16 Mei 2026')
  expect(text).toContain('/?guest=abc123')
})

// K7: tamu tanpa nomor -> tombol NONAKTIF, dan WAJIB non-anchor. <a> yang
// "di-disable" lewat atribut tetap bisa diklik.
test('tamu tanpa nomor HP -> tombol nonaktif non-anchor dengan title yang menjelaskan', async () => {
  mockedList.mockResolvedValue({
    data: [{ ...sampleGuest, phone: '' }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })

  renderPage()

  const btn = await screen.findByRole('button', { name: /Kirim Undangan/ })
  expect(btn).toBeDisabled()
  expect(btn).toHaveAttribute('title', expect.stringContaining('Nomor HP'))
  expect(screen.queryByRole('link', { name: /Kirim Undangan/ })).not.toBeInTheDocument()
})

// Jalur gagal: daftar tamu TETAP tampil normal, hanya tombolnya nonaktif -
// bukan halaman error.
test('config WhatsApp gagal dimuat -> daftar tamu tetap tampil, tombol nonaktif', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedGetConfig.mockRejectedValue(new Error('500'))

  renderPage()

  expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
  const btn = await screen.findByRole('button', { name: /Kirim Undangan/ })
  expect(btn).toBeDisabled()
  expect(screen.queryByRole('link', { name: /Kirim Undangan/ })).not.toBeInTheDocument()
})

test('template undangan kosong -> tombol nonaktif dengan title yang menyebut template', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedGetConfig.mockResolvedValue({ ...sampleConfig, invitationTemplate: '   ' })

  renderPage()

  const btn = await screen.findByRole('button', { name: /Kirim Undangan/ })
  expect(btn).toBeDisabled()
  expect(btn).toHaveAttribute('title', expect.stringContaining('Template'))
})

// --- group tamu (docs/plan/guest-groups/PLAN.md T18) ---

test('kolom Group menampilkan nama yang dipetakan dari daftar group', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()

  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())
  const row = screen.getByText('Budi Santoso').closest('tr') as HTMLElement
  // Nama datang dari listAllGroups (D2), BUKAN dari respons daftar tamu -
  // backend hanya mengirim groupId.
  expect(within(row).getByText('Teman Kantor')).toBeInTheDocument()
})

// 2.6: tamu lama bergroup kosong tampil sebagai strip, bukan kosong melompong
// atau "undefined".
test('tamu tanpa group (groupId null) -> kolom Group menampilkan strip', async () => {
  mockedList.mockResolvedValue({
    data: [{ ...sampleGuest, groupId: null }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })

  renderPage()

  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())
  const row = screen.getByText('Budi Santoso').closest('tr') as HTMLElement
  expect(within(row).getByText('—')).toBeInTheDocument()
})

test('ubah filter Group -> listGuests dipanggil dengan groupId terisi', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByDisplayValue('Semua group')).toBeInTheDocument())

  fireEvent.change(screen.getByDisplayValue('Semua group'), { target: { value: '4' } })

  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({
      page: 1,
      status: '',
      q: '',
      invitationType: '',
      souvenirType: '',
      groupId: '4',
      respondedOnly: false,
    }),
  )
})

test('submit form tamu tanpa memilih group -> pesan error dan createGuest tidak dipanggil', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada tamu')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah tamu' })[0])
  await screen.findByText('Tambah tamu')

  fireEvent.change(screen.getByPlaceholderText('Nama lengkap tamu'), { target: { value: 'Siti' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  expect(await screen.findByText('Group wajib dipilih')).toBeInTheDocument()
  expect(mockedCreate).not.toHaveBeenCalled()
})

test('pilih group di form -> createGuest terpanggil dengan groupId terisi', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })
  mockedCreate.mockResolvedValueOnce({ ...sampleGuest, id: 9, name: 'Siti' })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada tamu')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('button', { name: '+ Tambah tamu' })[0])
  await screen.findByText('Tambah tamu')

  fireEvent.change(screen.getByPlaceholderText('Nama lengkap tamu'), { target: { value: 'Siti' } })
  fireEvent.change(screen.getByDisplayValue('Pilih group...'), { target: { value: '4' } })
  fireEvent.click(screen.getByRole('button', { name: 'Simpan' }))

  await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Siti', groupId: 4 })))
})

// 2.5 butir 1: instalasi baru tanpa group sama sekali. TANPA penjaga ini,
// menu Tamu mati total - form mewajibkan group sementara dropdown-nya kosong.
test('daftar group kosong -> tombol Tambah tamu nonaktif + ajakan membuat group', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })
  mockedListAllGroups.mockResolvedValue([])

  renderPage()

  expect(await screen.findByText('Belum ada group tamu')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Buat group' })).toHaveAttribute('href', '/admin/groups')
  await waitFor(() => {
    for (const btn of screen.getAllByRole('button', { name: /Tambah tamu/ })) {
      expect(btn).toBeDisabled()
    }
  })
})

// 2.5 butir 2: gejalanya identik dengan di atas tapi SEBABNYA beda - pesannya
// wajib berbeda, dan daftar tamu tetap harus terbaca.
test('daftar group gagal dimuat -> pesan berbeda + daftar tamu tetap tampil', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedListAllGroups.mockRejectedValue(new Error('500'))

  renderPage()

  expect(await screen.findByText('Daftar group gagal dimuat')).toBeInTheDocument()
  expect(screen.queryByText('Belum ada group tamu')).not.toBeInTheDocument()
  expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
  await waitFor(() => {
    for (const btn of screen.getAllByRole('button', { name: /Tambah tamu/ })) {
      expect(btn).toBeDisabled()
    }
  })
})
