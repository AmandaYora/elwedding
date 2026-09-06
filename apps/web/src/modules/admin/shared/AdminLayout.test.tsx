import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import { useAuthStore } from '@/shared/stores/auth.store'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<div>Ringkasan page</div>} />
          <Route path="sections" element={<div>Section page</div>} />
          <Route path="guests" element={<div>Tamu page</div>} />
          <Route path="scan" element={<div>Scan page</div>} />
          <Route path="arrivals" element={<div>Tamu Masuk page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => useAuthStore.setState({ token: null, role: null, username: null }))

// Regresi T2 (admin-ui-redesign/PLAN.md §2.4): NavLink to="/" tanpa `end`
// aktif di SEMUA rute. Harus tepat 1 item nav aktif per rute.
test('pada rute "/", hanya Ringkasan yang aktif', () => {
  renderAt('/')
  const active = screen.getAllByRole('link').filter((el) => el.getAttribute('aria-current') === 'page')
  expect(active).toHaveLength(1)
  expect(active[0]).toHaveTextContent('Ringkasan')
})

test('pada rute "/sections", hanya Section yang aktif (Ringkasan tidak ikut aktif)', () => {
  renderAt('/sections')
  const active = screen.getAllByRole('link').filter((el) => el.getAttribute('aria-current') === 'page')
  expect(active).toHaveLength(1)
  expect(active[0]).toHaveTextContent('Section')
})

test('pada rute "/guests", hanya Tamu yang aktif', () => {
  renderAt('/guests')
  const active = screen.getAllByRole('link').filter((el) => el.getAttribute('aria-current') === 'page')
  expect(active).toHaveLength(1)
  expect(active[0]).toHaveTextContent('Tamu')
})

// --- penyaringan menu per peran (docs/plan/scan-checkin-gate T19) ---
// KOSMETIK. Penegakan aksesnya ada di authmw.RequireFullAdmin dan diuji
// lewat HTTP di middleware_test.go, bukan di sini.

test('peran scanner -> HANYA menu Scan & Tamu Masuk yang dirender', () => {
  useAuthStore.setState({ token: 'tok', role: 'scanner' })
  renderAt('/scan')

  // Dibatasi ke dalam <nav>: header juga punya tautan "Lihat Undangan"
  // (href="/") yang bukan item menu dan memang tetap ada untuk petugas.
  const navLinks = within(screen.getByRole('navigation')).getAllByRole('link')
  expect(navLinks.map((el) => el.getAttribute('href'))).toEqual(['/scan', '/arrivals'])
  // "Tamu" polos adalah menu admin; "Tamu Masuk" milik petugas - keduanya
  // dibedakan lewat exact match supaya tes ini tidak lolos palsu.
  expect(screen.queryByText('Tamu', { exact: true })).not.toBeInTheDocument()
  expect(screen.queryByText('Pengguna')).not.toBeInTheDocument()
  expect(screen.queryByText('Ringkasan')).not.toBeInTheDocument()
  expect(screen.getByText('Tamu Masuk')).toBeInTheDocument()
})

test('peran admin -> seluruh menu dirender, termasuk Scan', () => {
  useAuthStore.setState({ token: 'tok', role: 'admin' })
  renderAt('/')

  expect(screen.getByText('Scan')).toBeInTheDocument()
  expect(screen.getByText('Tamu Masuk')).toBeInTheDocument()
  expect(screen.getByText('Tamu', { exact: true })).toBeInTheDocument()
  expect(screen.getByText('Pengguna')).toBeInTheDocument()
})

// --- kotak identitas akun di atas tombol Keluar ---
// Sebelumnya kotak ini mencetak "Administrator / admin@wedding.id" hardcode,
// sehingga petugas gate pun melihat dirinya disebut Administrator. Satu-satunya
// tempat yang menyebut siapa yang login menyebut orang yang salah.

test('kotak akun menampilkan username & peran petugas, bukan "Administrator"', () => {
  useAuthStore.setState({ token: 'tok', role: 'scanner', username: 'petugas1' })
  renderAt('/scan')

  expect(screen.getByText('petugas1')).toBeInTheDocument()
  expect(screen.getByText('Petugas gate')).toBeInTheDocument()
  expect(screen.queryByText('Administrator')).not.toBeInTheDocument()
  expect(screen.queryByText('admin@wedding.id')).not.toBeInTheDocument()
})

test('kotak akun menampilkan username & peran admin penuh', () => {
  useAuthStore.setState({ token: 'tok', role: 'admin', username: 'dimas' })
  renderAt('/')

  expect(screen.getByText('dimas')).toBeInTheDocument()
  expect(screen.getByText('Admin penuh')).toBeInTheDocument()
})

// Sesi LAMA yang tersimpan di localStorage sebelum field `username` ada
// ter-rehydrate sebagai null - kotaknya tidak boleh kosong atau menampilkan
// "null".
test('sesi lama tanpa username tetap menampilkan teks cadangan', () => {
  useAuthStore.setState({ token: 'tok', role: 'admin', username: null })
  renderAt('/')

  expect(screen.getByText('Akun admin')).toBeInTheDocument()
  expect(screen.getByText('Admin penuh')).toBeInTheDocument()
})
