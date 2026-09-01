import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminLayout from './AdminLayout'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<div>Ringkasan page</div>} />
          <Route path="sections" element={<div>Section page</div>} />
          <Route path="guests" element={<div>Tamu page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

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
