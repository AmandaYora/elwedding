import { useCallback, useEffect, useState } from 'react'
import {
  type ArrivalItem,
  type CheckinSummary,
  getCheckinSummary,
  listArrivals,
} from '@/modules/admin/scan/services/checkin.service'
import {
  SIDE_LABEL,
  SOUVENIR_TYPE_LABEL,
  type Side,
  type SouvenirType,
} from '@/shared/constants/guests'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { Button, Card, Table, Thead, Tbody, Tr, Th, Td, Pagination } from '@/shared/components/ui'
import { EmptyState } from '@/shared/components/feedback/EmptyState'
import { TableSkeleton } from '@/shared/components/feedback/Skeleton'
import { ErrorState } from '@/shared/components/feedback/ErrorState'

/**
 * Menu "Tamu Masuk" - daftar tamu yang sudah tiba di gate, plus angka
 * ringkasannya. Bisa dibuka petugas gate MAUPUN admin penuh.
 *
 * Bacaannya dua lapis, sesuai dua pembaca yang berbeda:
 * - Sekilas (koordinator/keluarga): empat kartu + satu bilah progres yang
 *   memecah kedatangan per pihak mempelai. Keseimbangan dua pihak itu hal
 *   yang benar-benar ditanyakan di pernikahan, dan tidak terbaca dari angka
 *   telanjang - karena itu ia divisualkan, bukan sekadar dicetak.
 * - Rinci (petugas): tabel nama/pihak/souvenir/jam masuk, terbaru di atas.
 *
 * PAGE_SIZE 20 mengikuti paginasi standar admin; daftar ini tumbuh sepanjang
 * acara sampai sebesar daftar tamu, jadi ia memang berpaginasi (beda dari
 * pencarian di menu Scan yang dibatasi keras 20 tanpa meta).
 */
const PAGE_SIZE = 20

function sideLabel(side: string): string {
  return SIDE_LABEL[side as Side] ?? side
}

function souvenirLabel(type: string): string {
  return SOUVENIR_TYPE_LABEL[type as SouvenirType] ?? type
}

/** Jam masuk saja - acaranya satu hari. Tanggal lengkapnya tetap tersedia
 * lewat atribut `title` kalau ada yang perlu memeriksa. */
function formatTime(iso: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function formatFull(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'short' }).format(d)
}

export default function ArrivalsPage() {
  const [summary, setSummary] = useState<CheckinSummary | null>(null)
  const [items, setItems] = useState<ArrivalItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    // Dua permintaan PARALEL, bukan berurutan: ringkasan tidak bergantung
    // pada daftar, jadi menunggunya bergantian hanya menggandakan waktu
    // tunggu di perangkat gate yang sinyalnya belum tentu kencang.
    Promise.all([listArrivals(page, PAGE_SIZE), getCheckinSummary()])
      .then(([arrivals, sum]) => {
        if (cancelled) return
        setItems(arrivals.data)
        setTotal(arrivals.meta.total)
        setSummary(sum)
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tamu Masuk"
        description="Tamu yang sudah tercatat hadir di pintu masuk, terbaru di atas."
        action={
          <Button variant="secondary" size="md" onClick={reload} disabled={loading}>
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Muat ulang
          </Button>
        }
      />

      <SummaryPanel summary={summary} loading={loading && !summary} />

      <Card className="shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-end">
          <div className="text-xs text-slate-500 font-medium whitespace-nowrap">
            Total <span className="font-semibold text-slate-800 font-mono">{total}</span> tamu masuk
          </div>
        </div>

        {loading && <TableSkeleton rows={5} cols={4} />}

        {!loading && error && (
          <ErrorState message="Gagal memuat daftar tamu masuk." onRetry={reload} />
        )}

        {!loading && !error && items.length === 0 && (
          <EmptyState
            title="Belum ada tamu yang masuk"
            description="Begitu QR tamu pertama dipindai di menu Scan, namanya muncul di sini."
          />
        )}

        {!loading && !error && items.length > 0 && (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Nama</Th>
                  <Th>Pihak</Th>
                  <Th>Souvenir</Th>
                  <Th className="text-right pr-6">Jam masuk</Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map((item) => {
                  const initial = item.name.trim().charAt(0).toUpperCase() || '?'
                  const vip = item.souvenirType === 'vip'
                  return (
                    <Tr key={item.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                            <p className="text-[11px] text-slate-500">{item.attendingCount} orang</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <span className="text-xs text-slate-600 whitespace-nowrap">{sideLabel(item.side)}</span>
                      </Td>
                      <Td>
                        <span
                          className={[
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border whitespace-nowrap',
                            vip
                              ? 'text-violet-700 bg-violet-50 border-violet-200'
                              : 'text-slate-700 bg-slate-100 border-slate-200',
                          ].join(' ')}
                        >
                          {souvenirLabel(item.souvenirType)}
                        </span>
                      </Td>
                      <Td className="text-right pr-6">
                        <span
                          className="font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap"
                          title={formatFull(item.checkedInAt)}
                        >
                          {formatTime(item.checkedInAt)}
                        </span>
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
    </div>
  )
}

/** Empat kartu + bilah progres. Bilahnya memecah kedatangan per pihak
 * mempelai di atas total tamu - satu-satunya tempat di halaman ini yang
 * menunjukkan KESEIMBANGAN dua keluarga, bukan sekadar jumlah. */
function SummaryPanel({ summary, loading }: { summary: CheckinSummary | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white animate-pulse" />
        ))}
      </div>
    )
  }
  if (!summary) return null

  const { arrivedGroom, arrivedBride, arrivedTotal, arrivedPax, totalGuests } = summary
  // Pembagi 0 saat daftar tamu masih kosong - jangan sampai jadi NaN%.
  const pct = (n: number) => (totalGuests > 0 ? (n / totalGuests) * 100 : 0)
  const arrivedPct = Math.round(pct(arrivedTotal))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Pihak Pria"
          value={arrivedGroom}
          hint="tamu masuk"
          dotClass="bg-blue-500"
          valueClass="text-blue-700"
        />
        <StatCard
          label="Pihak Wanita"
          value={arrivedBride}
          hint="tamu masuk"
          dotClass="bg-rose-500"
          valueClass="text-rose-700"
        />
        <StatCard
          label="Total Masuk"
          value={arrivedTotal}
          hint={`± ${arrivedPax} orang`}
          dotClass="bg-emerald-500"
          valueClass="text-emerald-700"
          emphasis
        />
        <StatCard
          label="Total Tamu"
          value={totalGuests}
          hint="seluruh undangan"
          dotClass="bg-slate-400"
          valueClass="text-slate-900"
        />
      </div>

      <Card className="shadow-sm">
        <div className="p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Progres kedatangan
            </p>
            <p className="text-sm font-semibold text-slate-900 tabular-nums">
              {arrivedTotal} <span className="font-normal text-slate-500">dari {totalGuests} tamu</span>
              <span className="ml-2 text-emerald-700">{arrivedPct}%</span>
            </p>
          </div>

          <div
            className="flex h-3 w-full overflow-hidden rounded-full bg-slate-200"
            role="img"
            aria-label={`${arrivedGroom} tamu pihak pria dan ${arrivedBride} tamu pihak wanita sudah masuk, dari total ${totalGuests} tamu`}
          >
            <div className="bg-blue-500 transition-[width] duration-300" style={{ width: `${pct(arrivedGroom)}%` }} />
            <div className="bg-rose-500 transition-[width] duration-300" style={{ width: `${pct(arrivedBride)}%` }} />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-600">
            <LegendItem dotClass="bg-blue-500" label="Pihak pria" value={arrivedGroom} />
            <LegendItem dotClass="bg-rose-500" label="Pihak wanita" value={arrivedBride} />
            <LegendItem dotClass="bg-slate-200" label="Belum masuk" value={Math.max(0, totalGuests - arrivedTotal)} />
          </div>

          {/* Jujur soal satuan: pax berasal dari janji RSVP, bukan hitung
              kepala di pintu - sistem ini memang tidak merekamnya. */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Angka orang (± {arrivedPax}) dihitung dari jumlah yang dikonfirmasi tamu saat RSVP, bukan hitung kepala di pintu.
          </p>
        </div>
      </Card>
    </div>
  )
}

interface StatCardProps {
  label: string
  value: number
  hint: string
  dotClass: string
  valueClass: string
  emphasis?: boolean
}

function StatCard({ label, value, hint, dotClass, valueClass, emphasis }: StatCardProps) {
  return (
    <div
      className={[
        'rounded-xl border bg-white px-4 py-3.5 shadow-xs',
        emphasis ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">{label}</p>
      </div>
      <p className={`mt-1 text-3xl font-bold tabular-nums leading-tight ${valueClass}`}>{value}</p>
      <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>
    </div>
  )
}

function LegendItem({ dotClass, label, value }: { dotClass: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
      {label} <span className="font-semibold text-slate-900 tabular-nums">{value}</span>
    </span>
  )
}
