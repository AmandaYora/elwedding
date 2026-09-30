import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import GuestsPage from './GuestsPage'
import { listGuests, createGuest, deleteGuest, setContacted, previewInvitation, sendInvitation } from '@/modules/admin/guests/services/guests.service'
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
  setContacted: vi.fn(),
  previewInvitation: vi.fn(),
  sendInvitation: vi.fn(),
}))

// Daftar group dimuat sekali oleh halaman ini (guest-groups D2/T16) - di-mock
// supaya test tidak menembus httpClient, sama seperti dua singleton di atas.
vi.mock('@/modules/admin/groups/services/groups.service', () => ({
  listAllGroups: vi.fn(),
}))

const mockedList = vi.mocked(listGuests)
const mockedDelete = vi.mocked(deleteGuest)
const mockedCreate = vi.mocked(createGuest)
const mockedListAllGroups = vi.mocked(listAllGroups)
const mockedSetContacted = vi.mocked(setContacted)
const mockedPreviewInvitation = vi.mocked(previewInvitation)
const mockedSendInvitation = vi.mocked(sendInvitation)

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
  usernameTelegram: '',
  address: 'Jl. Merdeka No. 1',
  notes: '',
  attendingCount: 1,
  isExpectedAttending: true,
  groupId: 3,
  paxQuota: 2,
  contactedAt: null,
}

// defaultPax sengaja BERBEDA antar group (2 vs 4) - kalau sama, test prefill
// di bawah tidak membuktikan apa pun.
const sampleGroups = [
  { id: 3, name: 'Teman Kantor', description: '', guestCount: 1, defaultPax: 2, createdAt: '2026-01-01T00:00:00Z' },
  { id: 4, name: 'Keluarga', description: '', guestCount: 0, defaultPax: 4, createdAt: '2026-01-01T00:00:00Z' },
]

const samplePreview = {
  channel: 'wa' as const,
  target: '0812345678',
  text: 'Halo Budi Santoso, undangan Adrian & Ariana pada Sabtu, 16 Mei 2026: https://x/?guest=abc123',
}

beforeEach(() => {
  // Default "jalan normal" - test yang menguji jalur gagal menimpanya sendiri.
  mockedListAllGroups.mockResolvedValue(sampleGroups)
  mockedPreviewInvitation.mockResolvedValue(samplePreview)
  mockedSendInvitation.mockResolvedValue(undefined)
})

afterEach(() => {
  mockedList.mockReset()
  mockedDelete.mockReset()
  mockedCreate.mockReset()
  mockedListAllGroups.mockReset()
  mockedSetContacted.mockReset()
  mockedPreviewInvitation.mockReset()
  mockedSendInvitation.mockReset()
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

// --- tombol kirim undangan via modul (modal preview) ---

test('tamu ber-nomor -> klik Kirim WA membuka modal berisi preview dari server', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Kirim WA' }))

  await waitFor(() => expect(mockedPreviewInvitation).toHaveBeenCalledWith(1, 'wa'))
  // Teks preview datang dari server, bukan dirakit di klien.
  expect(await screen.findByText(/Halo Budi Santoso/)).toBeInTheDocument()
  expect(screen.getByText('0812345678')).toBeInTheDocument()
  // Belum ada pengiriman sebelum admin menekan Kirim di modal.
  expect(mockedSendInvitation).not.toHaveBeenCalled()
})

test('klik Kirim di modal -> sendInvitation dipanggil + badge Dihubungi muncul', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Kirim WA' }))
  await screen.findByText(/Halo Budi Santoso/)

  fireEvent.click(screen.getByRole('button', { name: 'Kirim' }))

  await waitFor(() => expect(mockedSendInvitation).toHaveBeenCalledWith(1, 'wa'))
  // Badge muncul dari respons yang SUKSES, bukan optimistis.
  expect(await screen.findByRole('button', { name: /Dihubungi/ })).toBeInTheDocument()
})

test('klik Batal di modal -> sendInvitation tidak dipanggil, modal tertutup', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Kirim WA' }))
  await screen.findByText(/Halo Budi Santoso/)

  fireEvent.click(screen.getByRole('button', { name: 'Batal' }))

  expect(mockedSendInvitation).not.toHaveBeenCalled()
  await waitFor(() => expect(screen.queryByText(/Halo Budi Santoso/)).not.toBeInTheDocument())
})

test('tamu ber-username Telegram -> klik Kirim TG memakai kanal tg', async () => {
  mockedList.mockResolvedValue({
    data: [{ ...sampleGuest, usernameTelegram: 'budi_santoso' }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  mockedPreviewInvitation.mockResolvedValue({ channel: 'tg', target: '@budi_santoso', text: 'Halo Budi' })

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Kirim TG' }))

  await waitFor(() => expect(mockedPreviewInvitation).toHaveBeenCalledWith(1, 'tg'))
  expect(await screen.findByText('@budi_santoso')).toBeInTheDocument()
})

// K7: tamu tanpa nomor -> tombol WA NONAKTIF dengan title yang menjelaskan.
test('tamu tanpa nomor HP -> tombol Kirim WA nonaktif dengan title yang menjelaskan', async () => {
  mockedList.mockResolvedValue({
    data: [{ ...sampleGuest, phone: '' }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })

  renderPage()

  const btn = await screen.findByRole('button', { name: 'Kirim WA' })
  expect(btn).toBeDisabled()
  expect(btn).toHaveAttribute('title', expect.stringContaining('Nomor HP'))
  fireEvent.click(btn)
  expect(mockedPreviewInvitation).not.toHaveBeenCalled()
})

test('tamu tanpa username Telegram -> tombol Kirim TG nonaktif dengan title yang menjelaskan', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()

  const btn = await screen.findByRole('button', { name: 'Kirim TG' })
  expect(btn).toBeDisabled()
  expect(btn).toHaveAttribute('title', expect.stringContaining('Telegram'))
})

// Preview gagal (modul mati/template kosong): daftar tamu TETAP tampil,
// pesannya tampil DI DALAM modal - bukan halaman error.
test('preview gagal dimuat -> modal menampilkan pesan error', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedPreviewInvitation.mockRejectedValueOnce(new Error('Modul WhatsApp tidak aktif di server ini'))

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Kirim WA' }))

  expect(await screen.findByText('Tidak bisa mengirim')).toBeInTheDocument()
  expect(screen.getByText(/tidak aktif/)).toBeInTheDocument()
  expect(await screen.findByText('Budi Santoso')).toBeInTheDocument()
})

// Kirim gagal: modal tetap terbuka dengan pesannya, badge tidak muncul,
// admin bisa menekan Kirim lagi.
test('kirim gagal -> modal tetap terbuka, badge tidak muncul', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedSendInvitation.mockRejectedValueOnce(new Error('koneksi WhatsApp belum siap'))

  renderPage()
  fireEvent.click(await screen.findByRole('button', { name: 'Kirim WA' }))
  await screen.findByText(/Halo Budi Santoso/)

  fireEvent.click(screen.getByRole('button', { name: 'Kirim' }))

  await waitFor(() => expect(screen.getByText(/belum siap/)).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: /Dihubungi/ })).not.toBeInTheDocument()
  // Modalnya masih di sana - bukan tertutup diam-diam.
  expect(screen.getByRole('button', { name: 'Kirim' })).toBeInTheDocument()
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

// --- Jatah kursi (docs/plan/guest-pax-quota/PLAN.md T20/D8/D9) ---
//
// Dua test di bawah menjaga jebakan paling mahal di fitur ini. Keduanya
// menguji SATU perilaku yang sama dari dua arah berlawanan: prefill HARUS
// jalan saat memilih group, dan HARUS DIAM saat membuka tamu lama.

test('pilih group pada tamu baru -> jatah kursi terisi dari defaultPax group', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })
  mockedListAllGroups.mockResolvedValue(sampleGroups)

  renderPage()
  await waitFor(() => expect(mockedListAllGroups).toHaveBeenCalled())

  fireEvent.click(screen.getAllByRole('button', { name: /Tambah tamu/ })[0])

  const jatah = await screen.findByLabelText('Jatah kursi')
  // EMPTY_FORM.paxQuota = 2, mengikuti DEFAULT kolomnya.
  expect(jatah).toHaveValue(2)

  // Pilih "Keluarga" (defaultPax 4) -> jatah ikut jadi 4.
  fireEvent.change(screen.getByLabelText('Group'), { target: { value: '4' } })
  await waitFor(() => expect(jatah).toHaveValue(4))

  // Pindah ke "Teman Kantor" (defaultPax 2) -> ikut turun lagi. Prefill
  // bekerja dua arah, bukan cuma menaikkan.
  fireEvent.change(screen.getByLabelText('Group'), { target: { value: '3' } })
  await waitFor(() => expect(jatah).toHaveValue(2))
})

// D9 - inilah yang paling mudah rusak dan paling sulit ketahuan: kalau prefill
// ikut jalan saat openEdit, menyunting nama Paman Budi diam-diam mengembalikan
// jatahnya dari 6 ke 4 (defaultPax group Keluarga) dan angka catering rusak
// tanpa jejak.
test('buka edit tamu -> jatah kursi memakai nilai TERSIMPAN, bukan defaultPax group', async () => {
  const pamanBudi = { ...sampleGuest, id: 9, name: 'Paman Budi', groupId: 4, paxQuota: 6 }
  mockedList.mockResolvedValue({ data: [pamanBudi], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedListAllGroups.mockResolvedValue(sampleGroups)

  renderPage()
  await screen.findByText('Paman Budi')

  fireEvent.click(screen.getAllByRole('button', { name: 'Ubah' })[0])

  // 6 (tersimpan), BUKAN 4 (defaultPax group Keluarga yang ia tempati).
  const jatah = await screen.findByLabelText('Jatah kursi')
  expect(jatah).toHaveValue(6)

  // Menyunting field LAIN tidak boleh menyentuh jatahnya.
  fireEvent.change(screen.getByLabelText('Nama'), { target: { value: 'Paman Budi Santoso' } })
  expect(jatah).toHaveValue(6)
})

// --- Penanda "sudah dihubungi" (docs/plan/reservation-reset-contacted-flag/PLAN.md T10) ---

test('kirim WA sukses -> penanda menyala TANPA PATCH manual terpisah', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  await screen.findByText('Budi Santoso')

  fireEvent.click(await screen.findByRole('button', { name: 'Kirim WA' }))
  await screen.findByText(/Halo Budi Santoso/)
  fireEvent.click(screen.getByRole('button', { name: 'Kirim' }))

  await waitFor(() => expect(mockedSendInvitation).toHaveBeenCalledWith(1, 'wa'))
  // Server menyalakan contacted_at; klien TIDAK perlu PATCH /contacted lagi.
  expect(mockedSetContacted).not.toHaveBeenCalled()
  // Badge muncul dari respons yang SUKSES, bukan optimistis.
  expect(await screen.findByRole('button', { name: /Dihubungi/ })).toBeInTheDocument()
})

test('klik badge "Dihubungi" -> membatalkan penanda', async () => {
  const sudahDihubungi = { ...sampleGuest, contactedAt: '2026-01-01T00:00:00Z' }
  mockedList.mockResolvedValue({ data: [sudahDihubungi], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedSetContacted.mockResolvedValueOnce(undefined)

  renderPage()
  const badge = await screen.findByRole('button', { name: /Dihubungi/ })

  fireEvent.click(badge)

  await waitFor(() => expect(mockedSetContacted).toHaveBeenCalledWith(1, false))
  await waitFor(() => expect(screen.queryByRole('button', { name: /Dihubungi/ })).not.toBeInTheDocument())
})

// D10 - gagal DIAM-DIAM lebih berbahaya daripada gagal: admin mengira tamu
// sudah tertandai lalu melewatinya. Kegagalan kirim tampil di modal dan badge
// tidak muncul.
test('kirim gagal -> badge tidak muncul, tidak melempar', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })
  mockedSendInvitation.mockRejectedValueOnce(new Error('500'))

  renderPage()
  await screen.findByText('Budi Santoso')

  fireEvent.click(await screen.findByRole('button', { name: 'Kirim WA' }))
  await screen.findByText(/Halo Budi Santoso/)
  fireEvent.click(screen.getByRole('button', { name: 'Kirim' }))

  await waitFor(() => expect(mockedSendInvitation).toHaveBeenCalledWith(1, 'wa'))
  expect(screen.queryByRole('button', { name: /Dihubungi/ })).not.toBeInTheDocument()
})

test('tamu tanpa nomor HP -> tombol WA nonaktif, tidak ada preview maupun penanda', async () => {
  const tanpaHp = { ...sampleGuest, phone: '' }
  mockedList.mockResolvedValue({ data: [tanpaHp], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  await screen.findByText('Budi Santoso')

  const btn = await screen.findByRole('button', { name: 'Kirim WA' })
  expect(btn).toBeDisabled()
  fireEvent.click(btn)

  expect(mockedPreviewInvitation).not.toHaveBeenCalled()
  expect(mockedSetContacted).not.toHaveBeenCalled()
})

// ---------------------------------------------------------------------------
// Filter tahap undangan (docs/plan/guest-stage-filter T14)
// ---------------------------------------------------------------------------

/** Menunggu pemuatan pertama selesai, supaya assertion di bawah tidak keliru
 * membaca panggilan awal halaman sebagai hasil pilihan dropdown. */
async function waitFirstLoad() {
  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false }),
  )
}

test('pilih "Belum diundang" -> status pending + contacted false', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFirstLoad()

  fireEvent.change(screen.getByDisplayValue('Semua status'), { target: { value: 'not_invited' } })

  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({
      page: 1,
      status: 'pending',
      contacted: 'false',
      q: '',
      invitationType: '',
      souvenirType: '',
      groupId: '',
      respondedOnly: false,
    }),
  )
})

// Dua kategori ini SAMA-SAMA rsvp_status 'pending' dan hanya dibedakan oleh
// contacted. Kalau pemetaannya tertukar, daftar "sudah diundang, belum
// menjawab" akan berisi orang yang justru belum pernah dihubungi - dan tidak
// ada gejala lain yang menunjukkannya.
test('pilih "Menunggu konfirmasi" -> status pending + contacted true', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFirstLoad()

  fireEvent.change(screen.getByDisplayValue('Semua status'), { target: { value: 'awaiting_confirmation' } })

  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({
      page: 1,
      status: 'pending',
      contacted: 'true',
      q: '',
      invitationType: '',
      souvenirType: '',
      groupId: '',
      respondedOnly: false,
    }),
  )
})

// "Jawaban tamu menang": begitu tamu menjawab, contacted_at tidak lagi jadi
// pembeda - tamu yang undangannya dikirim di luar aplikasi tetap harus muncul.
test('pilih "Konfirmasi hadir" -> status attending tanpa menyaring contacted', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFirstLoad()

  fireEvent.change(screen.getByDisplayValue('Semua status'), { target: { value: 'confirmed_attending' } })

  await waitFor(() =>
    expect(mockedList).toHaveBeenCalledWith({
      page: 1,
      status: 'attending',
      contacted: '',
      q: '',
      invitationType: '',
      souvenirType: '',
      groupId: '',
      respondedOnly: false,
    }),
  )
})

// Penjaga keputusan T9: cabang tanpa-filter TIDAK boleh menambahkan
// `contacted: ''`. Objeknya harus identik dengan panggilan awal halaman -
// itulah yang membuat 23 test lama di berkas ini tetap hijau tanpa disunting.
test('kembali ke "Semua status" -> objek panggilan identik dengan pemuatan awal', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFirstLoad()

  fireEvent.change(screen.getByDisplayValue('Semua status'), { target: { value: 'remind_later' } })
  await waitFor(() => expect(mockedList).toHaveBeenCalledWith(expect.objectContaining({ status: 'remind_later' })))

  fireEvent.change(screen.getByDisplayValue('Minta diingatkan kembali'), { target: { value: '' } })

  await waitFor(() => {
    const last = mockedList.mock.calls[mockedList.mock.calls.length - 1][0]
    expect(last).not.toHaveProperty('contacted')
    expect(last).toEqual({ page: 1, status: '', q: '', invitationType: '', souvenirType: '', groupId: '', respondedOnly: false })
  })
})

test('ubah filter tahap saat di halaman 2 -> balik ke halaman 1', async () => {
  // total 25 dengan PAGE_SIZE 20 -> 2 halaman, sehingga "Berikutnya" aktif.
  // Pagination di repo ini memakai tombol Sebelumnya/Berikutnya, bukan nomor
  // halaman.
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 25, totalPages: 2 } })

  renderPage()
  await waitFirstLoad()

  fireEvent.click(screen.getByRole('button', { name: /Berikutnya/ }))
  await waitFor(() => expect(mockedList).toHaveBeenCalledWith(expect.objectContaining({ page: 2 })))

  fireEvent.change(screen.getByDisplayValue('Semua status'), { target: { value: 'not_invited' } })

  await waitFor(() => expect(mockedList).toHaveBeenCalledWith(expect.objectContaining({ page: 1, status: 'pending', contacted: 'false' })))
})

// Tanpa stageFilter di hasFilter, hasil filter kosong akan berbunyi "Belum ada
// tamu" + tombol "Tambah tamu pertama" - seolah databasenya kosong, padahal
// yang kosong cuma hasil penyaringan.
test('filter tahap aktif + hasil kosong -> EmptyState versi "tidak cocok"', async () => {
  mockedList.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Belum ada tamu')).toBeInTheDocument())

  fireEvent.change(screen.getByDisplayValue('Semua status'), { target: { value: 'not_invited' } })

  await waitFor(() => expect(screen.getByText('Tidak ada tamu yang cocok')).toBeInTheDocument())
  expect(screen.queryByText('Belum ada tamu')).not.toBeInTheDocument()
})

// K2: tamu tanpa kontak apa pun (tanpa nomor HP DAN tanpa username Telegram)
// tidak bisa dikirimi lewat modul. Tanpa tombol ini, tamu undangan fisik
// permanen tersangkut di "Belum diundang".
test('tamu tanpa nomor HP & tanpa Telegram & belum ditandai -> tombol tandai manual memanggil setContacted', async () => {
  mockedList.mockResolvedValue({
    data: [{ ...sampleGuest, phone: '', contactedAt: null }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })
  mockedSetContacted.mockResolvedValue(undefined)

  renderPage()
  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Tandai sudah diundang' }))

  await waitFor(() => expect(mockedSetContacted).toHaveBeenCalledWith(1, true))
  // Badge muncul dari respons yang SUKSES, bukan optimistis.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Dihubungi' })).toBeInTheDocument())
})

test('tamu tanpa nomor HP yang sudah ditandai -> tombol tandai manual tidak dirender', async () => {
  mockedList.mockResolvedValue({
    data: [{ ...sampleGuest, phone: '', contactedAt: '2026-01-02T00:00:00Z' }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })

  renderPage()
  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())

  expect(screen.queryByRole('button', { name: 'Tandai sudah diundang' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Dihubungi' })).toBeInTheDocument()
})

// Tamu yang bisa dikirimi lewat salah satu kanal tidak butuh tombol kedua:
// kirim sukses sudah menyalakan contacted_at sendiri.
test('tamu dengan nomor HP -> tombol tandai manual tidak dirender', async () => {
  mockedList.mockResolvedValue({ data: [sampleGuest], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } })

  renderPage()
  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Kirim WA' })).toBeInTheDocument())

  expect(screen.queryByRole('button', { name: 'Tandai sudah diundang' })).not.toBeInTheDocument()
})

test('tamu tanpa nomor HP tapi ber-username Telegram -> tombol tandai manual tidak dirender', async () => {
  mockedList.mockResolvedValue({
    data: [{ ...sampleGuest, phone: '', usernameTelegram: 'budi_santoso' }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  })

  renderPage()
  await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Kirim TG' })).toBeInTheDocument())

  expect(screen.queryByRole('button', { name: 'Tandai sudah diundang' })).not.toBeInTheDocument()
})
