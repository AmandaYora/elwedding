import { useEffect, useState } from 'react'
import {
  GROUP_PAGE_SIZE,
  type GroupInput,
  type GuestGroup,
  createGroup,
  deleteGroup,
  listGroups,
  updateGroup,
} from '@/modules/admin/groups/services/groups.service'
import { groupSchema, type GroupFormValues } from '@/modules/admin/groups/schemas/group.schema'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { formatRelativeTime } from '@/shared/utils/relative-time'
import { Button, Input, Textarea, Card, Table, Thead, Tbody, Tr, Th, Td, Modal, Pagination } from '@/shared/components/ui'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { TableSkeleton } from '@/shared/components/feedback/Skeleton'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { useToast } from '@/shared/components/toast/ToastProvider'

// defaultPax 2 mengikuti DEFAULT kolomnya di migration 000017 - group baru
// mewarisi batas yang berlaku hari ini, dan admin menaikkannya hanya untuk
// group yang memang perlu (mis. "Keluarga" jadi 4).
const EMPTY_FORM: GroupInput = { name: '', description: '', defaultPax: 2 }

type FormErrors = Partial<Record<keyof GroupFormValues, string>>

/**
 * Group (docs/plan/guest-groups/PLAN.md T13): CRUD group tamu, strukturnya
 * mengikuti UsersPage - tanpa filter maupun pencarian, karena jumlah group
 * puluhan dan satu halaman paginasi sudah cukup (§3.2).
 *
 * Menu ini ADMIN-ONLY. Petugas gate tidak pernah melihatnya di sidebar
 * (SCANNER_ALLOWED_PATHS tidak memuatnya) dan tetap ditolak 403 oleh
 * RequireFullAdmin kalau memaksa membuka URL-nya (D10) - penyaringan menu
 * murni kosmetik.
 */
export default function GroupsPage() {
  const [groups, setGroups] = useState<GuestGroup[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<GroupInput>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<GuestGroup | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    listGroups(page)
      .then((res) => {
        if (cancelled) return
        setGroups(res.data)
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

  /** Menyunting dari baris yang SUDAH ada di state - tidak perlu GET per id
   * (pola openEdit di UsersPage). */
  function openEdit(group: GuestGroup) {
    setEditingId(group.id)
    setForm({ name: group.name, description: group.description, defaultPax: group.defaultPax })
    setFormErrors({})
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = groupSchema.safeParse(form)
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
        await updateGroup(editingId, parsed.data)
        toast.success('Group tersimpan.')
      } else {
        await createGroup(parsed.data)
        toast.success('Group baru ditambahkan.')
      }
      setFormOpen(false)
      setReloadToken((t) => t + 1)
    } catch (err) {
      // Pesan backend ("Nama group sudah dipakai") jauh lebih berguna daripada
      // "gagal menyimpan" generik - nama UNIQUE ditegakkan di server (D5),
      // jadi hanya server yang tahu duluan.
      toast.error(apiErrorMessage(err, 'Gagal menyimpan group.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteGroup(deleteTarget.id)
      toast.success(`${deleteTarget.name} dihapus.`)
      setDeleteTarget(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      // K4: penolakan "masih dipakai N tamu" datang APA ADANYA dari backend -
      // jangan ditulis ulang di sini. Hanya server yang punya hitungan yang
      // segar, dan menduplikasi kalimatnya membuat dua sumber kebenaran.
      toast.error(apiErrorMessage(err, 'Gagal menghapus group.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Group"
        description="Kelompokkan tamu undangan — nama group ikut tampil di layar scan petugas."
        action={
          <Button onClick={openCreate} size="md" className="shadow-sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            + Tambah group
          </Button>
        }
      />

      <Card className="shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-end">
          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Total <span className="font-semibold text-slate-800 font-mono">{total}</span> group
          </div>
        </div>

        {loading && <TableSkeleton rows={4} cols={4} />}

        {!loading && error && <ErrorState message="Gagal memuat data group." onRetry={() => setReloadToken((t) => t + 1)} />}

        {!loading && !error && groups.length === 0 && (
          <EmptyState
            title="Belum ada group"
            description="Buat group pertama — setiap tamu wajib masuk ke salah satu group."
            action={<Button size="sm" onClick={openCreate}>+ Tambah group</Button>}
          />
        )}

        {!loading && !error && groups.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Nama</Th>
                  <Th>Deskripsi</Th>
                  {/* DUA kolom yang mudah tertukar, sengaja bersebelahan:
                      "Jatah kursi" = setelan (default_pax, berapa orang per
                      undangan), "Jumlah tamu" = kenyataan (guestCount, berapa
                      undangan di group ini). */}
                  <Th>Jatah kursi</Th>
                  <Th>Jumlah tamu</Th>
                  <Th>Dibuat pada</Th>
                  <Th className="text-right pr-6">Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {groups.map((group) => (
                  <Tr key={group.id}>
                    <Td>
                      <span className="font-semibold text-slate-900">{group.name}</span>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-600">{group.description || '—'}</span>
                    </Td>
                    {/* Jatah kursi default group ini - setelan, bukan
                        kenyataan. Ditampilkan supaya admin bisa memeriksa
                        seluruh group sekaligus tanpa membuka modal satu per
                        satu. */}
                    <Td>
                      <span className="text-sm text-slate-700 tabular-nums">{group.defaultPax} org</span>
                    </Td>
                    {/* Kolom "Jumlah tamu" WAJIB ada (T13): dialah yang
                        menjelaskan ke admin kenapa sebuah group tidak bisa
                        dihapus, sebelum ia mencoba dan ditolak. */}
                    <Td>
                      <span
                        className={[
                          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums',
                          group.guestCount > 0
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-50 text-slate-500 border border-slate-200',
                        ].join(' ')}
                      >
                        {group.guestCount} tamu
                      </span>
                    </Td>
                    <Td>
                      <span className="text-xs text-slate-500">{formatRelativeTime(group.createdAt)}</span>
                    </Td>
                    <Td className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(group)}
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
                          onClick={() => setDeleteTarget(group)}
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
                ))}
              </Tbody>
            </Table>
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/30">
              <Pagination page={page} pageSize={GROUP_PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>

      {/* Modal Tambah/Ubah Group */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Ubah group' : 'Tambah group'}
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
            label="Nama group"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            error={formErrors.name}
            autoFocus
            placeholder="mis. Teman Kantor"
          />
          <Textarea
            label="Deskripsi"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            error={formErrors.description}
            placeholder="Keterangan singkat (opsional)"
          />
          {/* Label "Jatah kursi default", BUKAN "Maks. tamu" dan BUKAN "Jumlah
              tamu" (docs/plan/guest-pax-quota/PLAN.md T18, dengan koreksi saat
              implementasi):

              - "Maks." ditolak karena membuat admin mengira ini batas keras
                yang mengunci seluruh anggota group, padahal yang mengikat
                adalah angka per tamu.
              - "Jumlah tamu" ditolak karena BENTROK dengan kolom tabel di atas
                yang sudah bernama itu untuk `guestCount` (banyaknya tamu di
                group). Dua arti untuk satu label di satu layar.

              "Jatah kursi" adalah istilah yang dipakai konsisten di PLAN.md,
              migration 000017, dan GLOSSARY.md.

              Number(e.target.value) pada input kosong menghasilkan 0, dan 0
              memang ditolak groupSchema - sengaja, supaya field yang
              dikosongkan tidak diam-diam tersimpan. */}
          <Input
            label="Jatah kursi default"
            type="number"
            min={1}
            max={20}
            value={String(form.defaultPax)}
            onChange={(e) => setForm((f) => ({ ...f, defaultPax: Number(e.target.value) }))}
            error={formErrors.defaultPax}
            hint="Nilai awal untuk tamu baru di group ini. Bisa diubah per tamu."
          />
        </form>
      </Modal>

      {/* Modal Hapus Group */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus group"
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
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-700 leading-relaxed">
              Hapus <span className="font-semibold text-slate-900">{deleteTarget?.name}</span> dari daftar group? Tindakan ini tidak bisa
              dibatalkan.
            </p>
            {/* Peringatan dini K4 - penolakan sebenarnya tetap datang dari
                backend, ini hanya menghemat satu percobaan yang pasti gagal. */}
            {!!deleteTarget && deleteTarget.guestCount > 0 && (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 leading-relaxed">
                Group ini masih dipakai {deleteTarget.guestCount} tamu. Pindahkan tamunya ke group lain lebih dulu.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
