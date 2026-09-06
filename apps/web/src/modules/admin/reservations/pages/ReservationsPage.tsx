import { useEffect, useState } from 'react'
import { type Guest, listGuests, resetRsvp } from '@/modules/admin/guests/services/guests.service'
import { PAGE_SIZE, STATUS_LABEL, RESPONDED_STATUS_OPTIONS, SIDE_LABEL } from '@/shared/constants/guests'
import { formatRelativeTime } from '@/shared/utils/relative-time'
import { Button, Input, Select, Badge, Card, Table, Thead, Tbody, Tr, Th, Td, Modal, Pagination } from '@/shared/components/ui'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { TableSkeleton } from '@/shared/components/feedback/Skeleton'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { useToast } from '@/shared/components/toast/ToastProvider'
import { apiErrorMessage } from '@/shared/lib/api-error'

/**
 * Reservasi (guest-reservation-split): tamu yang SUDAH mengisi form RSVP
 * (status apa pun selain 'pending') - dipisah dari Tamu (master data murni).
 *
 * Nyaris read-only: tidak ada tambah/ubah/salin link, karena status RSVP hanya
 * bisa DIISI tamu sendiri lewat link publik, bukan admin.
 *
 * SATU pengecualian sejak docs/plan/reservation-reset-contacted-flag/PLAN.md
 * (§2.1 - pembalikan sebagian keputusan read-only): admin bisa MENGHAPUS
 * reservasi, mis. untuk membersihkan RSVP uji coba. Alasan read-only aslinya
 * tidak gugur - admin tetap tidak bisa MENGARANG jawaban tamu, ia hanya bisa
 * mengosongkannya sehingga tamu menjawab ulang sendiri.
 */
export default function ReservationsPage() {
  const [guests, setGuests] = useState<Guest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const [detailTarget, setDetailTarget] = useState<Guest | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Guest | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    listGuests({ page, status: statusFilter, q: debouncedSearch, invitationType: '', souvenirType: '', groupId: '', respondedOnly: true })
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
  }, [page, statusFilter, debouncedSearch, reloadToken])

  const hasFilter = statusFilter !== '' || debouncedSearch !== ''

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await resetRsvp(deleteTarget.id)
      toast.success(`Reservasi ${deleteTarget.name} dihapus.`)
      setDeleteTarget(null)
      // Muat ulang daftarnya: tamu yang jawabannya dikosongkan kembali
      // ber-status 'pending', sehingga ia memang tidak lagi termasuk daftar ini
      // (respondedOnly). Menghapus barisnya dari state lokal saja akan membuat
      // angka Total ikut basi.
      setReloadToken((t) => t + 1)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menghapus reservasi.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reservasi" description="Tamu yang sudah mengisi form RSVP." />

      <Card className="shadow-sm">
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
                value={statusFilter}
                onChange={(e) => {
                  setPage(1)
                  setStatusFilter(e.target.value)
                }}
              >
                <option value="">Semua status</option>
                {RESPONDED_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Total <span className="font-semibold text-slate-800 font-mono">{total}</span> tamu
          </div>
        </div>

        {loading && <TableSkeleton rows={6} cols={4} />}

        {!loading && error && <ErrorState message="Gagal memuat data reservasi." onRetry={() => setReloadToken((t) => t + 1)} />}

        {!loading && !error && guests.length === 0 && (
          <EmptyState
            title={hasFilter ? 'Tidak ada tamu yang cocok' : 'Belum ada tamu yang merespons'}
            description={hasFilter ? 'Coba ubah kata kunci atau filter.' : 'Reservasi akan muncul di sini begitu tamu mengisi form RSVP.'}
          />
        )}

        {!loading && !error && guests.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Nama</Th>
                  <Th>Pihak</Th>
                  <Th>Status RSVP</Th>
                  <Th>Direspons pada</Th>
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
                        <div className="flex items-center gap-1.5">
                          <Badge status={guest.rsvpStatus} label={STATUS_LABEL[guest.rsvpStatus]} />
                          {guest.rsvpStatus === 'attending' && (
                            <span className="text-xs text-slate-400 font-mono">{guest.attendingCount} org</span>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <span className="text-xs text-slate-500">
                          {guest.rsvpRespondedAt ? formatRelativeTime(guest.rsvpRespondedAt) : '—'}
                        </span>
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
                          {/* "Hapus" di halaman ini menghapus RESERVASI, bukan
                              tamunya - tamunya tetap ada di menu Tamu. Modal
                              konfirmasi di bawah yang menjelaskan bedanya,
                              karena label sependek ini tidak bisa. */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(guest)}
                            className="h-8 px-2 text-slate-600 hover:text-red-600 whitespace-nowrap"
                          >
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

      {/* Modal Detail Reservasi */}
      <Modal open={!!detailTarget} onClose={() => setDetailTarget(null)} title="Detail reservasi">
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
            <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status RSVP</dt>
                <dd className="text-slate-800 mt-0.5">{STATUS_LABEL[detailTarget.rsvpStatus]}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Jumlah tamu</dt>
                <dd className="text-slate-800 mt-0.5">
                  {detailTarget.rsvpStatus === 'attending' ? `${detailTarget.attendingCount} orang` : '—'}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Direspons pada</dt>
                <dd className="text-slate-800 mt-0.5">
                  {detailTarget.rsvpRespondedAt ? formatRelativeTime(detailTarget.rsvpRespondedAt) : '—'}
                </dd>
              </div>
            </div>
          </dl>
        )}
      </Modal>

      {/* Modal Hapus Reservasi.
          Teksnya menanggung beban penjelasan: kata "Hapus" di tombol tadi
          menyiratkan tamunya ikut hilang, padahal tidak. Kalimat pertama
          menyatakan apa yang terjadi, kalimat kedua menyatakan apa yang TIDAK
          terjadi - keduanya perlu, karena kesalahpahamannya justru soal yang
          kedua. */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus reservasi"
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
              Hapus jawaban RSVP <span className="font-semibold text-slate-900">{deleteTarget?.name}</span>? Statusnya kembali ke
              &quot;Belum jawab&quot; dan ia hilang dari daftar Reservasi.
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              Tamunya <span className="font-semibold text-slate-700">tidak ikut terhapus</span> — datanya tetap ada di menu Tamu,
              link &amp; QR-nya tetap berlaku, dan ia bisa mengisi RSVP lagi.
            </p>
            {/* Check-in adalah BUKTI kedatangan, terpisah dari niat RSVP
                (GLOSSARY.md) - jadi ia sengaja tidak ikut dihapus. Tapi admin
                yang menghapus reservasi tamu yang sudah tiba pantas diberi
                tahu, bukan dibiarkan menemukannya sendiri nanti. */}
            {deleteTarget?.rsvpStatus === 'attending' && (
              <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                Catatan kedatangannya di gate (jika sudah check-in) tetap tersimpan — itu bukti tamu benar-benar hadir, terpisah
                dari jawaban RSVP.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}
