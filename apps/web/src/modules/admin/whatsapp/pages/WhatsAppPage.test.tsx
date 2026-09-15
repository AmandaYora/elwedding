import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import WhatsAppPage from './WhatsAppPage'
import {
  getStatus,
  getConfig,
  listLogs,
  logout,
  reconnect,
} from '@/modules/admin/whatsapp/services/whatsapp.service'
import { ToastProvider } from '@/shared/components/toast/ToastProvider'

function renderPage() {
  return render(
    <ToastProvider>
      <WhatsAppPage />
    </ToastProvider>,
  )
}

vi.mock('@/modules/admin/whatsapp/services/whatsapp.service', () => ({
  getStatus: vi.fn(),
  startPairing: vi.fn(),
  logout: vi.fn(),
  reconnect: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  listLogs: vi.fn(),
  resendLog: vi.fn(),
}))

const mockedGetStatus = vi.mocked(getStatus)
const mockedGetConfig = vi.mocked(getConfig)
const mockedListLogs = vi.mocked(listLogs)
const mockedLogout = vi.mocked(logout)
const mockedReconnect = vi.mocked(reconnect)

afterEach(() => {
  mockedGetStatus.mockReset()
  mockedGetConfig.mockReset()
  mockedListLogs.mockReset()
  mockedLogout.mockReset()
  mockedReconnect.mockReset()
})

// Status/config/logs dimuat bersamaan saat halaman dibuka - config & logs
// wajib di-mock di setiap test supaya kartu lain tidak crash menunggu
// promise yang tidak pernah di-resolve.
function mockHappyConfigAndLogs() {
  mockedGetConfig.mockResolvedValue({
    messageTemplate: 'Halo {nama}',
    invitationTemplate: 'Undangan untuk {nama}: {link}',
    isEnabled: true,
  })
  mockedListLogs.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } })
}

test('status belum tertaut dengan pairingQR -> menampilkan kartu QR pairing', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: false, connected: false, pairing: true, pairingQR: '2@abcxyz', pairingError: '', lastConnectedAt: null, lastError: '' })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText(/pindai kode QR ini/)).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Tautkan akun WhatsApp' })).not.toBeInTheDocument()
})

test('status belum tertaut TANPA pairingQR -> menampilkan tombol tautkan akun', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: false, connected: false, pairing: false, pairingQR: '', pairingError: '', lastConnectedAt: null, lastError: '' })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Tautkan akun WhatsApp' })).toBeInTheDocument())
})

test('status tertaut -> menampilkan badge Tertaut dan tombol Putuskan', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, pairing: false, pairingQR: '', pairingError: '', lastConnectedAt: '2026-09-15T10:00:00+07:00', lastError: '' })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText('Siap mengirim')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Putuskan' })).toBeInTheDocument()
})

test('gagal memuat status -> ErrorState dengan tombol coba lagi', async () => {
  mockedGetStatus.mockRejectedValue(new Error('network error'))
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText('Gagal memuat status WhatsApp.')).toBeInTheDocument())
  expect(screen.getAllByRole('button', { name: 'Coba lagi' }).length).toBeGreaterThan(0)
})

test('gagal memuat template pesan -> ErrorState dengan tombol coba lagi', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, pairing: false, pairingQR: '', pairingError: '', lastConnectedAt: null, lastError: '' })
  mockedGetConfig.mockRejectedValueOnce(new Error('network error'))
  mockedListLogs.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } })

  renderPage()

  await waitFor(() => expect(screen.getByText('Gagal memuat template pesan.')).toBeInTheDocument())
})

// F1: tertaut tetapi socket mati -> keadaan terputus + tombol Sambungkan Ulang.
test('loggedIn true connected false -> keadaan terputus dan tombol Sambungkan Ulang', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: false, pairing: false, pairingQR: '', pairingError: '', lastConnectedAt: '2026-09-15T10:00:00+07:00', lastError: 'koneksi WhatsApp terputus' })
  mockHappyConfigAndLogs()
  mockedReconnect.mockResolvedValue(undefined)

  renderPage()

  await waitFor(() => expect(screen.getByText('Tertaut, koneksi terputus')).toBeInTheDocument())
  expect(screen.getByText('koneksi WhatsApp terputus')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sambungkan Ulang' }))
  await waitFor(() => expect(mockedReconnect).toHaveBeenCalledTimes(1))
})

// F2: tertaut dan socket hidup -> keadaan siap, tanpa tombol Sambungkan Ulang.
test('loggedIn true connected true -> keadaan siap tanpa tombol Sambungkan Ulang', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, pairing: false, pairingQR: '', pairingError: '', lastConnectedAt: '2026-09-15T10:00:00+07:00', lastError: '' })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText('Siap mengirim')).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Sambungkan Ulang' })).not.toBeInTheDocument()
})

// F3: remoteRevoked false -> toast peringatan hapus manual, bukan sukses polos.
test('logout tanpa remote revoke -> toast peringatan hapus manual di HP', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: false, pairing: false, pairingQR: '', pairingError: '', lastConnectedAt: null, lastError: '' })
  mockHappyConfigAndLogs()
  mockedLogout.mockResolvedValue({ remoteRevoked: false })

  renderPage()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Putuskan' })).toBeInTheDocument())
  // Tombol pertama membuka modal konfirmasi, tombol kedua (di modal) mengeksekusi.
  fireEvent.click(screen.getByRole('button', { name: 'Putuskan' }))
  const confirms = await screen.findAllByRole('button', { name: 'Putuskan' })
  fireEvent.click(confirms[confirms.length - 1])
  await waitFor(() => expect(mockedLogout).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.getByText(/masih terdaftar di HP/)).toBeInTheDocument())
})

// F4: log retrying -> badge tunggu + tombol Kirim Ulang disabled.
test('log retrying -> badge Menunggu kirim ulang dan tombol disabled', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, pairing: false, pairingQR: '', pairingError: '', lastConnectedAt: null, lastError: '' })
  mockedGetConfig.mockResolvedValue({
    messageTemplate: 'Halo {nama}',
    invitationTemplate: 'Undangan untuk {nama}: {link}',
    isEnabled: true,
  })
  mockedListLogs.mockResolvedValue({
    data: [
      {
        id: 7,
        guestId: 3,
        guestName: 'Budi',
        phone: '08123456789',
        attendingCount: 2,
        status: 'retrying',
        errorMessage: 'koneksi WhatsApp belum siap, dijadwalkan ulang',
        sentAt: null,
        createdAt: '2026-09-15T10:00:00+07:00',
      },
    ],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  })

  renderPage()

  await waitFor(() => expect(screen.getByText('Menunggu kirim ulang')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Kirim ulang' })).toBeDisabled()
})

// F5: polling tetap berjalan sesudah loggedIn true (perbaikan G5).
test('polling tetap berjalan sesudah loggedIn true', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, pairing: false, pairingQR: '', pairingError: '', lastConnectedAt: null, lastError: '' })
  mockHappyConfigAndLogs()
  vi.useFakeTimers({ shouldAdvanceTime: true })

  try {
    renderPage()

    await waitFor(() => expect(screen.getByText('Siap mengirim')).toBeInTheDocument())
    const callsAfterFirst = mockedGetStatus.mock.calls.length
    // Maju melewati interval siap (15 detik): polling kedua WAJIB terjadi.
    await vi.advanceTimersByTimeAsync(16000)
    await waitFor(() => expect(mockedGetStatus.mock.calls.length).toBeGreaterThan(callsAfterFirst))
  } finally {
    vi.useRealTimers()
  }
})
