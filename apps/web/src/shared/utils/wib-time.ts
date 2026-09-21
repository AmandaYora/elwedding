/**
 * Formatter jam/tanggal yang DIPATOK ke WIB (docs/plan/timezone-wib/PLAN.md
 * T5/D4/D11).
 *
 * Kenapa ada: tiga formatter di ScanPage & ArrivalsPage memanggil
 * Intl.DateTimeFormat TANPA opsi `timeZone`, sehingga hasilnya mengikuti zona
 * PERANGKAT yang membuka halaman. Layar Scan & Tamu Masuk dipakai petugas gate
 * di hari-H, sering dari perangkat yang bukan milik admin - jam check-in yang
 * bergeser di sana tidak akan ketahuan sampai terlambat.
 *
 * Dijadikan satu helper, bukan tiga tambalan di tempat: ketiganya duplikat,
 * dan menambal masing-masing memperbaiki tiga salinan sambil membiarkan
 * salinan keempat lahir dengan cacat yang sama.
 *
 * Preseden: SaveTheDate.tsx sudah menyematkan timeZone: 'Asia/Jakarta' secara
 * eksplisit untuk stempel Google Calendar.
 *
 * CATATAN: ini melengkapi, bukan menggantikan, formatRelativeTime di
 * relative-time.ts. Yang itu membandingkan dua instant sehingga memang kebal
 * zona perangkat; yang di sini merender JAM DINDING, dan justru itulah yang
 * butuh dipatok.
 */

const WIB = 'Asia/Jakarta'

// Dikonstruksi SEKALI di tingkat modul, bukan di dalam fungsi. Intl.DateTimeFormat
// termasuk konstruktor yang mahal, dan formatter jam dipanggil sekali per baris
// di daftar Tamu Masuk.
const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: WIB,
  hour: '2-digit',
  minute: '2-digit',
})

const dateTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: WIB,
  dateStyle: 'full',
  timeStyle: 'short',
})

/** Mengembalikan `null` untuk masukan kosong maupun tanggal tak valid, supaya
 * kedua penjagaan itu tidak ditulis ulang di dua fungsi di bawah. */
function parseIso(iso: string): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Jam:menit dalam WIB, mis. "19.30".
 *
 * `fallback` ada karena pemanggilnya memang berbeda - ScanPage memakai string
 * kosong, ArrivalsPage memakai "-" supaya kolom tabelnya tidak terlihat rusak.
 * Itu satu-satunya perbedaan nyata di antara formatter lama yang digantikan.
 */
export function formatWibTime(iso: string, fallback = ''): string {
  const d = parseIso(iso)
  return d ? timeFormatter.format(d) : fallback
}

/** Tanggal lengkap + jam dalam WIB, dipakai sebagai `title` saat jam saja
 * tidak cukup untuk memeriksa. */
export function formatWibDateTime(iso: string, fallback = ''): string {
  const d = parseIso(iso)
  return d ? dateTimeFormatter.format(d) : fallback
}
