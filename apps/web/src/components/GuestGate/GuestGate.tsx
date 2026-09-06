import './guest-gate.css'

interface GuestGateProps {
  /** Nama mempelai untuk menyebut undangan SIAPA yang sedang ditolak.
   * Boleh kosong: kalau konten undangan gagal dimuat, kalimatnya tetap utuh
   * tanpa nama - lihat coupleLabel di bawah. */
  groomName?: string
  brideName?: string
  /** 'denied' = tidak terdaftar. 'unavailable' = permintaannya tidak sampai.
   * Keduanya SENGAJA tidak digabung; lihat GuestAccess di useGuestSession. */
  reason: 'denied' | 'unavailable'
  onRetry?: () => void
}

/**
 * Gerbang undangan: yang dilihat orang saat membuka undangan tanpa tautan
 * pribadinya.
 *
 * Undangan ini bukan halaman publik - setiap tamu punya tautan bertoken
 * sendiri (`/?guest=<token>`), dan token itulah yang menentukan namanya di
 * sampul, status RSVP-nya, serta QR check-in-nya. Tanpa token, tidak ada
 * "tamu" yang bisa ditampilkan sama sekali.
 *
 * NADANYA disengaja: pembaca layar ini bisa jadi tamu sah yang tautannya
 * terpotong saat disalin dari chat, bukan penyusup. Karena itu ia meminta
 * maaf, menjelaskan sebabnya, lalu memberi jalan keluar - bukan menuduh.
 *
 * Dua sebab dibedakan tegas. `unavailable` (jaringan/server) TIDAK PERNAH
 * berbunyi "tidak terdaftar": menuduh tamu undangan sebagai orang asing hanya
 * karena sinyalnya putus adalah kegagalan yang jauh lebih mahal daripada
 * memintanya mencoba lagi.
 */
export default function GuestGate({ groomName, brideName, reason, onRetry }: GuestGateProps) {
  // Urutan mempelai pria dulu, baru wanita - sama dengan Cover, TopCover,
  // Footnote, teks QR WhatsApp, dan meta OG (buildOgTitle di og_meta.go).
  // Kalau urutannya diubah di satu tempat, ubah SEMUANYA.
  const couple = [groomName, brideName].map((n) => n?.trim()).filter(Boolean).join(' dan ')

  if (reason === 'unavailable') {
    return (
      <div className="ggate">
        <div className="ggate__card">
          <SealMark />
          <h1 className="ggate__title">Undangan Belum Terbuka</h1>
          <hr className="ggate__rule" />
          <p className="ggate__body">
            Kami belum berhasil memeriksa undangan Anda karena sambungan ke server
            terputus. Undangan Anda tidak bermasalah &mdash; koneksinya yang
            sedang terganggu.
          </p>
          <p className="ggate__body">Periksa koneksi Anda, lalu coba lagi.</p>
          {onRetry && (
            <button type="button" className="ggate__retry" onClick={onRetry}>
              Coba Lagi
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="ggate">
      <div className="ggate__card">
        <SealMark />
        <h1 className="ggate__title">Mohon Maaf</h1>
        <hr className="ggate__rule" />
        <p className="ggate__body">
          Anda tidak terdaftar dalam list undangan
          {couple ? (
            <>
              {' '}
              <span className="ggate__couple">{couple}</span>
            </>
          ) : (
            ' kami'
          )}
          .
        </p>
        <p className="ggate__body">
          Undangan ini bersifat pribadi dan hanya dapat dibuka melalui tautan yang
          kami kirimkan langsung kepada Anda.
        </p>
        <p className="ggate__note">
          Bila Anda merasa ini keliru, silakan hubungi mempelai untuk meminta
          tautan undangan Anda.
        </p>
      </div>
    </div>
  )
}

/** Amplop tersegel - SVG inline, bukan berkas gambar: layar ini justru paling
 * sering dibuka orang yang tidak diundang, jadi ia tidak boleh menambah beban
 * permintaan apa pun ke server. */
function SealMark() {
  return (
    <svg className="ggate__mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2" strokeWidth="1.2" />
      <path d="M2.5 7l9.5 6.5L21.5 7" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="15.5" r="3.2" fill="currentColor" stroke="none" opacity="0.9" />
    </svg>
  )
}
