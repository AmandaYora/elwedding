import { useEffect, useRef, useState } from 'react'
import { httpClient } from '@/shared/services/http-client'
import type { ApiEnvelope, PublicWish } from '@/types/api'
import { useGuestSession } from '@/hooks/useGuestSession'
import { apiErrorMessage } from '@/shared/lib/api-error'
import { formatRelativeTime } from '@/shared/utils/relative-time'
import './wedding-wish.css'

/** Jeda auto-advance slider (docs/plan/wedding-wish/PLAN.md §3.6). */
const SLIDE_INTERVAL_MS = 5000

/** Jarak usap minimum (px) untuk pindah slide. Di bawah ini dianggap ketukan/
 * scroll vertikal dan diabaikan - penting supaya usap tidak membajak scroll
 * halaman (tidak ada preventDefault di mana pun di slider ini). */
const SWIPE_THRESHOLD_PX = 40

/** Batas panjang ucapan di sisi klien. KEMBAR dengan maxWishLength di backend
 * dan VARCHAR(500) di migration 000020 - browser tidak bisa memanggil
 * konstanta Go, jadi angkanya diketik ulang di sini. Penegakan sebenarnya
 * tetap di server; maxlength ini hanya mencegah ketikan yang pasti ditolak. */
const MAX_MESSAGE_LENGTH = 500

function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  return reduced
}

/** WishSlider - slider React mandiri (keputusan D6): auto-advance 5 detik,
 * berhenti saat hover/fokus/sentuh, dots sebagai penanda sekaligus navigasi
 * manual. Tanpa pustaka apa pun, tanpa menyentuh Slick legacy - ucapan tiba
 * dari endpoint sendiri SESUDAH bundle legacy selesai membaca DOM.
 *
 * Daftar kosong TIDAK dirender oleh pemanggil (hanya form), jadi komponen ini
 * selalu menerima minimal satu ucapan. */
function WishSlider({ wishes }: { wishes: PublicWish[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduceMotion = usePrefersReducedMotion()
  const touchStartX = useRef<number | null>(null)
  const count = wishes.length

  useEffect(() => {
    if (paused || reduceMotion || count < 2) return
    const timer = setTimeout(() => {
      setIndex((i) => (i + 1) % count)
    }, SLIDE_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [paused, reduceMotion, count, index])

  if (count === 0) return null

  // Indeks dijaga tetap dalam rentang walau daftar menyusut (mis. admin
  // menyembunyikan ucapan lalu tamu memuat ulang di tengah tayang).
  const safeIndex = ((index % count) + count) % count
  const go = (i: number) => setIndex(((i % count) + count) % count)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    setPaused(true)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    setPaused(false)
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return
    go(safeIndex + (dx < 0 ? 1 : -1))
  }

  return (
    <div
      className="ww-slider"
      role="region"
      aria-roledescription="carousel"
      aria-label="Ucapan tamu"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="ww-track" style={{ transform: `translateX(-${safeIndex * 100}%)` }}>
        {wishes.map((w) => (
          <div className="ww-slide" key={w.id}>
            <figure className="ww-card">
              <blockquote className="ww-card-message">{w.message}</blockquote>
              <figcaption>
                <span className="ww-card-name">{w.guestName}</span>
                <span className="ww-card-time">{formatRelativeTime(w.createdAt)}</span>
              </figcaption>
            </figure>
          </div>
        ))}
      </div>
      {count > 1 && (
        <div className="ww-dots" role="tablist" aria-label="Pilih ucapan">
          {wishes.map((w, i) => (
            <button
              key={w.id}
              type="button"
              className="ww-dot"
              data-active={i === safeIndex}
              aria-label={`Ucapan ${i + 1} dari ${count}`}
              onClick={() => go(i)}
            />
          ))}
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
              <WishSlider wishes={wishes} />
            </div>
          )}

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
