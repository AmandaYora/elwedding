import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import ScanPage from './ScanPage'
import { checkinById, scanCode, searchGuests } from '@/modules/admin/scan/services/checkin.service'

/** Bentuk callback dekode kontinu @zxing/browser - diketik ulang di sini
 * karena `DecodeContinuouslyCallback` tidak ikut diekspor dari entry paket. */
type ScanCallback = (
  result: { getText: () => string } | undefined,
  err: unknown,
  controls: { stop: () => void },
) => void

/**
 * docs/plan/scan-checkin-gate/PLAN.md T19.
 *
 * @zxing/browser di-mock: jsdom tidak punya kamera, dan mock ini sekaligus
 * memberi kita pemicu pindaian buatan (emitScan) untuk menguji keempat
 * keadaan layar.
 */
let emitScan: ((text: string) => void) | null = null
const stopSpy = vi.fn()
const decodeSpy = vi.fn()
let decodeShouldFail = false

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class {
    decodeFromConstraints(
      _constraints: MediaStreamConstraints,
      _el: HTMLVideoElement | undefined,
      cb: ScanCallback,
    ) {
      decodeSpy()
      if (decodeShouldFail) return Promise.reject(new Error('NotAllowedError'))
      const controls = { stop: stopSpy }
      emitScan = (text: string) => cb({ getText: () => text }, undefined, controls)
      return Promise.resolve(controls)
    }
  },
}))

vi.mock('@/modules/admin/scan/services/checkin.service', () => ({
  scanCode: vi.fn(),
  checkinById: vi.fn(),
  searchGuests: vi.fn(),
}))

const mockedScan = vi.mocked(scanCode)
const mockedCheckinById = vi.mocked(checkinById)
const mockedSearch = vi.mocked(searchGuests)

function guest(overrides: Partial<Awaited<ReturnType<typeof scanCode>>> = {}) {
  return {
    id: 7,
    name: 'Budi Santoso',
    side: 'groom',
    invitationType: 'physical',
    souvenirType: 'vip',
    rsvpStatus: 'attending',
    attendingCount: 2,
    checkedInAt: '2026-05-16T19:30:00+07:00',
    alreadyCheckedIn: false,
    // Nama group di-resolve server (guest-groups D8) - petugas gate tidak
    // bisa memetakannya sendiri.
    groupName: 'Teman Kantor',
    ...overrides,
  }
}

/** Meniru error Axios: `response` ADA = server menjawab (penolakan).
 * Tanpa `response` = permintaan tidak terkirim. */
function axiosError(status: number, message: string) {
  return { response: { status, data: { message } } }
}

beforeEach(() => {
  emitScan = null
  decodeShouldFail = false
  stopSpy.mockReset()
  decodeSpy.mockReset()
  mockedScan.mockReset()
  mockedCheckinById.mockReset()
  mockedSearch.mockReset()
  mockedSearch.mockResolvedValue([])
})

// Default halaman kini mode Scanner (docs/plan/scan-mode-scanner/PLAN.md
// K2): helper ini menekan toggle "Kamera" dulu sebelum menunggu decoder.
async function renderAndWaitForScanner() {
  render(<ScanPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Kamera' }))
  await waitFor(() => expect(emitScan).not.toBeNull())
}

test('pindai QR sah -> tamu ditampilkan dengan putusan Silakan masuk', async () => {
  mockedScan.mockResolvedValueOnce(guest())
  await renderAndWaitForScanner()

  emitScan!('ELW1:tok-abc')

  await waitFor(() => expect(mockedScan).toHaveBeenCalledWith('ELW1:tok-abc'))
  expect(await screen.findByText('Silakan masuk')).toBeInTheDocument()
  expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
  // Souvenir & jumlah orang - dua data yang mengubah tindakan petugas.
  expect(screen.getByText('Souvenir VIP')).toBeInTheDocument()
  expect(screen.getByText('2')).toBeInTheDocument()
})

test('pindai tamu yang sudah check-in -> peringatan beserta jamnya', async () => {
  mockedScan.mockResolvedValueOnce(guest({ alreadyCheckedIn: true }))
  await renderAndWaitForScanner()

  emitScan!('ELW1:tok-abc')

  // 19:30 di zona +07:00 - dipastikan jamnya benar-benar tampil, karena
  // itulah informasi yang diminta K3.
  expect(await screen.findByText(/Sudah check-in pukul/)).toBeInTheDocument()
  expect(screen.getByText(/tidak dihitung dua kali/)).toBeInTheDocument()
  expect(screen.queryByText('Silakan masuk')).not.toBeInTheDocument()
})

test('QR tidak dikenali -> ditolak dengan pesan dari backend', async () => {
  mockedScan.mockRejectedValueOnce(axiosError(400, 'QR tidak dikenali'))
  await renderAndWaitForScanner()

  emitScan!('QR-PROMO-APA-PUN')

  expect(await screen.findByText('Jangan dicatat')).toBeInTheDocument()
  expect(screen.getByText('QR tidak dikenali')).toBeInTheDocument()
})

// Keadaan KEEMPAT, dan yang paling mudah tertukar: permintaan tidak terkirim
// harus menyatakan tamunya BELUM tercatat, bukan menuduh QR-nya tidak sah.
test('permintaan tidak terkirim -> dibedakan dari penolakan', async () => {
  mockedScan.mockRejectedValueOnce(new Error('Network Error'))
  await renderAndWaitForScanner()

  emitScan!('ELW1:tok-abc')

  expect(await screen.findByText('Tamu belum tercatat')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument()
  expect(screen.queryByText('Jangan dicatat')).not.toBeInTheDocument()
})

test('kode yang sama dipindai berturut-turut -> hanya satu permintaan', async () => {
  mockedScan.mockResolvedValue(guest())
  await renderAndWaitForScanner()

  emitScan!('ELW1:tok-abc')
  await waitFor(() => expect(mockedScan).toHaveBeenCalledTimes(1))
  emitScan!('ELW1:tok-abc')
  emitScan!('ELW1:tok-abc')

  expect(mockedScan).toHaveBeenCalledTimes(1)
})

test('check-in lewat pencarian nama -> checkinById terpanggil dengan id yang benar', async () => {
  mockedSearch.mockResolvedValue([
    { id: 7, name: 'Budi Santoso', side: 'groom', rsvpStatus: 'attending', attendingCount: 2, checkedIn: false },
  ])
  mockedCheckinById.mockResolvedValueOnce(guest())
  await renderAndWaitForScanner()

  fireEvent.change(screen.getByPlaceholderText('Ketik nama tamu'), { target: { value: 'budi' } })

  await waitFor(() => expect(mockedSearch).toHaveBeenCalledWith('budi'), { timeout: 2000 })
  fireEvent.click(await screen.findByRole('button', { name: 'Catat hadir' }))

  await waitFor(() => expect(mockedCheckinById).toHaveBeenCalledWith(7))
  expect(await screen.findByText('Silakan masuk')).toBeInTheDocument()
})

test('baris yang sudah check-in tidak punya tombol catat hadir', async () => {
  mockedSearch.mockResolvedValue([
    { id: 8, name: 'Siti Aminah', side: 'bride', rsvpStatus: 'attending', attendingCount: 1, checkedIn: true },
  ])
  await renderAndWaitForScanner()

  fireEvent.change(screen.getByPlaceholderText('Ketik nama tamu'), { target: { value: 'siti' } })

  expect(await screen.findByText('Sudah check-in')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Catat hadir' })).not.toBeInTheDocument()
})

// Izin kamera ditolak tidak boleh membuat halaman ini buntu - pencarian nama
// adalah jalur cadangan petugas.
test('kamera gagal dibuka -> pesan jelas, pencarian nama tetap jalan', async () => {
  decodeShouldFail = true
  mockedSearch.mockResolvedValue([
    { id: 9, name: 'Rina', side: 'bride', rsvpStatus: 'pending', attendingCount: 1, checkedIn: false },
  ])

  render(<ScanPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Kamera' }))

  expect(await screen.findByText('Kamera tidak aktif')).toBeInTheDocument()
  fireEvent.change(screen.getByPlaceholderText('Ketik nama tamu'), { target: { value: 'rina' } })
  expect(await screen.findByText('Rina')).toBeInTheDocument()
})

// Kamera yang menyala terus akan menguras baterai perangkat gate sepanjang
// acara (T16).
test('unmount menghentikan stream kamera', async () => {
  const { unmount } = render(<ScanPage />)
  fireEvent.click(screen.getByRole('button', { name: 'Kamera' }))
  await waitFor(() => expect(emitScan).not.toBeNull())

  unmount()

  expect(stopSpy).toHaveBeenCalled()
})

// --- group di kartu hasil (docs/plan/guest-groups/PLAN.md T17/T18) ---

test('hasil scan menampilkan nama group tamu', async () => {
  mockedScan.mockResolvedValueOnce(guest())
  await renderAndWaitForScanner()

  emitScan!('ELW1:tok-abc')

  expect(await screen.findByText('Silakan masuk')).toBeInTheDocument()
  // Group berdampingan dengan pihak & status RSVP di satu baris teks (T17),
  // bukan kartu besar - jadi dicari lewat pola, bukan teks persis.
  expect(screen.getByText(/Group Teman Kantor/)).toBeInTheDocument()
})

// D9/2.6: groupName kosong (tamu lama, ATAU pembacaan group gagal di server)
// TIDAK BOLEH merusak kartu - check-in tetap berhasil dan nama tamu tetap ada.
test('groupName kosong -> kartu tetap utuh, group tampil sebagai strip', async () => {
  mockedScan.mockResolvedValueOnce(guest({ groupName: '' }))
  await renderAndWaitForScanner()

  emitScan!('ELW1:tok-abc')

  expect(await screen.findByText('Silakan masuk')).toBeInTheDocument()
  expect(screen.getByText('Budi Santoso')).toBeInTheDocument()
  expect(screen.getByText(/Group —/)).toBeInTheDocument()
})

// --- mode Scanner device (docs/plan/scan-mode-scanner/PLAN.md §8) ---

function submitViaScanner(code: string) {
  const input = screen.getByLabelText('Kode QR')
  fireEvent.change(input, { target: { value: code } })
  fireEvent.keyDown(input, { key: 'Enter' })
  return input as HTMLInputElement
}

test('default = mode Scanner, kamera tidak dimuat', async () => {
  render(<ScanPage />)

  // Toggle dalam keadaan default: Scanner aktif, Kamera tidak.
  expect(screen.getByRole('button', { name: 'Scanner' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Kamera' })).toHaveAttribute('aria-pressed', 'false')
  // Kolom tangkap scanner ada dan langsung fokus; decoder kamera tidak jalan.
  const input = screen.getByLabelText('Kode QR')
  expect(document.activeElement).toBe(input)
  expect(screen.queryByLabelText('Pratinjau kamera pemindai')).not.toBeInTheDocument()
  expect(decodeSpy).not.toHaveBeenCalled()
  expect(await screen.findByText('Tembak QR tamu dengan scanner')).toBeInTheDocument()
})

test('Enter valid di mode scanner -> scanCode + kartu + kolom dikosongkan', async () => {
  mockedScan.mockResolvedValueOnce(guest())
  render(<ScanPage />)

  const input = submitViaScanner('ELW1:tok-abc')

  await waitFor(() => expect(mockedScan).toHaveBeenCalledWith('ELW1:tok-abc'))
  expect(await screen.findByText('Silakan masuk')).toBeInTheDocument()
  expect(input.value).toBe('')
  expect(document.activeElement).toBe(input)
})

test('tombol Catat mengirim nilai kolom seperti Enter', async () => {
  mockedScan.mockResolvedValueOnce(guest())
  render(<ScanPage />)

  fireEvent.change(screen.getByLabelText('Kode QR'), { target: { value: 'ELW1:tok-abc' } })
  fireEvent.click(screen.getByRole('button', { name: 'Catat' }))

  await waitFor(() => expect(mockedScan).toHaveBeenCalledWith('ELW1:tok-abc'))
  expect(await screen.findByText('Silakan masuk')).toBeInTheDocument()
})

test('Enter kosong/spasi di mode scanner -> diabaikan tanpa API call', async () => {
  render(<ScanPage />)

  submitViaScanner('   ')

  // Tidak ada panggilan API dan outcome tetap idle (teks idle mode scanner).
  expect(mockedScan).not.toHaveBeenCalled()
  expect(await screen.findByText('Tembak QR tamu dengan scanner')).toBeInTheDocument()
})

test('toggle ke Kamera me-mount kamera; toggle balik mematikan stream', async () => {
  mockedScan.mockResolvedValueOnce(guest())
  render(<ScanPage />)

  fireEvent.click(screen.getByRole('button', { name: 'Kamera' }))
  await waitFor(() => expect(emitScan).not.toBeNull())
  expect(screen.getByLabelText('Pratinjau kamera pemindai')).toBeInTheDocument()
  expect(await screen.findByText('Arahkan kamera ke QR tamu')).toBeInTheDocument()

  emitScan!('ELW1:tok-abc')
  expect(await screen.findByText('Silakan masuk')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Scanner' }))
  expect(stopSpy).toHaveBeenCalled()
  expect(screen.queryByLabelText('Pratinjau kamera pemindai')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Kode QR')).toBeInTheDocument()
})

test('pencarian nama jalan di kedua mode', async () => {
  mockedSearch.mockImplementation((q: string) =>
    Promise.resolve(
      q === 'siti'
        ? [
            {
              id: 8,
              name: 'Siti Aminah',
              side: 'bride',
              rsvpStatus: 'attending',
              attendingCount: 1,
              checkedIn: false,
            },
          ]
        : [
            {
              id: 7,
              name: 'Budi Santoso',
              side: 'groom',
              rsvpStatus: 'attending',
              attendingCount: 2,
              checkedIn: false,
            },
          ],
    ),
  )
  mockedCheckinById.mockResolvedValue(guest())
  render(<ScanPage />)

  // Mode Scanner (default).
  fireEvent.change(screen.getByPlaceholderText('Ketik nama tamu'), { target: { value: 'budi' } })
  await waitFor(() => expect(mockedSearch).toHaveBeenCalledWith('budi'), { timeout: 2000 })
  fireEvent.click(await screen.findByRole('button', { name: 'Catat hadir' }))
  await waitFor(() => expect(mockedCheckinById).toHaveBeenCalledWith(7))

  // Mode Kamera: panel yang sama tetap berfungsi (kata kunci beda, karena
  // kata kunci identik memang tidak memicu pencarian ulang).
  fireEvent.click(screen.getByRole('button', { name: 'Kamera' }))
  await waitFor(() => expect(emitScan).not.toBeNull())
  fireEvent.change(screen.getByPlaceholderText('Ketik nama tamu'), { target: { value: 'siti' } })
  await waitFor(() => expect(mockedSearch).toHaveBeenCalledWith('siti'), { timeout: 2000 })
  expect(await screen.findByText('Siti Aminah')).toBeInTheDocument()
})

test('pindaian scanner ganda cepat -> hanya satu permintaan (peredam dipakai ulang)', async () => {
  mockedScan.mockResolvedValue(guest())
  render(<ScanPage />)

  submitViaScanner('ELW1:tok-abc')
  await waitFor(() => expect(mockedScan).toHaveBeenCalledTimes(1))
  submitViaScanner('ELW1:tok-abc')

  expect(mockedScan).toHaveBeenCalledTimes(1)
})

test('gagal terkirim dari mode scanner -> retry Coba lagi berfungsi', async () => {
  mockedScan.mockRejectedValueOnce(new Error('Network Error'))
  mockedScan.mockResolvedValue(guest())
  render(<ScanPage />)

  submitViaScanner('ELW1:tok-abc')

  expect(await screen.findByText('Tamu belum tercatat')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))

  expect(await screen.findByText('Silakan masuk')).toBeInTheDocument()
  expect(mockedScan).toHaveBeenCalledTimes(2)
})
