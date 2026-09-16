import { memo, useEffect, useRef, useState } from 'react'
import { httpClient } from '@/shared/services/http-client'
import type { ApiEnvelope, PublicWish } from '@/types/api'
import { useGuestSession } from '@/hooks/useGuestSession'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { formatRelativeTime } from '@/shared/utils/relative-time'
import './wedding-wish.css'

/** Batas panjang ucapan di sisi klien. KEMBAR dengan maxWishLength di backend
 * dan VARCHAR(500) di migration 000020 - browser tidak bisa memanggil
 * konstanta Go, jadi angkanya diketik ulang di sini. Penegakan sebenarnya
 * tetap di server; maxlength ini hanya mencegah ketikan yang pasti ditolak. */
const MAX_MESSAGE_LENGTH = 500

/** Ambang "ucapan panjang" yang memunculkan tombol Selengkapnya
 * (docs/plan/wedding-wish-slider-redesign/PLAN.md §5.2, R4).
 *
 * SENGAJA hitungan karakter, bukan mengukur scrollHeight: jsdom selalu
 * melaporkan tinggi 0, jadi pengukuran nyata membuat perilaku ini mustahil
 * diuji. Angkanya sengaja dipasang LEBIH RENDAH dari daya tampung 4 baris
 * clamp (+-180 karakter di lebar ponsel). Kalau meleset, tombolnya muncul di
 * teks yang sebenarnya sudah utuh - tidak enak dipandang tapi tidak
 * merugikan. Kebalikannya jauh lebih buruk: teks terpotong TANPA cara
 * membukanya. */
const LONG_MESSAGE_CHARS = 160

/** Lebar minimum penanda rel, dalam persen. Tanpa lantai ini, 30 ucapan
 * menghasilkan penanda selebar 3.3% yang praktis tak terlihat. */
const RAIL_MIN_THUMB_PCT = 12

/** Huruf untuk cakram inisial. Fallback '?' menjaga cakram tetap terisi
 * seandainya nama tamu hanya berisi spasi - kolom guests.name memang NOT
 * NULL, tapi NOT NULL tidak berarti tidak kosong.
 *
 * Array.from, BUKAN charAt(0): charAt memotong per unit UTF-16, jadi nama yang
 * diawali emoji atau aksara di luar BMP (admin mengetik nama tamu bebas)
 * menghasilkan separuh surrogate dan tampil sebagai kotak rusak. */
function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? '?').toUpperCase()
}

/** Satu kartu ucapan.
 *
 * DIBUNGKUS memo dengan alasan yang konkret, bukan kebiasaan: `onScroll` di
 * WishSlider menembak puluhan kali per detik saat digeser. Tanpa memo, setiap
 * tembakan itu me-render ulang ke-30 kartu sekaligus dan geserannya tersendat
 * di ponsel kelas menengah. Identitas objek `wish` stabil karena array
 * `wishes` tidak dibuat ulang saat scroll, jadi memo benar-benar menggigit. */
const WishCard = memo(function WishCard({ wish }: { wish: PublicWish }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = wish.message.length > LONG_MESSAGE_CHARS

  return (
    <article
      className="ww-card"
      data-side={wish.guestSide}
      data-expanded={expanded ? 'true' : 'false'}
    >
      {/* Cakram inisial - penanda khas kartu (D11). Warnanya mengikuti
          guestSide, data yang sudah lama dikirim API tapi tidak pernah
          ditampilkan. aria-hidden karena namanya toh dibacakan utuh di
          .ww-card-name; tanpa ini pembaca layar mengeja hurufnya dua kali. */}
      <span className="ww-card-seal" aria-hidden="true">{initialOf(wish.guestName)}</span>

      <p className="ww-card-message">{wish.message}</p>

      {/* Tombol TETAP dirender setelah dibuka, hanya labelnya bertukar.
          Dua alasan yang keduanya nyata dan sudah diukur di browser:

          1. Kartu meregang seragam (align-items: stretch), jadi membuka SATU
             kartu menaikkan tinggi SEMUA kartu - terukur 277px -> 469px.
             Kalau tombolnya lenyap, section itu menggelembung permanen hanya
             karena satu ketukan, tanpa jalan kembali.
          2. Tombol yang melepas dirinya sendiri dari DOM saat diklik membuang
             fokus keyboard ke body. */}
      {isLong && (
        <button
          type="button"
          className="ww-card-more"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Ringkas' : 'Selengkapnya'}
        </button>
      )}

      <footer className="ww-card-meta">
        <span className="ww-card-name">{wish.guestName}</span>
        <span className="ww-card-time">{formatRelativeTime(wish.createdAt)}</span>
      </footer>
    </article>
  )
})

/** WishSlider - deretan kartu yang digeser dengan SCROLL NATIVE + scroll-snap
 * (keputusan D8), bukan transform per indeks seperti versi sebelumnya.
 *
 * Konsekuensinya browser yang menangani geseran: jari diikuti real-time, ada
 * momentum, trackpad jalan, dan wadah ber-tabIndex bisa digeser dengan tombol
 * panah - semuanya tanpa satu baris JavaScript pun. Yang tersisa di JS hanya
 * membaca posisi untuk menggerakkan rel progres.
 *
 * TIDAK ADA auto-geser (D9): ia berkelahi dengan scroll native, bisa menyambar
 * tepat saat tamu sedang menyeret kartu. Ikut hilang bersamanya: state
 * index/paused, timer, dan usePrefersReducedMotion.
 *
 * Penjaga `safeIndex` versi lama juga sengaja TIDAK dibangkitkan ulang. Ia
 * dibutuhkan karena `index` adalah state React yang tidak tahu daftarnya
 * menyusut. Di sini posisi disimpan browser sebagai scrollLeft, dan browser
 * sendiri yang menjepitnya ke batas baru saat scrollWidth mengecil.
 *
 * JANGAN memanggil el.scrollTo(...) di sini. Element.prototype.scrollTo tidak
 * ada di jsdom - satu panggilan polos merontokkan seluruh test berkas ini.
 * Rancangan D9+D10 memang membuatnya tidak pernah dibutuhkan.
 *
 * Daftar kosong TIDAK dirender oleh pemanggil (hanya form). */
function WishSlider({
  wishes,
  scrollerRef,
}: {
  wishes: PublicWish[]
  scrollerRef: React.RefObject<HTMLDivElement>
}) {
  const [progress, setProgress] = useState(0)
  const count = wishes.length

  function handleScroll() {
    const el = scrollerRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    // PENJAGA WAJIB. clientWidth/scrollWidth selalu 0 di jsdom, dan di browser
    // pun keduanya masih 0 sebelum kartu sempat dilayout. Tanpa penjaga ini
    // hasilnya NaN, bocor ke atribut style, dan React memprotes.
    setProgress(max > 0 ? el.scrollLeft / max : 0)
  }

  if (count === 0) return null

  const thumbPct = Math.max(100 / count, RAIL_MIN_THUMB_PCT)

  return (
    <div className="ww-slider">
      <div
        className="ww-scroller"
        ref={scrollerRef}
        onScroll={handleScroll}
        // tabIndex DISENGAJA: membuat wadah scroll bisa difokus sehingga
        // pengguna keyboard menggesernya dengan tombol panah - perilaku
        // bawaan browser, gratis.
        tabIndex={0}
        role="region"
        aria-label="Ucapan dari para tamu"
      >
        {wishes.map((w) => (
          <WishCard key={w.id} wish={w} />
        ))}
      </div>

      {/* Rel progres menggantikan dots (D10): dengan publicWishLimit = 30,
          30 titik tidak terbaca. Lebar penanda = 1/jumlah kartu, jadi ia
          menjawab "sekarang di mana" DAN "masih ada berapa" sekaligus.
          aria-hidden: murni penanda visual, posisinya tidak bermakna bagi
          pembaca layar yang menelusuri kartu satu per satu. */}
      {count > 1 && (
        <div className="ww-rail" aria-hidden="true">
          <div
            className="ww-rail-thumb"
            style={{ width: `${thumbPct}%`, left: `${progress * (100 - thumbPct)}%` }}
          />
        </div>
      )}
    </div>
  )
}

export default function WeddingWish() {
  // Tanpa request tambahan: sesi (termasuk hasWish/wishMessage) menumpang
  // cache promise useGuestSession yang memang sudah dimuat halaman ini.
  const session = useGuestSession()
  const token = session.token

  const [wishes, setWishes] = useState<PublicWish[]>([])
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  // submitted = kirim sukses di sesi render ini; locked = server menjawab
  // "sudah pernah" (tab lain mengirim lebih dulu). Keduanya mengunci form.
  const [submitted, setSubmitted] = useState(false)
  const [locked, setLocked] = useState(false)
  // Ref DIMILIKI di sini, bukan di WishSlider: handleSubmit perlu menyentuh
  // node itu setelah kirim berhasil. Mengoper ref sebagai prop biasa jauh
  // lebih sedikit mesinnya daripada forwardRef/useImperativeHandle.
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!token) return
    let cancelled = false
    httpClient
      .get<ApiEnvelope<PublicWish[]>>(`/api/v1/public/guests/by-token/${token}/wishes`)
      .then((res) => {
        if (cancelled) return
        setWishes(res.data.data ?? [])
      })
      // Daftar gagal dimuat BUKAN keadaan buntu: form tetap bisa dipakai,
      // slidernya saja yang tidak tampil.
      .catch(() => {
        if (cancelled) return
        setWishes([])
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function loadWishes() {
    if (!token) return
    const res = await httpClient.get<ApiEnvelope<PublicWish[]>>(
      `/api/v1/public/guests/by-token/${token}/wishes`,
    )
    setWishes(res.data.data ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token || sending) return
    const text = message.trim()
    if (!text) {
      setError('Ucapan tidak boleh kosong.')
      return
    }
    setSending(true)
    setError('')
    try {
      await httpClient.post(`/api/v1/public/guests/by-token/${token}/wish`, { message: text })
      setSubmitted(true)
    } catch (err) {
      const msg = apiErrorMessage(err, 'Gagal mengirim ucapan.')
      setError(msg)
      // Tab lain mengirim lebih dulu dan menang di UNIQUE(guest_id): pesan
      // tampil DAN form terkunci, konsisten dengan tamu yang memang sudah
      // mengisi.
      if (/sudah pernah/i.test(msg)) {
        setLocked(true)
      }
    } finally {
      setSending(false)
    }
    // Muat ulang di LUAR try/catch submit di atas - dan SENGAJA tanpa umpan
    // balik gagal: ini hanya penyegar tampilan supaya ucapan sendiri langsung
    // tampil paling depan (alasan D7 memilih urut terbaru). Kegagalannya tidak
    // boleh menimpa hasil submit yang sudah pasti (sukses maupun "sudah
    // pernah") dengan pesan "Gagal mengirim" yang bohong.
    try {
      await loadWishes()
      // Gulung balik ke awal supaya ucapan sendiri - yang kini paling depan -
      // benar-benar terlihat, bukan tertinggal di posisi geser sebelumnya.
      // scrollLeft, BUKAN scrollTo: scrollTo tidak ada di jsdom.
      if (scrollerRef.current) scrollerRef.current.scrollLeft = 0
    } catch {
      /* daftar lama tetap tampil; muat ulang halaman untuk melihat terbaru */
    }
  }

  const hasWish = session.hasWish || submitted || locked

  return (
    <section className="wedding-wish-wrap" data-template="" data-section-order="wedding_wish">

      <div className="wedding-wish-inner">

        <div className="ornaments-wrapper">
          <div className="orn-wish-2 center">
            <div className="image-wrap" data-aos="zoom-out" data-aos-duration="1200" data-aos-delay="1100">
              <img src="/media/template/arsya/Orn-31.webp" width="840" height="763" alt="Ornaments"  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-wish-1 left">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1300" data-aos-delay="1100">
              <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt="Ornaments"  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-wish-1 right">
            <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="1300" data-aos-delay="1100">
              <img src="/media/template/arsya/Orn-28.webp" width="400" height="954" alt="Ornaments"  loading="lazy" decoding="async" />
            </div>
          </div>
        </div>

        <div className="wedding-wish-head">
          <h1 className="wedding-wish-title" data-aos="fade-up" data-aos-duration="600">
            Wedding Wish
          </h1>
        </div>

        <div className="wedding-wish-body">

          {/* .ww-layer mengangkat form DAN slider di atas ornamen taman.
              Akar masalahnya: .ornaments-wrapper adalah position:absolute
              TANPA z-index, dan blok ornamen kedua (pohon) dirender setelah
              blok ini di DOM - elemen ter-posisi tanpa z-index dilukis
              menurut urutan DOM, jadi pohon menang. Kartu "Ucapan Anda" lebih
              parah lagi karena .ww-own dulu tidak ter-posisi sama sekali.

              z-index 2, bukan 9999: ornamen ber-z-index auto sehingga 2 sudah
              cukup menang, sementara CSS template memakai 3, 5, dan 999999
              untuk pemutar musik & modal yang memang harus tetap di atas. */}
          <div className="ww-layer">

            {!hasWish ? (
              <div className="wedding-wish-form">
                <form className="" id="weddingWishForm" onSubmit={handleSubmit}>

                  <div className="form-group guest-comment-wrap" data-aos="fade-up" data-aos-duration="600"
                    data-aos-delay="150">
                    <textarea
                      className="form-control guest-comment no-scrollbar"
                      name="comment"
                      rows={1}
                      placeholder="Give your wish"
                      value={message}
                      maxLength={MAX_MESSAGE_LENGTH}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  <div className="submit-comment-wrap" data-aos="fade-up" data-aos-duration="600"
                    data-aos-delay="200">
                    <button type="submit" className="submit submit-comment" disabled={sending}>
                      {sending ? 'Sending...' : 'Send'}
                    </button>
                  </div>

                </form>
                {session.resolved && (
                  <p className="ww-sender-note">Mengirim sebagai {session.name}</p>
                )}
                {error && (
                  <p className="ww-error" role="alert">{error}</p>
                )}
              </div>
            ) : (
              <div className="wedding-wish-form">
                <div className="ww-own">
                  <p className="ww-own-title">Ucapan Anda</p>
                  {submitted || session.hasWish ? (
                    <p className="ww-own-message">{submitted ? message.trim() : session.wishMessage}</p>
                  ) : (
                    <p className="ww-own-message">Anda sudah pernah mengirim ucapan. Terima kasih!</p>
                  )}
                </div>
                {error && (
                  <p className="ww-error" role="alert">{error}</p>
                )}
              </div>
            )}

            {wishes.length > 0 && (
              // Kelas `show` WAJIB ikut: stylesheet template menyetel
              // `.comment-wrap{display:none}` dan hanya menampilkannya lewat
              // `.comment-wrap.show` (dulu ditambahkan JS legacy saat komentar
              // dimuat). Tanpa ini slider selalu tak terlihat walau datanya ada.
              <div className="comment-wrap show">
                <WishSlider wishes={wishes} scrollerRef={scrollerRef} />
              </div>
            )}

          </div>

        </div>

        <div className="ornaments-wrapper">
          <div className="orn-lv-3">
            <div className="image-wrap" data-aos="fade-up" data-aos-duration="600" data-aos-delay="250">
              <img src="/media/template/arsya/Orn-23.webp" width="600" height="293" alt="Ornaments"  loading="lazy" decoding="async" />
            </div>
          </div>
          <div className="orn-lv-2 left">
            <div className="orn-lv-2-3">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="750" data-aos-delay="600">
                <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="Ornaments"  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="orn-lv-2-2">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="800" data-aos-delay="550">
                <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="Ornaments"  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="image-wrap" data-aos="fade-right" data-aos-duration="600" data-aos-delay="250">
              <img src="/media/template/arsya/Orn-20.webp" width="534" height="357" alt="Ornaments"  loading="lazy" decoding="async" />
            </div>
            <div className="orn-lv-2-1">
              <div className="image-wrap" data-aos="fade-right" data-aos-duration="600" data-aos-delay="250">
                <img src="/media/template/arsya/Orn-29.webp" width="376" height="294" alt="Ornaments"  loading="lazy" decoding="async" />
              </div>
            </div>
          </div>
          <div className="orn-lv-2 right">
            <div className="orn-lv-2-3">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="750" data-aos-delay="600">
                <img src="/media/template/arsya/Orn-05.webp" width="400" height="1019" alt="Ornaments"  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="orn-lv-2-2">
              <div className="image-wrap" data-aos="zoom-in-up" data-aos-duration="800" data-aos-delay="550">
                <img src="/media/template/arsya/Orn-03.webp" width="400" height="841" alt="Ornaments"  loading="lazy" decoding="async" />
              </div>
            </div>
            <div className="image-wrap" data-aos="fade-right" data-aos-duration="600" data-aos-delay="250">
              <img src="/media/template/arsya/Orn-20.webp" width="534" height="357" alt="Ornaments"  loading="lazy" decoding="async" />
            </div>
            <div className="orn-lv-2-1">
              <div className="image-wrap" data-aos="fade-right" data-aos-duration="600" data-aos-delay="250">
                <img src="/media/template/arsya/Orn-29.webp" width="376" height="294" alt="Ornaments"  loading="lazy" decoding="async" />
              </div>
            </div>
          </div>
        </div>

      </div>


    </section>
  )
}
