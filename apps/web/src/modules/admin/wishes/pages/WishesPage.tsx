import { useEffect, useState } from 'react'
import {
  WISH_PAGE_SIZE,
  type Wish,
  deleteWish,
  listWishes,
  setWishHidden,
} from '@/modules/admin/wishes/services/wishes.service'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { formatRelativeTime } from '@/shared/utils/relative-time'
import { SIDE_LABEL } from '@/shared/constants/guests'
import { Button, Card, Table, Thead, Tbody, Tr, Th, Td, Badge, Modal, Pagination } from '@/shared/components/ui'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { TableSkeleton } from '@/shared/components/feedback/Skeleton'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { useToast } from '@/shared/components/toast/ToastProvider'

/**
 * Ucapan tamu (docs/plan/wedding-wish/PLAN.md T19): daftar + sembunyikan/
 * tampilkan + hapus permanen. Kerangka mengikuti GroupsPage - Card + Table +
 * Pagination, TableSkeleton saat memuat, ErrorState saat gagal, EmptyState
 * saat kosong, Modal konfirmasi hapus, useToast untuk umpan balik.
 *
 * Menu ini ADMIN-ONLY. Petugas gate tidak pernah melihatnya di sidebar
 * (SCANNER_ALLOWED_PATHS tidak memuatnya) dan tetap ditolak 403 oleh
 * RequireFullAdmin kalau memaksa membuka URL-nya - penyaringan menu murni
 * kosmetik.
 */
export default function WishesPage() {
  const [wishes, setWishes] = useState<Wish[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const toast = useToast()

  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Wish | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    listWishes(page)
      .then((res) => {
        if (cancelled) return
        setWishes(res.data)
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

  async function handleToggleHidden(wish: Wish) {
    setTogglingId(wish.id)
    try {
      await setWishHidden(wish.id, !wish.isHidden)
      toast.success(wish.isHidden ? 'Ucapan ditampilkan kembali.' : 'Ucapan disembunyikan.')
      setReloadToken((t) => t + 1)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal mengubah status ucapan.'))
    } finally {
      setTogglingId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteWish(deleteTarget.id)
      toast.success('Ucapan dihapus.')
      setDeleteTarget(null)
      setReloadToken((t) => t + 1)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menghapus ucapan.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ucapan"
        description="Ucapan yang dikirim tamu lewat undangan — sembunyikan yang tidak pantas atau hapus permanen."
      />

      <Card className="shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-end">
          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Total <span className="font-semibold text-slate-800 font-mono">{total}</span> ucapan
          </div>
        </div>

        {loading && <TableSkeleton rows={4} cols={5} />}

        {!loading && error && <ErrorState message="Gagal memuat data ucapan." onRetry={() => setReloadToken((t) => t + 1)} />}

        {!loading && !error && wishes.length === 0 && (
          <EmptyState
            title="Belum ada ucapan"
            description="Ucapan akan muncul di sini begitu ada tamu yang mengirim lewat undangan."
          />
        )}

        {!loading && !error && wishes.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Tamu</Th>
                  <Th>Ucapan</Th>
                  <Th>Waktu</Th>
                  <Th>Status</Th>
                  <Th className="text-right pr-6">Aksi</Th>
                </Tr>
              </Thead>
              <Tbody>
                {wishes.map((wish) => (
                  <Tr key={wish.id}>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold text-slate-900">{wish.guestName}</span>
                        <Badge tone={wish.guestSide === 'groom' ? 'blue' : 'violet'} label={SIDE_LABEL[wish.guestSide]} />
                      </div>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-700">{wish.message}</span>
                    </Td>
                    <Td>
                      <span className="text-xs text-slate-500 whitespace-nowrap">{formatRelativeTime(wish.createdAt)}</span>
                    </Td>
                    <Td>
                      <Badge tone={wish.isHidden ? 'slate' : 'teal'} label={wish.isHidden ? 'Disembunyikan' : 'Tampil'} />
                    </Td>
                    <Td className="text-right pr-6">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={togglingId === wish.id}
                          onClick={() => handleToggleHidden(wish)}
                          className="h-8 px-2 text-slate-600 hover:text-blue-600 whitespace-nowrap"
                        >
                          {wish.isHidden ? 'Tampilkan' : 'Sembunyikan'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(wish)}
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
              <Pagination page={page} pageSize={WISH_PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>

      {/* Modal Hapus Ucapan */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus ucapan"
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
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-700 leading-relaxed">
            Hapus ucapan dari <span className="font-semibold text-slate-900">{deleteTarget?.guestName}</span> secara
            permanen? Tindakan ini tidak bisa dibatalkan.
          </p>
          <p className="text-sm text-slate-500 leading-relaxed">
            Tamu tersebut boleh mengisi ulang sesudahnya - berbeda dengan
            menghapus tamu, yang ikut menghapus ucapannya.
          </p>
        </div>
      </Modal>
    </div>
  )
}
