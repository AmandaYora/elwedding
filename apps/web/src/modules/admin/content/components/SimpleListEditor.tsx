import { useState } from 'react'
import { Button, Input, Textarea, Modal, Card } from '@/shared/components/ui'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { useToast } from '@/shared/components/toast/ToastProvider'

export interface ListColumn<T> {
  key: keyof Omit<T, 'id'>
  label: string
  type?: 'text' | 'textarea' | 'number' | 'photo'
}

interface SimpleListEditorProps<T extends { id: number; sortOrder: number }> {
  title: string
  columns: ListColumn<T>[]
  items: T[]
  emptyItem: Omit<T, 'id'>
  onCreate: (item: Omit<T, 'id'>) => Promise<void>
  onUpdate: (id: number, item: Omit<T, 'id'>) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onUploadPhoto: (file: File) => Promise<string>
}

export default function SimpleListEditor<T extends { id: number; sortOrder: number }>({
  title,
  columns,
  items,
  emptyItem,
  onCreate,
  onUpdate,
  onDelete,
  onUploadPhoto,
}: SimpleListEditorProps<T>) {
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<Omit<T, 'id'>>(emptyItem)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  function setField(key: keyof T, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyItem)
    setFormOpen(true)
  }

  function openEdit(item: T) {
    setEditingId(item.id)
    const rest = { ...item } as Partial<T>
    delete rest.id
    setForm(rest as Omit<T, 'id'>)
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (editingId) {
        await onUpdate(editingId, form)
      } else {
        await onCreate({ ...form, sortOrder: items.length + 1 })
      }
      toast.success('Perubahan tersimpan.')
      setFormOpen(false)
    } catch {
      toast.error('Gagal menyimpan perubahan.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePhotoUpload(key: keyof T, file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const url = await onUploadPhoto(file)
      setField(key, url)
      toast.success('Foto berhasil diunggah.')
    } catch {
      toast.error('Gagal mengunggah foto.')
    } finally {
      setUploading(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await onDelete(deleteTarget.id)
      toast.success('Data dihapus.')
      setDeleteTarget(null)
    } catch {
      toast.error('Gagal menghapus data.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="mb-6 shadow-xs border-slate-200">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-bold text-slate-900 tracking-tight">{title}</p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-mono">
            {items.length}
          </span>
        </div>
        <Button size="sm" onClick={openCreate} className="shadow-2xs">
          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
          + Tambah
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="p-4">
          <EmptyState title="Belum ada data" description={`Belum ada item ${title.toLowerCase()} yang ditambahkan.`} />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => {
            const photoCol = columns.find((c) => c.type === 'photo')
            const photoUrl = photoCol ? String(item[photoCol.key] || '') : ''

            return (
              <li
                key={item.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/70 transition-colors duration-150"
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt=""
                    className="w-11 h-11 rounded-lg object-cover border border-slate-200 shadow-2xs shrink-0 bg-slate-100"
                  />
                ) : null}

                <span className="flex-1 truncate text-sm font-medium text-slate-800">
                  {columns.map((c) => String(item[c.key])).join(' — ')}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(item)} className="h-8 px-2.5 text-slate-600 hover:text-blue-600">
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Ubah
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item)} className="h-8 px-2.5 text-slate-600 hover:text-red-600">
                    <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? `Ubah ${title}` : `Tambah ${title}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} loading={submitting || uploading}>
              Simpan
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {columns.map((col) => (
            <div key={String(col.key)}>
              {col.type === 'textarea' ? (
                <Textarea
                  label={col.label}
                  value={String(form[col.key] ?? '')}
                  onChange={(e) => setField(col.key, e.target.value)}
                />
              ) : col.type === 'photo' ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-700 tracking-tight">{col.label}</label>
                  <div className="flex items-center gap-3">
                    {!!form[col.key] && (
                      <img
                        src={String(form[col.key])}
                        alt=""
                        className="h-16 w-16 object-cover rounded-xl border border-slate-200 shadow-2xs shrink-0"
                      />
                    )}
                    <label className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-center px-4 py-2.5 rounded-lg border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/30 text-xs font-medium text-slate-600 transition-colors">
                        <svg className="w-4 h-4 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {uploading ? 'Mengunggah...' : !!form[col.key] ? 'Ganti file foto' : 'Pilih file foto'}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        className="sr-only"
                        onChange={(e) => void handlePhotoUpload(col.key, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <Input
                  label={col.label}
                  type={col.type === 'number' ? 'number' : 'text'}
                  value={String(form[col.key] ?? '')}
                  onChange={(e) => setField(col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                />
              )}
            </div>
          ))}
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Hapus ${title}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Batal
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              Hapus
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">Hapus data ini? Tindakan ini tidak bisa dibatalkan.</p>
      </Modal>
    </Card>
  )
}

