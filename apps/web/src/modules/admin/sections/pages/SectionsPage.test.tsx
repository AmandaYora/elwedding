import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SectionsPage from './SectionsPage'
import { listSections, updateSections } from '@/modules/admin/sections/services/sections.service'
import { ToastProvider } from '@/shared/components/toast/ToastProvider'

vi.mock('@/modules/admin/sections/services/sections.service', () => ({
  listSections: vi.fn(),
  updateSections: vi.fn(),
}))

const mockedList = vi.mocked(listSections)
const mockedUpdate = vi.mocked(updateSections)

const sampleSections = [
  { key: 'opening_cover', label: 'Opening Cover', isEnabled: true, sortOrder: 1 },
  { key: 'cover', label: 'Cover', isEnabled: true, sortOrder: 2 },
]

afterEach(() => {
  mockedList.mockReset()
  mockedUpdate.mockReset()
})

function renderPage() {
  return render(
    <ToastProvider>
      <SectionsPage />
    </ToastProvider>,
  )
}

test('toggle checkbox lalu simpan -> service dipanggil dengan isEnabled terbalik', async () => {
  mockedList.mockResolvedValueOnce(sampleSections)
  mockedUpdate.mockResolvedValueOnce(undefined)

  renderPage()
  await waitFor(() => expect(screen.getByText('Opening Cover')).toBeInTheDocument())

  const checkboxes = screen.getAllByRole('checkbox')
  fireEvent.click(checkboxes[0]) // matikan opening_cover

  fireEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }))

  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith([
      { key: 'opening_cover', isEnabled: false, sortOrder: 1 },
      { key: 'cover', isEnabled: true, sortOrder: 2 },
    ]),
  )
})

test('tombol turun menukar urutan dua section', async () => {
  mockedList.mockResolvedValueOnce(sampleSections)
  mockedUpdate.mockResolvedValueOnce(undefined)

  renderPage()
  await waitFor(() => expect(screen.getByText('Opening Cover')).toBeInTheDocument())

  fireEvent.click(screen.getByRole('button', { name: 'Turunkan Opening Cover' }))
  fireEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }))

  await waitFor(() =>
    expect(mockedUpdate).toHaveBeenCalledWith([
      { key: 'cover', isEnabled: true, sortOrder: 1 },
      { key: 'opening_cover', isEnabled: true, sortOrder: 2 },
    ]),
  )
})

// guest-fields-admin-layout E1: StickyActionBar men-disable tombol Simpan
// saat belum ada perubahan (dirty=false), jadi test ini WAJIB mengubah
// sesuatu dulu sebelum klik Simpan - berbeda dari versi lama yang klik
// langsung tanpa perubahan apa pun.
test('simpan sukses -> toast sukses muncul', async () => {
  mockedList.mockResolvedValueOnce(sampleSections)
  mockedUpdate.mockResolvedValueOnce(undefined)

  renderPage()
  await waitFor(() => expect(screen.getByText('Opening Cover')).toBeInTheDocument())

  fireEvent.click(screen.getAllByRole('checkbox')[0])
  fireEvent.click(screen.getByRole('button', { name: 'Simpan perubahan' }))

  await waitFor(() => expect(screen.getByText('Perubahan section tersimpan.')).toBeInTheDocument())
})
