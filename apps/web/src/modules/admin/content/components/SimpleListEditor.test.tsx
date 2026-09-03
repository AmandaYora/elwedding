import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider } from '@/shared/components/toast/ToastProvider'
import SimpleListEditor from './SimpleListEditor'

interface GalleryItem {
  id: number
  sortOrder: number
  photoUrl: string
  thumbUrl: string
}

function renderGalleryEditor(
  onUploadPhoto: (file: File, maxDim?: number) => Promise<string>,
  onCreate: (item: Omit<GalleryItem, 'id'>) => Promise<void>,
) {
  return render(
    <ToastProvider>
      <SimpleListEditor<GalleryItem>
        title="Galeri Foto"
        items={[]}
        columns={[
          {
            key: 'photoUrl',
            label: 'Foto',
            type: 'photo',
            required: true,
            maxDim: 1920,
            derivesTo: { key: 'thumbUrl', maxDim: 480 },
          },
        ]}
        emptyItem={{ photoUrl: '', thumbUrl: '', sortOrder: 0 }}
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onUploadPhoto={onUploadPhoto}
      />
    </ToastProvider>,
  )
}

function openCreateForm() {
  fireEvent.click(screen.getByRole('button', { name: /tambah/i }))
}

test('kolom dengan derivesTo merender satu input file, bukan dua', () => {
  renderGalleryEditor(vi.fn(), vi.fn())
  openCreateForm()

  expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1)
})

test('satu berkas memicu dua pemanggilan onUploadPhoto (maxDim 1920 lalu 480) dan mengisi kedua field', async () => {
  const onUploadPhoto = vi
    .fn()
    .mockResolvedValueOnce('/uploads/images/full.webp')
    .mockResolvedValueOnce('/uploads/images/thumb.webp')
  const onCreate = vi.fn().mockResolvedValue(undefined)

  renderGalleryEditor(onUploadPhoto, onCreate)
  openCreateForm()

  const file = new File(['dummy'], 'foto.png', { type: 'image/png' })
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(fileInput, { target: { files: [file] } })

  await waitFor(() => expect(onUploadPhoto).toHaveBeenCalledTimes(2))
  expect(onUploadPhoto).toHaveBeenNthCalledWith(1, file, 1920)
  expect(onUploadPhoto).toHaveBeenNthCalledWith(2, file, 480)

  fireEvent.click(screen.getByRole('button', { name: /^simpan$/i }))

  await waitFor(() =>
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ photoUrl: '/uploads/images/full.webp', thumbUrl: '/uploads/images/thumb.webp' }),
    ),
  )
})

test('bila unggahan thumbnail (turunan) ditolak, thumbUrl terisi nilai photoUrl sebagai fallback', async () => {
  const onUploadPhoto = vi
    .fn()
    .mockResolvedValueOnce('/uploads/images/full.webp')
    .mockRejectedValueOnce(new Error('gagal membuat thumbnail'))
  const onCreate = vi.fn().mockResolvedValue(undefined)

  renderGalleryEditor(onUploadPhoto, onCreate)
  openCreateForm()

  const file = new File(['dummy'], 'foto.png', { type: 'image/png' })
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(fileInput, { target: { files: [file] } })

  await waitFor(() => expect(onUploadPhoto).toHaveBeenCalledTimes(2))

  fireEvent.click(screen.getByRole('button', { name: /^simpan$/i }))

  await waitFor(() =>
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ photoUrl: '/uploads/images/full.webp', thumbUrl: '/uploads/images/full.webp' }),
    ),
  )
})
