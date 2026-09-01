import { useEffect, useState } from 'react'
import {
  type AdminUser,
  type CreateUserInput,
  createUser,
  deleteUser,
  listUsers,
  updateUser,
} from '@/modules/admin/users/services/users.service'
import { createUserSchema, updateUserSchema, type CreateUserFormValues, type UpdateUserFormValues } from '@/modules/admin/users/schemas/user.schema'
import { formatRelativeTime } from '@/shared/utils/relative-time'
import { Button, Input, Card, Table, Thead, Tbody, Tr, Th, Td, Modal, Pagination } from '@/shared/components/ui'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { TableSkeleton } from '@/shared/components/feedback/Skeleton'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { useToast } from '@/shared/components/toast/ToastProvider'

const EMPTY_FORM: CreateUserInput = { username: '', password: '' }

type FormErrors = Partial<Record<keyof CreateUserFormValues, string>>

/**
 * Pengguna (admin-users): CRUD akun admin, semua admin setara/tanpa role
 * (PLAN.md keputusan #2) - tanpa filter/pencarian (skala akun admin kecil,
 * §2 keputusan desain). Guardrail hapus diri sendiri/admin terakhir
 * ditegakkan backend - di sini cuma toast generik saat gagal, sama persis
 * pola GuestsPage.tsx (tidak ada preseden menampilkan pesan error backend
 * spesifik di frontend manapun).
 */
export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<CreateUserInput>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    listUsers(page)
      .then((res) => {
        if (cancelled) return
        setUsers(res.data)
        setTotal(res.meta.total)
        setError(false)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, reloadToken])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setFormOpen(true)
  }

  function openEdit(user: AdminUser) {
    setEditingId(user.id)
    setForm({ username: user.username, password: '' })
    setFormErrors({})
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const schema = editingId ? updateUserSchema : createUserSchema
    const parsed = schema.safeParse(form)
    if (!parsed.success) {
      const errors: FormErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FormErrors
        errors[key] = issue.message
      }
      setFormErrors(errors)
      return
    }
    setFormErrors({})

    setSubmitting(true)
    try {
      if (editingId) {
        await updateUser(editingId, parsed.data as UpdateUserFormValues)
        toast.success('Data pengguna tersimpan.')
      } else {
        await createUser(parsed.data as CreateUserFormValues)
        toast.success('Pengguna baru ditambahkan.')
      }
      setFormOpen(false)
      setReloadToken((t) => t + 1)
    } catch {
      toast.error('Gagal menyimpan pengguna.')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      toast.success(`${deleteTarget.username} dihapus.`)
      setDeleteTarget(null)
      setReloadToken((t) => t + 1)
    } catch {
      toast.error('Gagal menghapus pengguna.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengguna"
        description="Kelola akun admin yang bisa login ke dashboard ini."
        action={
          <Button onClick={openCreate} size="md" className="shadow-sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            + Tambah pengguna
          </Button>
        }
      />

      <Card className="shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-end">
          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Total <span className="font-semibold text-slate-800 font-mono">{total}</span> pengguna
          </div>
        </div>

        {loading && <TableSkeleton rows={4} cols={3} />}

        {!loading && error && <ErrorState message="Gagal memuat data pengguna." onRetry={() => setReloadToken((t) => t + 1)} />}

        {!loading && !error && users.length === 0 && (
          <EmptyState
            title="Belum ada pengguna"
            description="Tambahkan akun admin pertama untuk mulai mengelola dashboard."
            action={<Button size="sm" onClick={openCreate}>+ Tambah pengguna</Button>}
          />
        )}

        {!loading && !error && users.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Username</Th>
                  <Th>Dibuat pada</Th>
                  <Th className="text-right pr-6">Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {users.map((user) => {
                  const initial = user.username.trim().charAt(0).toUpperCase() || '?'
                  return (
                    <Tr key={user.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <span className="font-semibold text-slate-900">{user.username}</span>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-xs text-slate-500">{formatRelativeTime(user.createdAt)}</span>
                      </Td>
                      <Td className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(user)}
                            className="h-8 px-2 text-slate-600 hover:text-blue-600 whitespace-nowrap"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Ubah
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(user)}
                            className="h-8 px-2 text-slate-600 hover:text-red-600 whitespace-nowrap"
                          >
                            <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Hapus
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </Tbody>
            </Table>
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/30">
              <Pagination page={page} pageSize={20} total={total} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>

      {/* Modal Tambah/Ubah Pengguna */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Ubah pengguna' : 'Tambah pengguna'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} loading={submitting}>
              Simpan
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Username"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            error={formErrors.username}
            autoFocus
            placeholder="username login"
          />
          <Input
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            error={formErrors.password}
            placeholder={editingId ? 'Kosongkan bila tidak ingin mengganti password' : 'Minimal 6 karakter'}
          />
        </form>
      </Modal>

      {/* Modal Hapus Pengguna */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus pengguna"
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
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Hapus <span className="font-semibold text-slate-900">{deleteTarget?.username}</span> dari daftar pengguna? Tindakan ini
              tidak bisa dibatalkan.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
