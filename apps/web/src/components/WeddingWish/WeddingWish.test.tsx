import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { httpClient } from '@/shared/services/http-client'
import WeddingWish from './WeddingWish'
import { resetGuestSessionCache } from '@/hooks/useGuestSession'

vi.mock('@/shared/services/http-client', () => ({
  httpClient: { get: vi.fn(), post: vi.fn() },
}))

const mockedGet = vi.mocked(httpClient.get)
const mockedPost = vi.mocked(httpClient.post)

function setSearch(search: string) {
  window.history.pushState({}, '', `/${search}`)
}

function sessionResponse(session: Record<string, unknown>) {
  return { data: { success: true, data: session } }
}

const baseSession = {
  name: 'Budi Santoso', side: 'groom', rsvpStatus: 'attending',
  attendingCount: 2, paxQuota: 2, hasWish: false, wishMessage: '',
}

/** GET by-token dipakai DUA jalur: sesi tamu dan daftar ucapan. Mock
 * membedakan keduanya lewat akhiran URL - persis pemisahan route di backend
 * (by-token/{token} vs by-token/{token}/wishes). */
function mockSessionAndWishes(session: Record<string, unknown>, wishes: unknown[]) {
  mockedGet.mockImplementation((url: unknown) => {
    if (typeof url === 'string' && url.endsWith('/wishes')) {
      return Promise.resolve({ data: { success: true, data: wishes } })
    }
    return Promise.resolve(sessionResponse(session))
  })
}

/** Dua ucapan siap pakai - dipakai beberapa test slider. */
const twoWishes = [
  { id: 1, guestName: 'Siti', guestSide: 'bride', message: 'Bahagia selalu!', createdAt: '2026-09-15T10:00:00+07:00' },
  { id: 2, guestName: 'Andi', guestSide: 'groom', message: 'Selamat menempuh hidup baru', createdAt: '2026-09-15T09:00:00+07:00' },
]

afterEach(() => {
  mockedGet.mockReset()
  mockedPost.mockReset()
  setSearch('')
  resetGuestSessionCache()
})

// F1: belum mengisi -> form tampil TANPA field Nama (D3: nama dari baris tamu).
test('hasWish false -> form tampil tanpa field Nama', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [])

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByPlaceholderText('Give your wish')).toBeInTheDocument())
  expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument()
})

// F2: sudah mengisi -> form tidak dirender, kartu "Ucapan Anda" berisi pesannya.
test('hasWish true -> kartu Ucapan Anda, form tidak dirender', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes({ ...baseSession, hasWish: true, wishMessage: 'Selamat ya!' }, [])

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Ucapan Anda')).toBeInTheDocument())
  expect(screen.getByText('Selamat ya!')).toBeInTheDocument()
  expect(screen.queryByPlaceholderText('Give your wish')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument()
})

// F3: daftar kosong -> slider tidak dirender, hanya form.
test('daftar kosong -> tidak ada slider', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [])

  const { container } = render(<WeddingWish />)

  await waitFor(() => expect(screen.getByPlaceholderText('Give your wish')).toBeInTheDocument())
  expect(container.querySelector('.ww-scroller')).toBeNull()
})

// Slider tampil saat ada ucapan (prasyarat F3 dibalik + D7).
test('daftar berisi -> slider menampilkan ucapan', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, twoWishes)

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())
  expect(screen.getByText('Siti')).toBeInTheDocument()
  expect(screen.getByText('Selamat menempuh hidup baru')).toBeInTheDocument()
})

// Regresi nyata di produksi: stylesheet template menyetel
// `.comment-wrap{display:none}` dan hanya menampilkannya lewat
// `.comment-wrap.show` - tanpa kelas itu slider tak terlihat walau datanya
// ada (disangka "tertutup aset desain").
test('slider dirender di dalam .comment-wrap.show agar tidak display:none', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [twoWishes[0]])

  const { container } = render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())
  const wrap = container.querySelector('.comment-wrap')
  expect(wrap).not.toBeNull()
  expect(wrap?.classList.contains('show')).toBe(true)
})

// Perbaikan defect utama: kartu dulu tertimpa ornamen taman karena
// `.ornaments-wrapper` position:absolute TANPA z-index dan dirender sesudah
// blok konten. `.ww-layer` yang mengangkat form DAN slider di atasnya.
test('form dan slider dibungkus .ww-layer agar tidak tertimpa ornamen', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, twoWishes)

  const { container } = render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())
  const layer = container.querySelector('.ww-layer')
  expect(layer).not.toBeNull()
  expect(layer?.querySelector('.wedding-wish-form')).not.toBeNull()
  expect(layer?.querySelector('.comment-wrap.show')).not.toBeNull()
})

// U1 - pengganti test usapan lama (yang meng-assert transform .ww-track).
// Geseran kini ditangani browser lewat scroll native + scroll-snap, jadi yang
// diuji adalah STRUKTUR yang memungkinkannya. scrollLeft/transform SENGAJA
// tidak di-assert: jsdom tidak melayout, clientWidth & scrollWidth selalu 0.
test('slider memakai wadah scroll native yang bisa difokus keyboard', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, twoWishes)

  const { container } = render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())
  const scroller = container.querySelector('.ww-scroller') as HTMLElement
  expect(scroller).not.toBeNull()
  expect(scroller.tabIndex).toBe(0)
  expect(scroller.getAttribute('role')).toBe('region')
  expect(scroller.getAttribute('aria-label')).toBe('Ucapan dari para tamu')
  expect(container.querySelectorAll('.ww-card')).toHaveLength(2)
})

// U2 - ucapan panjang dipotong dan bisa dibuka (R4).
test('ucapan panjang -> tombol Selengkapnya membuka teks penuh', async () => {
  setSearch('?guest=tok123')
  const panjang = 'Selamat menempuh hidup baru, semoga menjadi keluarga yang sakinah mawaddah warahmah. '.repeat(3)
  expect(panjang.length).toBeGreaterThan(160)
  mockSessionAndWishes(baseSession, [
    { id: 9, guestName: 'Rina', guestSide: 'bride', message: panjang, createdAt: '2026-09-15T10:00:00+07:00' },
  ])

  const { container } = render(<WeddingWish />)

  const kartu = () => container.querySelector('.ww-card')
  const tombol = await screen.findByRole('button', { name: 'Selengkapnya' })
  expect(kartu()?.getAttribute('data-expanded')).toBe('false')

  fireEvent.click(tombol)
  expect(kartu()?.getAttribute('data-expanded')).toBe('true')

  // Tombolnya WAJIB tetap ada, hanya bertukar label. Kartu meregang seragam,
  // jadi membuka satu kartu menaikkan tinggi semua kartu; tanpa jalan kembali
  // section ini menggelembung permanen hanya karena satu ketukan. Tombol yang
  // menghilang saat diklik juga membuang fokus keyboard ke body.
  const ringkas = screen.getByRole('button', { name: 'Ringkas' })
  expect(ringkas).toBe(tombol)

  fireEvent.click(ringkas)
  expect(kartu()?.getAttribute('data-expanded')).toBe('false')
  expect(screen.getByRole('button', { name: 'Selengkapnya' })).toBeInTheDocument()
})

// Nama tamu diketik bebas oleh admin. Inisial harus utuh walau diawali aksara
// di luar BMP - charAt(0) akan memotongnya jadi separuh surrogate.
test('inisial cakram tidak pecah pada nama beremoji atau berspasi', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [
    { id: 11, guestName: '\u{1F600}Budi', guestSide: 'groom', message: 'Halo!', createdAt: '2026-09-15T10:00:00+07:00' },
    { id: 12, guestName: '   ', guestSide: 'bride', message: 'Hai!', createdAt: '2026-09-15T09:00:00+07:00' },
  ])

  const { container } = render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Halo!')).toBeInTheDocument())
  const seals = container.querySelectorAll('.ww-card-seal')
  expect(seals[0].textContent).toBe('\u{1F600}')
  expect(seals[1].textContent).toBe('?')
})

// U3 - ucapan pendek tidak boleh memunculkan tombolnya.
test('ucapan pendek -> tidak ada tombol Selengkapnya', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [twoWishes[0]])

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())
  expect(screen.queryByRole('button', { name: 'Selengkapnya' })).not.toBeInTheDocument()
})

// U4 - cakram inisial mengikuti guestSide (D11). Datanya sudah lama dikirim
// API tapi sebelum ini tidak pernah ditampilkan.
test('cakram inisial memakai huruf awal nama dan menandai sisi tamu', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, twoWishes)

  const { container } = render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())

  const bride = container.querySelector('.ww-card[data-side="bride"]')
  const groom = container.querySelector('.ww-card[data-side="groom"]')
  expect(bride).not.toBeNull()
  expect(groom).not.toBeNull()
  expect(bride?.querySelector('.ww-card-seal')?.textContent).toBe('S')
  expect(groom?.querySelector('.ww-card-seal')?.textContent).toBe('A')
})

// U5 - rel progres hanya bermakna kalau ada yang bisa digeser.
test('rel progres hanya muncul saat ucapan lebih dari satu', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [twoWishes[0]])

  const { container, unmount } = render(<WeddingWish />)
  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())
  expect(container.querySelector('.ww-rail')).toBeNull()

  unmount()
  resetGuestSessionCache()
  mockSessionAndWishes(baseSession, twoWishes)

  const dua = render(<WeddingWish />)
  await waitFor(() => expect(screen.getByText('Selamat menempuh hidup baru')).toBeInTheDocument())
  expect(dua.container.querySelector('.ww-rail')).not.toBeNull()
})

// U6 - perhitungan rel progres, berikut penjaga pembagian-nolnya.
//
// jsdom tidak pernah melayout: scrollWidth & clientWidth selalu 0. Supaya
// perhitungannya benar-benar teruji (bukan sekadar "tidak melempar"),
// metriknya dipasang manual di elemen.
function stubMetrics(
  el: HTMLElement,
  m: { scrollWidth: number; clientWidth: number; scrollLeft: number },
) {
  Object.defineProperty(el, 'scrollWidth', { value: m.scrollWidth, configurable: true })
  Object.defineProperty(el, 'clientWidth', { value: m.clientWidth, configurable: true })
  el.scrollLeft = m.scrollLeft
}

test('rel progres mengikuti posisi scroll, dan kembali nol saat belum dilayout', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, twoWishes)

  const { container } = render(<WeddingWish />)

  await waitFor(() => expect(screen.getByText('Bahagia selalu!')).toBeInTheDocument())
  const scroller = container.querySelector('.ww-scroller') as HTMLElement
  const thumb = container.querySelector('.ww-rail-thumb') as HTMLElement
  expect(thumb).not.toBeNull()

  // Dua ucapan -> lebar penanda = max(100/2, 12) = 50%.
  expect(thumb.style.width).toBe('50%')

  // Digeser setengah jalan: max = 1000 - 400 = 600, progress = 300/600 = 0.5,
  // sehingga left = 0.5 * (100 - 50) = 25%.
  stubMetrics(scroller, { scrollWidth: 1000, clientWidth: 400, scrollLeft: 300 })
  fireEvent.scroll(scroller)
  expect(thumb.style.left).toBe('25%')

  // Penjaga pembagian-nol: saat tidak ada ruang untuk digulung (max = 0),
  // progress WAJIB jatuh ke 0. Tanpa penjaga `max > 0`, hasilnya 0/0 = NaN;
  // React menolak "NaN%" sehingga `left` diam di 25% dan penanda tersangkut -
  // itulah yang ditangkap assertion ini.
  stubMetrics(scroller, { scrollWidth: 400, clientWidth: 400, scrollLeft: 0 })
  fireEvent.scroll(scroller)
  expect(thumb.style.left).toBe('0%')
})

// Kirim sukses -> kartu Ucapan Anda + daftar dimuat ulang.
test('kirim sukses -> form berganti kartu dan daftar dimuat ulang', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [])
  mockedPost.mockResolvedValue({ data: { success: true, data: null } })

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByPlaceholderText('Give your wish')).toBeInTheDocument())
  fireEvent.change(screen.getByPlaceholderText('Give your wish'), { target: { value: 'Turut berbahagia!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => expect(mockedPost).toHaveBeenCalledWith(
    '/api/v1/public/guests/by-token/tok123/wish',
    { message: 'Turut berbahagia!' },
  ))
  await waitFor(() => expect(screen.getByText('Ucapan Anda')).toBeInTheDocument())
  expect(screen.getByText('Turut berbahagia!')).toBeInTheDocument()
})

// F4: kirim gagal 400 "sudah pernah" -> pesan tampil dan form terkunci.
test('kirim ditolak sudah-pernah -> pesan tampil dan form terkunci', async () => {
  setSearch('?guest=tok123')
  mockSessionAndWishes(baseSession, [])
  mockedPost.mockRejectedValue({
    response: { status: 400, data: { success: false, message: 'Anda sudah pernah mengirim ucapan' } },
  })

  render(<WeddingWish />)

  await waitFor(() => expect(screen.getByPlaceholderText('Give your wish')).toBeInTheDocument())
  fireEvent.change(screen.getByPlaceholderText('Give your wish'), { target: { value: 'Halo!' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))

  await waitFor(() => expect(screen.getByText('Anda sudah pernah mengirim ucapan')).toBeInTheDocument())
  expect(screen.queryByPlaceholderText('Give your wish')).not.toBeInTheDocument()
  expect(screen.getByText('Ucapan Anda')).toBeInTheDocument()
})
