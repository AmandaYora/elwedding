import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import { useAuthStore } from '@/shared/stores/auth.store'
import type { AdminRole } from '@/modules/admin/auth/services/auth.service'

/**
 * docs/plan/scan-checkin-gate/PLAN.md T19.
 *
 * PENTING: pengalihan ini KOSMETIK. Penegakan sebenarnya ada di
 * authmw.RequireFullAdmin dan diuji langsung lewat HTTP di
 * shared/authmw/middleware_test.go - jangan pernah memperlakukan test ini
 * sebagai bukti pembatasan akses.
 */
function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Halaman login</div>} />
        <Route element={<ProtectedRoute />}>
          <Route index element={<div>Ringkasan page</div>} />
          <Route path="guests" element={<div>Tamu page</div>} />
          <Route path="scan" element={<div>Scan page</div>} />
          <Route path="arrivals" element={<div>Tamu Masuk page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function setSession(token: string | null, role: AdminRole | null) {
  useAuthStore.setState({ token, role })
}

afterEach(() => setSession(null, null))

test('tanpa token -> dialihkan ke login', () => {
  setSession(null, null)
  renderAt('/guests')
  expect(screen.getByText('Halaman login')).toBeInTheDocument()
})

test('petugas membuka rute selain /scan -> dialihkan ke /scan', () => {
  setSession('tok', 'scanner')
  renderAt('/guests')
  expect(screen.getByText('Scan page')).toBeInTheDocument()
})

test('petugas membuka /scan -> diizinkan', () => {
  setSession('tok', 'scanner')
  renderAt('/scan')
  expect(screen.getByText('Scan page')).toBeInTheDocument()
})

test('petugas membuka /arrivals -> diizinkan (menu kedua miliknya)', () => {
  setSession('tok', 'scanner')
  renderAt('/arrivals')
  expect(screen.getByText('Tamu Masuk page')).toBeInTheDocument()
})

test('admin penuh membuka rute mana pun -> diizinkan', () => {
  setSession('tok', 'admin')
  renderAt('/guests')
  expect(screen.getByText('Tamu page')).toBeInTheDocument()
})

// Mengunci D8 di sisi klien: sesi LAMA yang tersimpan di localStorage tidak
// punya field `role` dan ter-rehydrate sebagai null. Kalau null dianggap
// petugas, admin yang sedang login langsung terkunci ke satu menu.
test('peran null (sesi lama) -> diperlakukan admin penuh', () => {
  setSession('tok', null)
  renderAt('/guests')
  expect(screen.getByText('Tamu page')).toBeInTheDocument()
})
