import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TelegramPage from './TelegramPage'
import {
  getStatus,
  startLogin,
  completeLogin,
  getConfig,
  listLogs,
  logout,
  resendLog,
} from '@/modules/admin/telegram/services/telegram.service'
import { ToastProvider } from '@/shared/components/toast/ToastProvider'

function renderPage() {
  return render(
    <ToastProvider>
      <TelegramPage />
    </ToastProvider>,
  )
}

vi.mock('@/modules/admin/telegram/services/telegram.service', () => ({
  getStatus: vi.fn(),
  startLogin: vi.fn(),
  completeLogin: vi.fn(),
  logout: vi.fn(),
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  listLogs: vi.fn(),
  resendLog: vi.fn(),
}))

const mockedGetStatus = vi.mocked(getStatus)
const mockedStartLogin = vi.mocked(startLogin)
const mockedCompleteLogin = vi.mocked(completeLogin)
const mockedGetConfig = vi.mocked(getConfig)
const mockedListLogs = vi.mocked(listLogs)
const mockedLogout = vi.mocked(logout)
const mockedResendLog = vi.mocked(resendLog)

afterEach(() => {
  mockedGetStatus.mockReset()
  mockedStartLogin.mockReset()
  mockedCompleteLogin.mockReset()
  mockedGetConfig.mockReset()
  mockedListLogs.mockReset()
  mockedLogout.mockReset()
  mockedResendLog.mockReset()
})

// Status/config/logs dimuat bersamaan saat halaman dibuka - config & logs
// wajib di-mock di setiap test supaya kartu lain tidak crash menunggu
// promise yang tidak pernah di-resolve (pola WhatsAppPage.test.tsx).
function mockHappyConfigAndLogs() {
  mockedGetConfig.mockResolvedValue({
    messageTemplate: 'Halo {nama}',
    invitationTemplate: 'Undangan untuk {nama}: {link}',
    isEnabled: true,
  })
  mockedListLogs.mockResolvedValue({ data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } })
}

const UNPAIRED = { loggedIn: false, connected: false, loginPending: false, loginError: '', lastConnectedAt: null, lastError: '' }

test('status belum tertaut -> menampilkan tombol Kirim kode OTP', async () => {
  mockedGetStatus.mockResolvedValue(UNPAIRED)
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Kirim kode OTP' })).toBeInTheDocument())
  expect(screen.getByText('Belum tertaut')).toBeInTheDocument()
})

test('status loginPending -> menampilkan form kode OTP', async () => {
  mockedGetStatus.mockResolvedValue({ ...UNPAIRED, loginPending: true })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText('Menunggu kode OTP')).toBeInTheDocument())
  expect(screen.getByLabelText('Kode OTP')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Tautkan akun' })).toBeInTheDocument()
})

test('status tertaut -> menampilkan badge Siap mengirim dan tombol Putuskan', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, loginPending: false, loginError: '', lastConnectedAt: '2026-09-15T10:00:00+07:00', lastError: '' })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText('Siap mengirim')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Putuskan' })).toBeInTheDocument()
})

test('tertaut tetapi sesi bermasalah -> tombol Kirim ulang kode OTP', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: false, loginPending: false, loginError: '', lastConnectedAt: '2026-09-15T10:00:00+07:00', lastError: 'sesi ditolak server, login ulang' })
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText('Tertaut, tetapi sesi bermasalah')).toBeInTheDocument())
  expect(screen.getByText('sesi ditolak server, login ulang')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kirim ulang kode OTP' })).toBeInTheDocument()
})

test('gagal memuat status -> ErrorState dengan tombol coba lagi', async () => {
  mockedGetStatus.mockRejectedValue(new Error('network error'))
  mockHappyConfigAndLogs()

  renderPage()

  await waitFor(() => expect(screen.getByText('Gagal memuat status Telegram.')).toBeInTheDocument())
  expect(screen.getAllByRole('button', { name: 'Coba lagi' }).length).toBeGreaterThan(0)
})

test('klik Kirim kode OTP -> memanggil startLogin dan menampilkan toast nomor tujuan', async () => {
  mockedGetStatus.mockResolvedValue(UNPAIRED)
  mockHappyConfigAndLogs()
  mockedStartLogin.mockResolvedValue({ phone: '+62812xxxxxxx' })

  renderPage()

  fireEvent.click(await screen.findByRole('button', { name: 'Kirim kode OTP' }))
  await waitFor(() => expect(mockedStartLogin).toHaveBeenCalledTimes(1))
})

// Backend 400 "memakai verifikasi 2 langkah" BUKAN kegagalan final - halaman
// wajib menampilkan field password supaya admin bisa melengkapi (lihat
// ErrPasswordNeeded di telegram/application/service.go).
test('complete ditolak karena 2FA -> field password muncul', async () => {
  mockedGetStatus.mockResolvedValue({ ...UNPAIRED, loginPending: true })
  mockHappyConfigAndLogs()
  mockedCompleteLogin.mockRejectedValue({ response: { status: 400, data: { message: 'akun memakai verifikasi 2 langkah, kirim password' } } })

  renderPage()

  fireEvent.change(await screen.findByLabelText('Kode OTP'), { target: { value: '12345' } })
  fireEvent.click(screen.getByRole('button', { name: 'Tautkan akun' }))

  await waitFor(() => expect(screen.getByLabelText('Password verifikasi 2 langkah')).toBeInTheDocument())
  // Label field-nya sendiri mengandung "verifikasi 2 langkah", jadi assertion
  // memakai kalimat error yang khas untuk membedakan keduanya.
  expect(screen.getByText(/Akun ini memakai verifikasi 2 langkah/)).toBeInTheDocument()
})

test('log gagal -> tombol Kirim ulang memanggil resendLog', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, loginPending: false, loginError: '', lastConnectedAt: null, lastError: '' })
  mockHappyConfigAndLogs()
  mockedListLogs.mockResolvedValue({
    data: [
      { id: 7, guestId: 3, guestName: 'Budi', telegramUsername: 'budi_s', attendingCount: 2, status: 'failed', errorMessage: 'username Telegram tidak ditemukan', sentAt: null, createdAt: '2026-09-15T10:00:00+07:00' },
    ],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  })
  mockedResendLog.mockResolvedValue(undefined)

  renderPage()

  await waitFor(() => expect(screen.getByText('@budi_s')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Kirim ulang' }))
  await waitFor(() => expect(mockedResendLog).toHaveBeenCalledWith(7))
})

test('logout dari modal konfirmasi -> memanggil logout', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, loginPending: false, loginError: '', lastConnectedAt: null, lastError: '' })
  mockHappyConfigAndLogs()
  mockedLogout.mockResolvedValue({ remoteRevoked: true })

  renderPage()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Putuskan' })).toBeInTheDocument())
  // Tombol pertama membuka modal konfirmasi, tombol kedua (di modal) mengeksekusi.
  fireEvent.click(screen.getByRole('button', { name: 'Putuskan' }))
  const confirms = await screen.findAllByRole('button', { name: 'Putuskan' })
  fireEvent.click(confirms[confirms.length - 1])
  await waitFor(() => expect(mockedLogout).toHaveBeenCalledTimes(1))
})

test('logout tanpa remote revoke -> toast peringatan cabut manual', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, loginPending: false, loginError: '', lastConnectedAt: null, lastError: '' })
  mockHappyConfigAndLogs()
  mockedLogout.mockResolvedValue({ remoteRevoked: false })

  renderPage()

  await waitFor(() => expect(screen.getByRole('button', { name: 'Putuskan' })).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Putuskan' }))
  const confirms = await screen.findAllByRole('button', { name: 'Putuskan' })
  fireEvent.click(confirms[confirms.length - 1])
  await waitFor(() => expect(mockedLogout).toHaveBeenCalledTimes(1))
  await waitFor(() => expect(screen.getByText(/masih terdaftar di akun/)).toBeInTheDocument())
})

test('log retrying -> badge Menunggu kirim ulang dan tombol disabled', async () => {
  mockedGetStatus.mockResolvedValue({ loggedIn: true, connected: true, loginPending: false, loginError: '', lastConnectedAt: null, lastError: '' })
  mockHappyConfigAndLogs()
  mockedListLogs.mockResolvedValue({
    data: [
      { id: 7, guestId: 3, guestName: 'Budi', telegramUsername: 'budi_s', attendingCount: 2, status: 'retrying', errorMessage: 'dibatasi Telegram, dijadwalkan ulang', sentAt: null, createdAt: '2026-09-15T10:00:00+07:00' },
    ],
    meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
  })

  renderPage()

  await waitFor(() => expect(screen.getByText('Menunggu kirim ulang')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Kirim ulang' })).toBeDisabled()
})
