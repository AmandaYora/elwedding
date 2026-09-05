import { useState } from 'react'
import { Button, Input, Textarea, Modal, Card } from '@/shared/components/ui'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { useToast } from '@/shared/components/toast/ToastProvider'
import { apiErrorMessage } from '@/shared/lib/api-error'

export interface ListColumn<T> {
  key: keyof Omit<T, 'id'>
  label: string
  type?: 'text' | 'textarea' | 'number' | 'photo' | 'time' | 'datetime-local'
  required?: boolean
  /** Sisi terpanjang target unggahan foto (diteruskan ke onUploadPhoto). */
  maxDim?: number
  /** Kolom foto ini menghasilkan DUA unggahan dari satu file yang dipilih -
   * dipakai Galeri Foto (docs/plan/admin-content-upload-base64/PLAN.md
   * keputusan K7) supaya admin cukup memilih file sekali. Kolom target TIDAK
   * dirender sebagai input tersendiri. */
  derivesTo?: { key: keyof Omit<T, 'id'>; maxDim: number }
}

interface SimpleListEditorProps<T extends { id: number; sortOrder: number }> {
  title: string
  columns: ListColumn<T>[]
  items: T[]
  emptyItem: Omit<T, 'id'>
  onCreate: (item: Omit<T, 'id'>) => Promise<void>
  onUpdate: (id: number, item: Omit<T, 'id'>) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onUploadPhoto: (file: File, maxDim?: number) => Promise<string>
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
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const toast = useToast()

  function setField(key: keyof T, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }))
    setFieldErrors((e) => ({ ...e, [String(key)]: '' }))
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyItem)
    setFieldErrors({})
    setFormOpen(true)
  }

  function openEdit(item: T) {
    setEditingId(item.id)
    const rest = { ...item } as Partial<T>
    delete rest.id
    setForm(rest as Omit<T, 'id'>)
    setFieldErrors({})
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // FE required validation (mirror BE service_lists.go requireNonEmpty)
    const errors: Record<string, string> = {}
    for (const col of columns) {
      if (col.required) {
        const v = String(form[col.key] ?? '').trim()
        if (!v) errors[String(col.key)] = `${col.label} wajib diisi`
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      toast.error('Lengkapi field wajib.')
      return
    }
    setSubmitting(true)
    try {
      if (editingId) {
        await onUpdate(editingId, form)
      } else {
        await onCreate({ ...form, sortOrder: items.length + 1 })
      }
      toast.success('Perubahan tersimpan.')
      setFormOpen(false)
    } catch (err: unknown) {
      // BE now returns specific message like "eventLabel wajib diisi"
      const msg = apiErrorMessage(err, 'Gagal menyimpan perubahan.')
      const display = msg !== 'Failed to create agenda event' ? msg : 'Gagal menyimpan perubahan.'
      // Map BE message to field if contains field name
      const m = String(display)
      const fieldMatch = columns.find((c) => m.toLowerCase().includes(String(c.key).toLowerCase()))
      if (fieldMatch) setFieldErrors({ [String(fieldMatch.key)]: display })
      toast.error(display)
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePhotoUpload(col: ListColumn<T>, file: File | undefined) {
    if (!file) return
    const k = String(col.key)
    setUploading((u) => ({ ...u, [k]: true }))
    try {
      const url = await onUploadPhoto(file, col.maxDim)
      setField(col.key, url)

      if (col.derivesTo) {
        // Satu file dua unggahan (docs/plan/admin-content-upload-base64/PLAN.md
        // keputusan K7, Galeri Foto) - HANYA dijalankan setelah unggahan utama
        // berhasil.
        try {
          const derivedUrl = await onUploadPhoto(file, col.derivesTo.maxDim)
          setField(col.derivesTo.key, derivedUrl)
        } catch {
          // Fallback wajib: BE menolak field turunan (mis. thumbUrl) kosong -
          // lihat service_lists.go requireNonEmpty - jadi tanpa ini baris
          // gagal tersimpan seluruhnya kalau hanya unggahan turunan yang gagal.
          setField(col.derivesTo.key, url)
          toast.error('Gagal membuat thumbnail, memakai foto utama sebagai gantinya.')
        }
      }

      toast.success('Foto berhasil diunggah.')
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Gagal mengunggah foto.'))
    } finally {
      setUploading((u) => ({ ...u, [k]: false }))
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

  const isUploading = Object.values(uploading).some(Boolean)

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
            // Kolom dengan derivesTo (mis. Galeri Foto) memilih pratinjau dari
            // field turunan (thumb) yang lebih kecil, bukan foto utama.
            const previewKey = photoCol ? (photoCol.derivesTo ? photoCol.derivesTo.key : photoCol.key) : undefined
            const photoUrl = previewKey ? String(item[previewKey] || '') : ''

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
            <Button onClick={handleSubmit} loading={submitting || isUploading} disabled={isUploading}>
              Simpan
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {columns.map((col) => {
            // Kolom yang menjadi target derivesTo kolom lain (mis. thumbUrl di
            // Galeri Foto) tidak dirender sebagai input tersendiri - nilainya
            // diisi otomatis oleh unggahan turunan di handlePhotoUpload.
            const isDerivedTarget = columns.some((c) => c.derivesTo && c.derivesTo.key === col.key)
            if (isDerivedTarget) return null

            return (
            <div key={String(col.key)}>
              {col.type === 'textarea' ? (
                <Textarea
                  label={`${col.label}${col.required ? ' *' : ''}`}
                  value={String(form[col.key] ?? '')}
                  onChange={(e) => setField(col.key, e.target.value)}
                  error={fieldErrors[String(col.key)]}
                />
              ) : col.type === 'photo' ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-slate-700 tracking-tight">{col.label}{col.required ? ' *' : ''}</label>
                  {fieldErrors[String(col.key)] && <p className="text-xs text-red-600">{fieldErrors[String(col.key)]}</p>}
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
                        {uploading[String(col.key)] ? 'Mengunggah...' : form[col.key] ? 'Ganti file foto' : 'Pilih file foto'}
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
                        disabled={!!uploading[String(col.key)]}
                        className="sr-only"
                        onChange={(e) => void handlePhotoUpload(col, e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <Input
                  label={`${col.label}${col.required ? ' *' : ''}`}
                  type={col.type === 'number' ? 'number' : col.type === 'time' ? 'time' : col.type === 'datetime-local' ? 'datetime-local' : 'text'}
                  value={String(form[col.key] ?? '')}
                  onChange={(e) => setField(col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)}
                  error={fieldErrors[String(col.key)]}
                />
              )}
            </div>
            )
          })}
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
