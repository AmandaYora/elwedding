import { useEffect, useState } from 'react'
import {
  type Guest,
  type GuestInput,
  createGuest,
  deleteGuest,
  listGuests,
  updateGuest,
} from '@/modules/admin/guests/services/guests.service'
import { guestSchema, type GuestFormValues } from '@/modules/admin/guests/schemas/guest.schema'
// Mengimpor service milik modul admin LAIN bukan pelanggaran di sisi frontend -
// aturan batas contracts/ yang ketat berlaku untuk apps/api/** saja
// (.claude/rules/backend-modular-monolith.md). Preseden yang sudah ada:
// SettingsPage mengimpor content.service; DashboardPage & ReservationsPage
// mengimpor guests.service.
import { getConfig, type WhatsAppConfig } from '@/modules/admin/whatsapp/services/whatsapp.service'
import { getContent } from '@/modules/admin/content/services/content.service'
import { normalizePhoneForWa, applyInvitationTemplate, buildWaMeUrl } from '@/shared/lib/waInvite'
import type { InvitationContent } from '@/types/api'
import {
  PAGE_SIZE,
  GENDER_LABEL,
  GENDER_OPTIONS,
  INVITATION_TYPE_LABEL,
  INVITATION_TYPE_OPTIONS,
  SOUVENIR_TYPE_LABEL,
  SOUVENIR_TYPE_OPTIONS,
  SIDE_LABEL,
  SIDE_OPTIONS,
  EXPECTED_ATTENDING_LABEL,
  EXPECTED_ATTENDING_DESCRIPTION,
} from '@/shared/constants/guests'
import { Button, Input, Select, Textarea, Switch, Badge, Card, Table, Thead, Tbody, Tr, Th, Td, Modal, Pagination } from '@/shared/components/ui'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { TableSkeleton } from '@/shared/components/feedback/Skeleton'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { useToast } from '@/shared/components/toast/ToastProvider'

const EMPTY_FORM: GuestInput = {
  name: '',
  phone: '',
  side: 'groom',
  gender: 'male',
  invitationType: 'online',
  souvenirType: 'regular',
  email: '',
  address: '',
  notes: '',
  isExpectedAttending: true,
}

type FormErrors = Partial<Record<keyof GuestFormValues, string>>

export default function GuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [invitationTypeFilter, setInvitationTypeFilter] = useState('')
  const [souvenirTypeFilter, setSouvenirTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const toast = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<GuestInput>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Guest | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [detailTarget, setDetailTarget] = useState<Guest | null>(null)

  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Dua singleton yang dibutuhkan tombol "Kirim Undangan": template pesannya
  // (menu WhatsApp) dan nama mempelai + tanggal acara (menu Konten).
  // Keduanya sudah punya endpoint admin sendiri, jadi pesan dirakit di klien
  // dan TIDAK ada endpoint baru maupun pembacaan lintas modul di sisi Go
  // (docs/plan/og-share-image-dinamis/PLAN.md D10).
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null)
  const [invitationContent, setInvitationContent] = useState<InvitationContent | null>(null)

  // Kegagalan kedua permintaan ini TIDAK BOLEH menggagalkan daftar tamu -
  // ditangkap terpisah dari listGuests, dan akibatnya hanya tombol Kirim
  // Undangan yang nonaktif, bukan halaman error.
  useEffect(() => {
    let cancelled = false
    getConfig()
      .then((c) => !cancelled && setWaConfig(c))
      .catch(() => !cancelled && setWaConfig(null))
    getContent()
      .then((c) => !cancelled && setInvitationContent(c))
      .catch(() => !cancelled && setInvitationContent(null))
    return () => {
      cancelled = true
    }
  }, [])

  // Debounce pencarian
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    listGuests({ page, status: '', q: debouncedSearch, invitationType: invitationTypeFilter, souvenirType: souvenirTypeFilter, respondedOnly: false })
      .then((res) => {
        if (cancelled) return
        setGuests(res.data)
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
  }, [page, invitationTypeFilter, souvenirTypeFilter, debouncedSearch, reloadToken])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setFormOpen(true)
  }

  function openEdit(guest: Guest) {
    setEditingId(guest.id)
    setForm({
      name: guest.name,
      phone: guest.phone,
      side: guest.side,
      gender: guest.gender ?? 'male',
      invitationType: guest.invitationType,
      souvenirType: guest.souvenirType,
      email: guest.email,
      address: guest.address,
      notes: guest.notes,
      isExpectedAttending: guest.isExpectedAttending,
    })
    setFormErrors({})
    setFormOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = guestSchema.safeParse(form)
    if (!parsed.success) {
      const errors: FormErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof GuestFormValues
        errors[key] = issue.message
      }
      setFormErrors(errors)
      return
    }
    setFormErrors({})

    setSubmitting(true)
    try {
      if (editingId) {
        await updateGuest(editingId, parsed.data)
        toast.success('Data tamu tersimpan.')
      } else {
        await createGuest(parsed.data)
        toast.success('Tamu baru ditambahkan.')
      }
      setFormOpen(false)
      setReloadToken((t) => t + 1)
    } catch {
      toast.error('Gagal menyimpan data tamu.')
    } finally {
      setSubmitting(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteGuest(deleteTarget.id)
      toast.success(`${deleteTarget.name} dihapus.`)
      setDeleteTarget(null)
      setReloadToken((t) => t + 1)
    } catch {
      toast.error('Gagal menghapus tamu, coba lagi.')
    } finally {
      setDeleting(false)
    }
  }

  /** SATU-SATUNYA tempat format link undangan disusun. "Salin link" dan
   * "Kirim Undangan" WAJIB memakai fungsi yang sama - dua format berbeda
   * untuk hal yang sama adalah bug yang menunggu terjadi.
   * Token tidak perlu dijaga kosong: kolomnya VARCHAR(64) NOT NULL UNIQUE dan
   * SELALU dibuat server-side oleh generateToken() saat tamu dibuat. */
  function invitationLink(guest: Guest) {
    return `${window.location.origin}/?guest=${guest.token}`
  }

  function copyLink(guest: Guest) {
    void navigator.clipboard.writeText(invitationLink(guest))
    setCopiedId(guest.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  /** URL wa.me siap pakai untuk satu tamu, atau `null` bila undangan belum
   * bisa dikirim. `null` -> tombol dirender NON-ANCHOR & disabled (K7). */
  function waInviteUrl(guest: Guest): string | null {
    const phone = normalizePhoneForWa(guest.phone)
    if (!phone) return null
    if (!waConfig || !invitationContent) return null
    if (waConfig.invitationTemplate.trim() === '') return null

    const text = applyInvitationTemplate(waConfig.invitationTemplate, {
      nama: guest.name,
      mempelai: `${invitationContent.brideName} & ${invitationContent.groomName}`,
      // weddingDateLabel apa adanya - JANGAN memformat ulang weddingDateRaw di
      // klien, supaya tanggalnya identik dengan yang dipakai jalur QR.
      tanggal: invitationContent.weddingDateLabel,
      link: invitationLink(guest),
    })
    return buildWaMeUrl(phone, text)
  }

  /** Alasan tombol nonaktif, ditampilkan sebagai title supaya admin tahu apa
   * yang harus diperbaiki alih-alih menghadapi tombol mati tanpa penjelasan. */
  function waDisabledReason(guest: Guest): string {
    if (!normalizePhoneForWa(guest.phone)) return 'Nomor HP tamu belum diisi.'
    if (!waConfig || !invitationContent) return 'Gagal memuat template/konten undangan. Muat ulang halaman.'
    return 'Template Pesan Undangan belum diisi di menu WhatsApp.'
  }

  const hasFilter = debouncedSearch !== '' || invitationTypeFilter !== '' || souvenirTypeFilter !== ''

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tamu"
        description="Kelola master data tamu undangan & buat link undangan personal."
        action={
          <Button onClick={openCreate} size="md" className="shadow-sm">
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            + Tambah tamu
          </Button>
        }
      />

      {/* Main Table Card */}
      <Card className="shadow-sm">
        {/* Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Cari nama, telepon, atau email..."
                value={search}
                onChange={(e) => {
                  setPage(1)
                  setSearch(e.target.value)
                }}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
            </div>
            <div className="w-full sm:w-44">
              <Select
                value={invitationTypeFilter}
                onChange={(e) => {
                  setPage(1)
                  setInvitationTypeFilter(e.target.value)
                }}
              >
                <option value="">Semua jenis undangan</option>
                {INVITATION_TYPE_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {INVITATION_TYPE_LABEL[v]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-44">
              <Select
                value={souvenirTypeFilter}
                onChange={(e) => {
                  setPage(1)
                  setSouvenirTypeFilter(e.target.value)
                }}
              >
                <option value="">Semua souvenir</option>
                {SOUVENIR_TYPE_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {SOUVENIR_TYPE_LABEL[v]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Total <span className="font-semibold text-slate-800 font-mono">{total}</span> tamu
          </div>
        </div>

        {loading && <TableSkeleton rows={6} cols={5} />}

        {!loading && error && <ErrorState message="Gagal memuat data tamu." onRetry={() => setReloadToken((t) => t + 1)} />}

        {!loading && !error && guests.length === 0 && (
          <EmptyState
            title={hasFilter ? 'Tidak ada tamu yang cocok' : 'Belum ada tamu'}
            description={hasFilter ? 'Coba ubah kata kunci atau filter.' : 'Tambahkan tamu pertama untuk mulai mengelola kehadiran.'}
            action={!hasFilter ? <Button size="sm" onClick={openCreate}>+ Tambah tamu</Button> : undefined}
          />
        )}

        {!loading && !error && guests.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Nama</Th>
                  <Th>Pihak</Th>
                  <Th>Jenis undangan</Th>
                  <Th>Souvenir</Th>
                  <Th className="text-right pr-6">Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {guests.map((guest) => {
                  const initial = guest.name.trim().charAt(0).toUpperCase() || '?'
                  return (
                    <Tr key={guest.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900">{guest.name}</span>
                              {!guest.isExpectedAttending && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200"
                                  title="Diperkirakan admin tidak akan hadir"
                                >
                                  Diperkirakan tidak hadir
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400">{guest.gender ? GENDER_LABEL[guest.gender] : 'Gender belum diisi'}</span>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <span
                          className={[
                            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                            guest.side === 'groom'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200',
                          ].join(' ')}
                        >
                          {SIDE_LABEL[guest.side]}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={guest.invitationType === 'online' ? 'blue' : 'violet'} label={INVITATION_TYPE_LABEL[guest.invitationType]} />
                      </Td>
                      <Td>
                        <Badge tone={guest.souvenirType === 'vip' ? 'amber' : 'slate'} label={SOUVENIR_TYPE_LABEL[guest.souvenirType]} />
                      </Td>
                      <Td className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailTarget(guest)}
                            className="h-8 px-2 text-slate-600 hover:text-blue-600 whitespace-nowrap"
                          >
                            Detail
                          </Button>
                          <Button
                            variant={copiedId === guest.id ? 'primary' : 'secondary'}
                            size="sm"
                            onClick={() => copyLink(guest)}
                            className="h-8 px-2.5 text-xs shadow-2xs whitespace-nowrap"
                          >
                            <svg className="w-3.5 h-3.5 mr-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            {copiedId === guest.id ? 'Tersalin!' : 'Salin link'}
                          </Button>
                          {/* Kirim Undangan lewat wa.me - membuka WhatsApp
                              dengan pesan sudah terisi. Ini BUKAN modul
                              WhatsApp (whatsmeow) yang mengirim QR otomatis:
                              tidak ada request ke backend, tidak ada log, dan
                              sakelar "pengiriman otomatis" tidak mengaturnya
                              (D12). Pengirimannya juga tidak dilacak (K6) -
                              wa.me secara desain tidak bisa melaporkan apa pun
                              kembali ke aplikasi.

                              Keadaan bisa-kirim dirender <a>, bukan
                              window.open di handler klik, supaya tidak
                              diblokir popup blocker dan admin bisa
                              Ctrl/Cmd-klik. Keadaan nonaktif dirender
                              <Button disabled> - <a> yang "di-disable" lewat
                              atribut tetap bisa diklik. */}
                          {(() => {
                            const url = waInviteUrl(guest)
                            return url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`Kirim undangan ke ${guest.name} lewat WhatsApp`}
                                className="inline-flex items-center h-8 px-2.5 rounded-lg text-xs font-semibold whitespace-nowrap border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors shadow-2xs"
                              >
                                <svg className="w-3.5 h-3.5 mr-1 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 004.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0012.04 2zm5.8 14.13c-.24.68-1.42 1.31-1.96 1.36-.5.05-1.14.07-1.84-.12-.42-.13-.97-.31-1.67-.61-2.94-1.27-4.86-4.23-5.01-4.43-.15-.2-1.2-1.59-1.2-3.03s.76-2.15 1.03-2.44c.27-.3.59-.37.79-.37.2 0 .39 0 .57.01.18.01.42-.07.66.5.24.58.83 2.01.9 2.16.07.15.12.32.02.52-.1.2-.15.32-.29.5-.15.17-.31.39-.44.52-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.03 1.12 1 2.06 1.31 2.36 1.46.3.15.47.12.64-.07.17-.2.74-.86.94-1.16.2-.3.39-.25.66-.15.27.1 1.7.8 1.99.95.29.15.48.22.55.35.07.12.07.72-.17 1.4z" />
                                </svg>
                                Kirim Undangan
                              </a>
                            ) : (
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled
                                title={waDisabledReason(guest)}
                                className="h-8 px-2.5 text-xs whitespace-nowrap"
                              >
                                Kirim Undangan
                              </Button>
                            )
                          })()}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(guest)}
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
                            onClick={() => setDeleteTarget(guest)}
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
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>

      {/* Modal Tambah/Ubah Tamu */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Ubah tamu' : 'Tambah tamu'}
        size="2xl"
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
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Nama"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              error={formErrors.name}
              autoFocus
              placeholder="Nama lengkap tamu"
            />
          </div>
          <Select
            label="Gender"
            value={form.gender}
            error={formErrors.gender}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as GuestInput['gender'] }))}
          >
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {GENDER_LABEL[g]}
              </option>
            ))}
          </Select>
          <Select
            label="Jenis undangan"
            value={form.invitationType}
            error={formErrors.invitationType}
            onChange={(e) => setForm((f) => ({ ...f, invitationType: e.target.value as GuestInput['invitationType'] }))}
          >
            {INVITATION_TYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {INVITATION_TYPE_LABEL[v]}
              </option>
            ))}
          </Select>
          <Select
            label="Pihak"
            value={form.side}
            error={formErrors.side}
            onChange={(e) => setForm((f) => ({ ...f, side: e.target.value as GuestInput['side'] }))}
          >
            {SIDE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SIDE_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select
            label="Souvenir"
            value={form.souvenirType}
            error={formErrors.souvenirType}
            onChange={(e) => setForm((f) => ({ ...f, souvenirType: e.target.value as GuestInput['souvenirType'] }))}
          >
            {SOUVENIR_TYPE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {SOUVENIR_TYPE_LABEL[v]}
              </option>
            ))}
          </Select>
          <Input
            label="Email"
            type="email"
            value={form.email}
            error={formErrors.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="nama@email.com"
          />
          <Input
            label="Telepon"
            value={form.phone}
            error={formErrors.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="08123456789"
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Alamat"
              value={form.address}
              error={formErrors.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Alamat lengkap tamu"
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Catatan"
              value={form.notes}
              error={formErrors.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Catatan tambahan (opsional)"
            />
          </div>
          <div className="sm:col-span-2 pt-2 border-t border-slate-100">
            <Switch
              checked={form.isExpectedAttending}
              onChange={(checked) => setForm((f) => ({ ...f, isExpectedAttending: checked }))}
              label={EXPECTED_ATTENDING_LABEL}
              description={EXPECTED_ATTENDING_DESCRIPTION}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Detail Tamu */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)} title="Detail tamu">
        {detailTarget && (
          <dl className="flex flex-col gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</dt>
              <dd className="text-slate-800 mt-0.5">{detailTarget.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Telepon</dt>
              <dd className="text-slate-800 mt-0.5">{detailTarget.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Alamat</dt>
              <dd className="text-slate-800 mt-0.5 whitespace-pre-wrap">{detailTarget.address || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Catatan</dt>
              <dd className="text-slate-800 mt-0.5 whitespace-pre-wrap">{detailTarget.notes || '—'}</dd>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{EXPECTED_ATTENDING_LABEL}</dt>
              <dd className="text-slate-800 mt-0.5">{detailTarget.isExpectedAttending ? 'Ya' : 'Tidak'}</dd>
            </div>
          </dl>
        )}
      </Modal>

      {/* Modal Hapus Tamu */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus tamu"
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
              Hapus <span className="font-semibold text-slate-900">{deleteTarget?.name}</span> dari daftar tamu? Tindakan ini tidak bisa
              dibatalkan.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
