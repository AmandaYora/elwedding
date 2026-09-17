import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import {
  type CheckinResult,
  type CheckinSearchItem,
  checkinById,
  scanCode,
  searchGuests,
} from '@/modules/admin/scan/services/checkin.service'
import {
  SIDE_LABEL,
  SOUVENIR_TYPE_LABEL,
  STATUS_LABEL,
  type Side,
  type SouvenirType,
  type RsvpStatus,
} from '@/shared/constants/guests'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { Button, Card, Input } from '@/shared/components/ui'

/** Dua mode input eksklusif di halaman ini (docs/plan/scan-mode-scanner/PLAN.md).
 * 'scanner' = alat scanner USB HID keyboard-wedge (default, K2); 'camera' =
 * kamera perangkat via @zxing/browser seperti sebelumnya. */
type ScanMode = 'scanner' | 'camera'

// CameraView di-lazy supaya @zxing/browser (~465 kB) hanya diunduh saat toggle
// berada di mode Kamera (D2) - mayoritas pemakaian (mode Scanner) tidak
// membayarnya.
const CameraView = lazy(() => import('./CameraView'))

/**
 * Menu Scan di gate (docs/plan/scan-checkin-gate/PLAN.md T16,
 * docs/plan/scan-mode-scanner/PLAN.md).
 *
 * Pembacanya adalah petugas yang berdiri di pintu sambil memegang telepon,
 * dengan antrean di belakang tamu. Karena itu hasil pindaian - bukan sumber
 * inputnya - yang menjadi TOKOH UTAMA halaman ini: kartu hasil dibuat besar,
 * berpita warna, dan terbaca dari jarak lengan, apa pun modenya.
 *
 * Dua mode input eksklusif dipilih lewat toggle: scanner device (USB HID
 * keyboard-wedge, default) atau kamera. Dalam satu waktu hanya satu yang
 * aktif - mode Scanner meng-unmount kamera total (hemat baterai), mode Kamera
 * menyalakan stream seperti sebelumnya.
 *
 * Jenis souvenir diberi penekanan tepat di bawah nama: itu satu-satunya data
 * di layar ini yang mengubah apa yang dilakukan TANGAN petugas.
 *
 * Mode Kamera BUTUH HTTPS: getUserMedia hanya tersedia di secure context
 * (§2.6). Produksi sudah HTTPS. Menguji lewat IP LAN ber-http:// TIDAK akan
 * bisa membuka kamera - pakai localhost (dianggap secure) atau terowongan
 * HTTPS. Mode Scanner tidak butuh HTTPS/izin kamera.
 */

/** Empat keadaan yang WAJIB terlihat berbeda (T16/kriteria verifikasi #11). */
type Outcome =
  | { kind: 'idle' }
  | { kind: 'admitted'; result: CheckinResult }
  | { kind: 'already'; result: CheckinResult }
  | { kind: 'rejected'; message: string }
  | { kind: 'unsent'; retry: () => void }

/** Jeda peredam pindaian berulang. Kamera mengirim frame terus-menerus, jadi
 * satu QR yang tertahan di depan lensa akan menembak API puluhan kali per
 * detik tanpa ini - sumber beban terbesar di seluruh rancangan ini. */
const REPEAT_SCAN_QUIET_MS = 4000
const SEARCH_DEBOUNCE_MS = 300

function formatArrivalTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(d)
}

function sideLabel(side: string): string {
  return SIDE_LABEL[side as Side] ?? side
}

function souvenirLabel(type: string): string {
  return SOUVENIR_TYPE_LABEL[type as SouvenirType] ?? type
}

function statusLabel(status: string): string {
  return STATUS_LABEL[status as RsvpStatus] ?? status
}

/** Pesan diambil dari backend bila ada - dialah yang membedakan "QR tidak
 * dikenali" (400) dari "Tamu tidak ditemukan" (404). */
function rejectionMessage(err: unknown): string | null {
  const res = (err as { response?: { status?: number; data?: { message?: string } } })?.response
  if (!res || typeof res.status !== 'number') return null // tanpa respons = tidak terkirim
  if (res.status === 401 || res.status === 403) {
    return 'Sesi Anda tidak berlaku untuk memindai. Masuk ulang dengan akun petugas.'
  }
  return res.data?.message || 'QR tidak dikenali.'
}

export default function ScanPage() {
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' })
  // Default = scanner device (K2+D4): selalu mulai di sini setiap halaman
  // dibuka, tanpa mengingat pilihan terakhir (tanpa localStorage).
  const [mode, setMode] = useState<ScanMode>('scanner')
  const [busy, setBusy] = useState(false)
  const [scannerValue, setScannerValue] = useState('')
  const scannerRef = useRef<HTMLInputElement>(null)

  /** Kode terakhir + waktunya, untuk meredam pindaian berulang. */
  const lastScanRef = useRef<{ code: string; at: number } | null>(null)
  /** Menahan pindaian baru selama satu permintaan masih berjalan. */
  const inFlightRef = useRef(false)

  /** Mengembalikan true HANYA kalau server benar-benar mencatat check-in -
   * pemanggil memakainya untuk memutuskan boleh-tidaknya mengubah tampilan
   * daftar (lihat handleManualCheckin). */
  const submitCheckin = useCallback(async (run: () => Promise<CheckinResult>, retry: () => void): Promise<boolean> => {
    inFlightRef.current = true
    setBusy(true)
    try {
      const result = await run()
      setOutcome({ kind: result.alreadyCheckedIn ? 'already' : 'admitted', result })
      return true
    } catch (err) {
      const message = rejectionMessage(err)
      // Tanpa respons dari server = permintaan TIDAK TERKIRIM. Ini wajib
      // dibedakan dari penolakan: karena mode online-only (K4), gangguan
      // sinyal sesaat adalah kegagalan yang paling mungkin terjadi di gate,
      // dan petugas harus tahu tamunya BELUM tercatat lalu mengulang -
      // bukan menyangka QR tamu itu palsu dan menahannya di pintu.
      setOutcome(message === null ? { kind: 'unsent', retry } : { kind: 'rejected', message })
      return false
    } finally {
      inFlightRef.current = false
      setBusy(false)
    }
  }, [])

  const handleScannedCode = useCallback(
    (code: string) => {
      const now = Date.now()
      const last = lastScanRef.current
      if (inFlightRef.current) return
      if (last && last.code === code && now - last.at < REPEAT_SCAN_QUIET_MS) return
      lastScanRef.current = { code, at: now }
      // `retry` menunjuk dirinya sendiri (bisa, karena deklarasi fungsi
      // di-hoist): percobaan kedua yang juga gagal tetap menyisakan tombol
      // "Coba lagi" yang berfungsi. Sebelumnya percobaan kedua dioper
      // callback kosong, sehingga tombolnya diam saat ditekan - persis di
      // saat sinyal sedang buruk dan petugas paling butuh mengulang.
      function retry() {
        lastScanRef.current = null
        void submitCheckin(() => scanCode(code), retry)
      }
      void submitCheckin(() => scanCode(code), retry)
    },
    [submitCheckin],
  )

  // Mode scanner: jaga fokus di kolom tangkap setiap masuk mode ini, supaya
  // ketikan scanner HID langsung tertampung tanpa klik dulu. Sengaja TIDAK
  // memakai listener blur global yang memaksa fokus kembali - itu akan
  // merampas fokus dari kolom pencarian "Tamu tanpa QR" dan tombol-tombolnya.
  // Klik di mana pun pada kartu scanner juga mengembalikan fokus (lihat onClick).
  useEffect(() => {
    if (mode === 'scanner') scannerRef.current?.focus()
  }, [mode])

  /** Mengirim isi kolom scanner HID lewat jalur yang SAMA dengan kamera
   * (handleScannedCode: peredam + inFlight + 4 keadaan + retry). Kolom
   * langsung dikosongkan karena kode sudah disalin ke variabel - peredam
   * memakai salinan itu, bukan state input. */
  function handleScannerSubmit() {
    const code = scannerValue.trim()
    if (!code) return
    handleScannedCode(code)
    setScannerValue('')
    scannerRef.current?.focus()
  }

  // --- Panel pencarian nama, untuk tamu tanpa QR (K3) ---
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [results, setResults] = useState<CheckinSearchItem[]>([])
  /** Kata kunci yang hasilnya sedang dipegang `results`. Menyimpan ini -
   * bukan bendera `searching` terpisah - membuat "sedang mencari" bisa
   * DITURUNKAN saat render, sehingga efek di bawah tidak perlu memanggil
   * setState secara sinkron (yang memicu cascading render). */
  const [loadedQuery, setLoadedQuery] = useState('')
  const [searchFailed, setSearchFailed] = useState(false)

  // Debounce ketikan, pola yang sudah dipakai GuestsPage - tanpa ini
  // mengetik "budi" mengirim empat permintaan berturut-turut.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [search])

  // Kotak yang dikosongkan TIDAK memicu setState - hasil lama cukup
  // disembunyikan saat render lewat `visibleResults` di bawah, pola yang
  // sama dipakai RsvpConfirmation (F15) untuk menghindari cascading render.
  useEffect(() => {
    if (!debouncedSearch) return
    let cancelled = false
    searchGuests(debouncedSearch)
      .then((items) => {
        if (cancelled) return
        setResults(items)
        setSearchFailed(false)
        setLoadedQuery(debouncedSearch)
      })
      .catch(() => {
        if (cancelled) return
        setResults([])
        setSearchFailed(true)
        setLoadedQuery(debouncedSearch)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch])

  const settled = !!debouncedSearch && loadedQuery === debouncedSearch
  const searching = !!debouncedSearch && !settled
  /** Hasil hanya ditampilkan bila memang milik kata kunci yang sedang aktif -
   * kotak yang dikosongkan atau ketikan yang berubah tidak sempat
   * memperlihatkan hasil lama. */
  const visibleResults = settled ? results : []

  function handleManualCheckin(item: CheckinSearchItem) {
    const run = () => checkinById(item.id)

    // Baris ditandai HANYA setelah server benar-benar mencatatnya. Dulu
    // penandaan dilakukan tanpa menunggu hasil, sehingga permintaan yang
    // tidak terkirim tetap mengubah baris jadi "Sudah check-in" dan
    // menghilangkan tombolnya - daftar di layar petugas berbohong tentang
    // tamu yang sebenarnya belum tercatat.
    const markRowIfSaved = (saved: boolean) => {
      if (!saved) return
      setResults((prev) => prev.map((r) => (r.id === item.id ? { ...r, checkedIn: true } : r)))
    }

    function retry() {
      void submitCheckin(run, retry).then(markRowIfSaved)
    }
    void submitCheckin(run, retry).then(markRowIfSaved)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Scan"
        description="Pindai QR tamu di pintu masuk, atau cari namanya bila QR-nya tidak ada."
      />

      {/* Toggle mode input eksklusif (docs/plan/scan-mode-scanner/PLAN.md D1):
          segmented control dua tombol, bukan Switch - Switch semantiknya status
          on/off, sedangkan ini pilihan dua mode. */}
      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Mode pemindai"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1"
        >
          {(['scanner', 'camera'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={[
                'rounded-lg px-4 py-2 text-sm transition-all duration-150 cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy-500)]/30',
                mode === m
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-500 hover:text-slate-700 font-medium',
              ].join(' ')}
            >
              {m === 'scanner' ? 'Scanner' : 'Kamera'}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {mode === 'scanner'
            ? 'Scanner device aktif — kamera mati. Tembak QR dengan alat scanner.'
            : 'Kamera aktif — arahkan lensa ke QR tamu.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {mode === 'camera' ? (
          <Suspense
            fallback={
              <div className="lg:col-span-2 p-6 text-sm text-slate-500">Memuat kamera...</div>
            }
          >
            <CameraView onScanned={handleScannedCode} busy={busy} />
          </Suspense>
        ) : (
          <Card className="lg:col-span-2 shadow-sm">
            <div
              className="p-4 sm:p-5 flex flex-col gap-3"
              onClick={() => scannerRef.current?.focus()}
            >
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Scanner device</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tembak QR tamu dengan alat scanner. Pastikan kursor aktif di kolom ini —
                  alat harus dikonfigurasi suffix Enter.
                </p>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    ref={scannerRef}
                    label="Kode QR"
                    value={scannerValue}
                    onChange={(e) => setScannerValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleScannerSubmit()
                      }
                    }}
                    placeholder="Hasil tembakan scanner muncul di sini"
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>
                <Button onClick={handleScannerSubmit} disabled={busy} className="shrink-0">
                  Catat
                </Button>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full bg-emerald-500 motion-safe:animate-pulse"
                aria-hidden="true"
              />
              <p className="text-xs text-slate-500">
                {busy ? 'Memproses pindaian...' : 'Siap menerima pindaian'}
              </p>
            </div>
          </Card>
        )}

        {/* Kartu hasil - TOKOH UTAMA halaman ini. */}
        <div className="lg:col-span-3">
          <OutcomePanel outcome={outcome} mode={mode} />
        </div>
      </div>

      {/* Pencarian nama untuk tamu yang lupa atau kehilangan QR-nya (K3). */}
      <Card className="shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-semibold text-slate-800">Tamu tanpa QR</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cari nama tamu, lalu catat kehadirannya langsung dari daftar.
          </p>
        </div>

        <div className="p-4 sm:p-5 flex flex-col gap-4">
          <Input
            label="Nama tamu"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ketik nama tamu"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            }
          />

          {searching && <p className="text-xs text-slate-500">Mencari...</p>}

          {settled && searchFailed && (
            <p className="text-sm text-slate-600">
              Pencarian tidak terkirim. Periksa koneksi, lalu ketik ulang namanya.
            </p>
          )}

          {settled && !searchFailed && visibleResults.length === 0 && (
            <p className="text-sm text-slate-600">
              Tidak ada tamu bernama &ldquo;{debouncedSearch}&rdquo;.
            </p>
          )}

          {visibleResults.length > 0 && (
            <ul className="flex flex-col divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {visibleResults.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {sideLabel(item.side)} &middot; {statusLabel(item.rsvpStatus)} &middot; {item.attendingCount} orang
                    </p>
                  </div>
                  {item.checkedIn ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 whitespace-nowrap">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Sudah check-in
                    </span>
                  ) : (
                    <Button size="sm" onClick={() => handleManualCheckin(item)} disabled={busy}>
                      Catat hadir
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}

/**
 * Empat keadaan, empat perlakuan yang benar-benar berbeda - bukan sekadar
 * warna teks yang berganti. Perhatikan bahwa 'unsent' SENGAJA memakai warna
 * netral, bukan merah: merah membaca sebagai "tamu ini palsu", padahal yang
 * terjadi hanyalah sinyal putus.
 */
function OutcomePanel({ outcome, mode }: { outcome: Outcome; mode: ScanMode }) {
  if (outcome.kind === 'idle') {
    return (
      <div className="h-full min-h-56 rounded-2xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-2 p-8 text-center">
        <svg className="w-9 h-9 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2m10-16h2a1 1 0 011 1v2m-3 12h2a1 1 0 001-1v-2M7 12h10" />
        </svg>
        <p className="text-sm font-semibold text-slate-700">
          {mode === 'scanner' ? 'Tembak QR tamu dengan scanner' : 'Arahkan kamera ke QR tamu'}
        </p>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
          Hasilnya muncul di sini. Untuk tamu yang QR-nya tidak ada, cari namanya di bawah.
        </p>
      </div>
    )
  }

  if (outcome.kind === 'rejected') {
    return (
      <StatusCard
        tone="rose"
        eyebrow="Tidak dikenali"
        heading="Jangan dicatat"
        body={outcome.message}
        hint="Minta tamu menunjukkan undangan lain, atau cari namanya di daftar di bawah."
      />
    )
  }

  if (outcome.kind === 'unsent') {
    return (
      <StatusCard
        tone="slate"
        eyebrow="Tidak terkirim"
        heading="Tamu belum tercatat"
        body="Permintaan tidak sampai ke server. QR tamu ini tidak bermasalah - koneksinya yang putus."
        hint="Periksa sinyal, lalu coba lagi."
        action={
          <Button size="sm" variant="secondary" onClick={outcome.retry}>
            Coba lagi
          </Button>
        }
      />
    )
  }

  const { result } = outcome
  const already = outcome.kind === 'already'
  const arrival = formatArrivalTime(result.checkedInAt)
  const vip = result.souvenirType === 'vip'

  return (
    <div
      className={[
        'rounded-2xl border overflow-hidden bg-white shadow-sm',
        already ? 'border-amber-300' : 'border-emerald-300',
      ].join(' ')}
    >
      {/* Pita putusan: satu-satunya elemen di halaman ini yang boleh berteriak. */}
      <div
        className={[
          'px-5 py-3 flex items-center gap-2.5 text-white',
          already ? 'bg-amber-600' : 'bg-emerald-600',
        ].join(' ')}
      >
        {already ? (
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        )}
        <p className="text-sm font-bold tracking-wide uppercase">
          {already ? `Sudah check-in ${arrival ? `pukul ${arrival}` : 'sebelumnya'}` : 'Silakan masuk'}
        </p>
      </div>

      <div className="p-5 sm:p-6 flex flex-col gap-5">
        {/* Nama pada ukuran display - halaman ini dibaca dari jarak lengan. */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
            {result.name}
          </h2>
          {/* Group berdampingan dengan pihak & status RSVP, SENGAJA bukan
              kartu besar sejajar "Jumlah orang"/"Souvenir" (T17): kedua kartu
              itu dipilih karena mengubah tindakan TANGAN petugas, sedangkan
              group adalah konteks. groupName kosong (tamu lama, atau
              pembacaan group gagal - D9) tampil sebagai em dash, bukan
              merusak kartu. */}
          <p className="text-sm text-slate-500 mt-1">
            {sideLabel(result.side)} &middot; Group {result.groupName || '—'} &middot; RSVP{' '}
            {statusLabel(result.rsvpStatus).toLowerCase()}
          </p>
        </div>

        {/* Dua angka yang menentukan tindakan petugas: berapa orang masuk,
            dan souvenir apa yang diserahkan. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Jumlah orang</p>
            <p className="text-3xl font-bold text-slate-900 tabular-nums leading-tight mt-0.5">
              {result.attendingCount}
            </p>
          </div>
          <div
            className={[
              'rounded-xl border px-4 py-3',
              vip ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50',
            ].join(' ')}
          >
            <p
              className={[
                'text-[11px] font-semibold uppercase tracking-wider',
                vip ? 'text-violet-600' : 'text-slate-500',
              ].join(' ')}
            >
              Souvenir
            </p>
            <p
              className={[
                'text-lg font-bold leading-tight mt-1',
                vip ? 'text-violet-800' : 'text-slate-900',
              ].join(' ')}
            >
              {souvenirLabel(result.souvenirType)}
            </p>
          </div>
        </div>

        {already && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 leading-relaxed">
            Tamu ini sudah tercatat masuk{arrival ? ` pukul ${arrival}` : ''}. Kehadirannya tidak dihitung dua kali.
          </p>
        )}
      </div>
    </div>
  )
}

interface StatusCardProps {
  tone: 'rose' | 'slate'
  eyebrow: string
  heading: string
  body: string
  hint: string
  action?: React.ReactNode
}

function StatusCard({ tone, eyebrow, heading, body, hint, action }: StatusCardProps) {
  const rose = tone === 'rose'
  return (
    <div
      className={[
        'rounded-2xl border overflow-hidden bg-white shadow-sm',
        rose ? 'border-rose-300' : 'border-slate-300',
      ].join(' ')}
    >
      <div
        className={[
          'px-5 py-3 flex items-center gap-2.5 text-white',
          rose ? 'bg-rose-600' : 'bg-slate-600',
        ].join(' ')}
      >
        {rose ? (
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636a9 9 0 010 12.728m-12.728 0a9 9 0 010-12.728m9.9 9.9a5 5 0 010-7.072m-7.072 0a5 5 0 010 7.072M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        )}
        <p className="text-sm font-bold tracking-wide uppercase">{eyebrow}</p>
      </div>
      <div className="p-5 sm:p-6 flex flex-col gap-3">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{heading}</h2>
        <p className="text-sm text-slate-700 leading-relaxed">{body}</p>
        <p className="text-sm text-slate-500 leading-relaxed">{hint}</p>
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  )
}
