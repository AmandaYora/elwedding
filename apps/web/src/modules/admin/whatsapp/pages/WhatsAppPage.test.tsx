import { render, screen, waitFor } from '@testing-library/react'
import WhatsAppPage from './WhatsAppPage'
import { getStatus, getConfig, listLogs } from '@/modules/admin/whatsapp/services/whatsapp.service'
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
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  listLogs: vi.fn(),
  resendLog: vi.fn(),
}))

const mockedGetStatus = vi.mocked(getStatus)
const mockedGetConfig = vi.mocked(getConfig)
const mockedListLogs = vi.mocked(listLogs)

afterEach(() => {
  mockedGetStatus.mockReset()
  mockedGetConfig.mockReset()
  mockedListLogs.mockReset()
})

// Status/config/logs dimuat bersamaan saat halaman dibuka - config & logs
// wajib di-mock di setiap test supaya kartu lain tidak crash menunggu
// promise yang tidak pernah di-resolve.
function mockHappyConfigAndLogs() {
  mockedGetConfig.mockResolvedValue({ messageTemplate: 'Halo {nama}', isEnabled: true })
  mockedListLogs.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } })
}

test('status belum tertaut dengan pairingQR -> menampilkan kartu QR pairing', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: false, pairing: true, pairingQR: '2@abcxyz', pairingError: '' })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText(/pindai kode QR ini/)).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Tautkan akun WhatsApp' })).not.toBeInTheDocument()
})

test('status belum tertaut TANPA pairingQR -> menampilkan tombol tautkan akun', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: false, pairing: false, pairingQR: '', pairingError: '' })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Tautkan akun WhatsApp' })).toBeInTheDocument())
})

test('status tertaut -> menampilkan badge Tertaut dan tombol Putuskan', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, pairing: false, pairingQR: '', pairingError: '' })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText('Tertaut')).toBeInTheDocument())
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
  mockedGetStatus.mockResolvedValue({ loggedIn: true, pairing: false, pairingQR: '', pairingError: '' })
  mockedGetConfig.mockRejectedValueOnce(new Error('network error'))
  mockedListLogs.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } })

  renderPage()

  await waitFor(() => expect(screen.getByText('Gagal memuat template pesan.')).toBeInTheDocument())
})
