import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getGuestSummary, type GuestSummary } from '@/modules/admin/guests/services/guests.service'
import { ROUTE_PATHS } from '@/app/routes/route-paths'
import { STATUS_LABEL } from '@/shared/constants/guests'
import { formatRelativeTime } from '@/shared/utils/relative-time'
import { Card, CardBody, Button, Badge } from '@/shared/components/ui'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { Skeleton } from '@/shared/components/feedback/Skeleton'

interface Segment {
  key: string
  label: string
  value: number
  color: string
}

// Warna dipetakan ke token semantik yang sudah ada di theme.css, bukan hex
// mentah - dipakai bar proporsi kehadiran di bawah KPI.
function buildSegments(summary: GuestSummary): Segment[] {
  return [
    { key: 'attending', label: 'Hadir', value: summary.attending, color: 'var(--status-attending-text)' },
    { key: 'not_attending', label: 'Tidak hadir', value: summary.notAttending, color: 'var(--status-not-attending-text)' },
    { key: 'remind_later', label: 'Perlu diingatkan', value: summary.remindLater, color: 'var(--status-remind-later-text)' },
    { key: 'pending', label: 'Belum jawab', value: summary.pending, color: 'var(--status-pending-text)' },
  ]
}

interface BreakdownRow {
  label: string
  value: number
  color: string
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<GuestSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    getGuestSummary()
      .then((data) => {
        if (cancelled) return
        setSummary(data)
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
  }, [reloadToken])

  const segments = summary ? buildSegments(summary) : []
  // "Sudah konfirmasi" = tamu yang sudah merespons RSVP dalam bentuk apa
  // pun (attending/not_attending/remind_later) - lawan dari "Belum jawab"
  // (pending). Keputusan analis saat implementasi: definisi paling
  // langsung dari "belum vs sudah merespons".
  const confirmedCount = summary ? summary.total - summary.pending : 0

  const sideRows: BreakdownRow[] = summary
    ? [
        { label: 'Mempelai Pria', value: summary.sideGroom, color: 'var(--navy-500)' },
        { label: 'Mempelai Wanita', value: summary.sideBride, color: '#e11d48' },
      ]
    : []
  const genderRows: BreakdownRow[] = summary
    ? [
        { label: 'Pria', value: summary.genderMale, color: '#0ea5e9' },
        { label: 'Wanita', value: summary.genderFemale, color: '#ec4899' },
      ]
    : []
  const invitationRows: BreakdownRow[] = summary
    ? [
        { label: 'Online', value: summary.invitationOnline, color: 'var(--navy-500)' },
        { label: 'Fisik', value: summary.invitationPhysical, color: 'var(--navy-800)' },
      ]
    : []
  const souvenirRows: BreakdownRow[] = summary
    ? [
        { label: 'Reguler', value: summary.souvenirRegular, color: '#94a3b8' },
        { label: 'VIP', value: summary.souvenirVip, color: '#d97706' },
      ]
    : []

  function renderBreakdownCard(title: string, rows: BreakdownRow[], total: number) {
    return (
      <Card className="shadow-sm">
        <CardBody className="p-5">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">{title}</h2>
          <div className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-2 text-slate-600">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: row.color }} aria-hidden="true" />
                  {row.label}
                </span>
                <span className="font-mono font-semibold text-slate-900">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100 mt-3.5">
            {rows.map((row) =>
              row.value > 0 && total > 0 ? (
                <div
                  key={row.label}
                  style={{ width: `${(row.value / total) * 100}%`, background: row.color }}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  title={`${row.label}: ${row.value}`}
                />
              ) : null,
            )}
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Ringkasan"
        description="Gambaran kehadiran tamu & status undangan pernikahan."
        action={
          <Link to={ROUTE_PATHS.guests}>
            <Button size="sm" className="shadow-xs">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Kelola Tamu
            </Button>
          </Link>
        }
      />

      {loading && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardBody className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </CardBody>
              </Card>
            ))}
          </div>
          <Card>
            <CardBody className="flex flex-col gap-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full rounded-full" />
            </CardBody>
          </Card>
        </div>
      )}

      {!loading && error && <ErrorState message="Gagal memuat ringkasan." onRetry={() => setReloadToken((t) => t + 1)} />}

      {!loading && !error && summary && (
        <>
          {/* KPI + Proporsi Kehadiran */}
          <Card className="shadow-sm">
            <CardBody className="p-6">
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  {/* "Total undangan", bukan "Total tamu" (docs/plan/
                      guest-pax-quota/PLAN.md T23): `summary.total` menghitung
                      BARIS, dan satu baris bisa bernilai banyak orang. Label
                      lama inilah sumber kebingungan yang memicu seluruh fitur
                      jatah kursi - angka orang ada di kartu proyeksi di bawah. */}
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total undangan</dt>
                  <dd className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">{summary.total}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sudah konfirmasi</dt>
                  <dd className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">{confirmedCount}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Akan hadir</dt>
                  <dd className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">
                    {summary.attending}
                    <span className="text-sm text-slate-400 font-normal">/{summary.attendingPax}</span>
                  </dd>
                  <p className="text-xs text-slate-400 mt-0.5">undangan / orang</p>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Belum jawab</dt>
                  <dd className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 mt-1.5">{summary.pending}</dd>
                </div>
              </dl>

              <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 p-0.5 shadow-inner mt-5">
                {segments.map((seg) =>
                  seg.value > 0 ? (
                    <div
                      key={seg.key}
                      style={{ width: `${(seg.value / summary.total) * 100}%`, background: seg.color }}
                      className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
                      title={`${seg.label}: ${seg.value}`}
                    />
                  ) : null,
                )}
              </div>
            </CardBody>
          </Card>

          {/* Proyeksi catering (docs/plan/guest-pax-quota/PLAN.md T23/§5).
              Satuannya ORANG, bukan undangan - itu sebabnya ia kartu sendiri
              dan tidak dicampur ke KPI di atas yang menghitung baris.

              TIGA baris, bukan satu angka: yang teratas FAKTA (tamu sudah
              menjawab), yang tengah TEBAKAN (belum menjawab, dipakai
              jatahnya). Digabung jadi satu angka telanjang, admin tidak bisa
              menilai seberapa besar risikonya saat memesan katering. */}
          <Card className="shadow-sm">
            <CardBody className="p-5">
              <div className="flex items-baseline justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold text-slate-900">Proyeksi catering</h2>
                <span className="text-xs text-slate-400">satuan: orang</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[20rem]">
                  <thead>
                    <tr className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <th className="text-left font-semibold pb-2" />
                      <th className="text-right font-semibold pb-2 px-3">Pria</th>
                      <th className="text-right font-semibold pb-2 px-3">Wanita</th>
                      <th className="text-right font-semibold pb-2 pl-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-slate-100">
                      <td className="py-2 text-slate-600">Sudah konfirmasi hadir</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">{summary.confirmedPaxGroom}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900">{summary.confirmedPaxBride}</td>
                      <td className="py-2 pl-3 text-right font-mono tabular-nums font-semibold text-slate-900">{summary.confirmedPaxTotal}</td>
                    </tr>
                    <tr className="border-t border-slate-100">
                      <td className="py-2 text-slate-600">
                        Belum jawab, diperkirakan
                        <span className="block text-xs text-slate-400">dihitung dari jatah kursinya</span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">{summary.expectedPaxGroom}</td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">{summary.expectedPaxBride}</td>
                      <td className="py-2 pl-3 text-right font-mono tabular-nums font-semibold text-slate-500">{summary.expectedPaxTotal}</td>
                    </tr>
                    <tr className="border-t-2 border-slate-300">
                      <td className="pt-2.5 font-semibold text-slate-900">Proyeksi pax</td>
                      <td className="pt-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">{summary.projectedPaxGroom}</td>
                      <td className="pt-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">{summary.projectedPaxBride}</td>
                      <td className="pt-2.5 pl-3 text-right font-mono tabular-nums text-lg font-bold text-slate-900">{summary.projectedPaxTotal}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Baris "tidak dihitung" mencegah tamu hilang diam-diam dari
                  total: kalau angkanya terasa terlalu besar, admin langsung
                  curiga ada yang salah set. Satuannya UNDANGAN, dan itu
                  disebutkan supaya tidak dikira orang. */}
              <p className="text-xs text-slate-400 mt-3.5 pt-3 border-t border-slate-100">
                Tidak dihitung: {summary.excludedNotAttending} undangan tidak hadir ·{' '}
                {summary.excludedNotExpected} tidak diperkirakan hadir
              </p>
            </CardBody>
          </Card>

          {/* Breakdown Pihak & Gender */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderBreakdownCard('Pihak', sideRows, summary.total)}
            {renderBreakdownCard('Gender', genderRows, summary.genderMale + summary.genderFemale)}
          </div>

          {/* Breakdown Logistik - jenis undangan & souvenir (T7: menggantikan
              3 kartu navigasi yang menduplikasi sidebar) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderBreakdownCard('Jenis undangan', invitationRows, summary.total)}
            {renderBreakdownCard('Jenis souvenir', souvenirRows, summary.total)}
          </div>

          {/* Aktivitas RSVP Terbaru - rsvp_responded_at sudah diisi sejak
              awal tapi belum pernah ditampilkan di UI mana pun sebelum ini. */}
          <Card className="shadow-sm">
            <CardBody className="p-5">
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Aktivitas RSVP terbaru</h2>
              {summary.recentResponses.length === 0 ? (
                <p className="text-xs text-slate-400">Belum ada tamu yang merespons RSVP.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-slate-100">
                  {summary.recentResponses.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-slate-800 truncate">{r.name}</span>
                        <Badge status={r.rsvpStatus} label={STATUS_LABEL[r.rsvpStatus]} />
                        {r.rsvpStatus === 'attending' && (
                          <span className="text-xs text-slate-400 font-mono shrink-0">{r.attendingCount} org</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 shrink-0">{formatRelativeTime(r.respondedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}
