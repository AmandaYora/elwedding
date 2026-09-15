import { useEffect, useState } from 'react'
import { httpClient } from '@/shared/services/http-client'
import type { ApiEnvelope, GuestSession } from '@/types/api'

const DEFAULT_SESSION: GuestSession = {
  name: 'Tamu Undangan',
  side: null,
  status: 'pending',
  token: null,
  attendingCount: 1,
  // 2 DISENGAJA, bukan 1 (docs/plan/guest-pax-quota/PLAN.md T21): nilai ini
  // yang dipakai mode pratinjau (`/` tanpa ?guest=), yang tidak punya baris
  // tamu untuk dibaca. 2 mempertahankan tampilan dua tombol yang berlaku
  // sebelum fitur jatah kursi ada - pratinjau tidak boleh ikut berubah.
  paxQuota: 2,
  hasWish: false,
  wishMessage: '',
}

/** Keputusan akses undangan untuk pembuka halaman ini.
 *
 * Dipisah dari `resolved` dan TIDAK boleh disederhanakan jadi boolean: empat
 * keadaan ini menuntut empat perlakuan yang berbeda di layar.
 *
 * - `checking`   - token ada, jawabannya belum tiba. Undangan MAUPUN layar
 *                  penolakan sama-sama belum boleh tampil; menebak salah satu
 *                  berarti mengedipkan isi undangan ke orang yang belum tentu
 *                  berhak, atau menuduh tamu sah yang jaringannya lambat.
 * - `granted`    - token cocok dengan satu baris tamu. Undangan dibuka.
 * - `denied`     - tidak ada token sama sekali, ATAU server menjawab 404
 *                  (token tidak dikenal). Inilah satu-satunya keadaan yang
 *                  boleh berbunyi "Anda tidak terdaftar".
 * - `unavailable`- permintaannya TIDAK SAMPAI, atau server sedang bermasalah
 *                  (5xx). Tamunya boleh jadi sangat sah - yang gagal adalah
 *                  jaringannya. Menyamakan ini dengan `denied` berarti
 *                  menuduh tamu undangan sebagai penyusup hanya karena sinyal
 *                  putus sesaat. Pembedaan yang sama sudah dipakai ScanPage
 *                  di gate ("Tidak terkirim" vs "Tidak dikenali").
 */
export type GuestAccess = 'checking' | 'granted' | 'denied' | 'unavailable'

/** Hasil resolve sesi tamu ditambah state klien `resolved`.
 *
 * `resolved` DISENGAJA tidak ditaruh di `GuestSession` (types/api.ts):
 * tipe itu adalah cermin kontrak API `GuestSessionDTO` di backend, jadi
 * mencampurkan state klien ke situ mengaburkan batas kontrak. Karena aditif,
 * konsumen lama (RsvpConfirmation) tidak perlu berubah.
 *
 * `resolved === true` HANYA setelah fetch by-token sukses. Konsumen yang
 * perlu membedakan "nama tamu sungguhan" dari fallback generik WAJIB memakai
 * penanda ini, bukan membandingkan `name` dengan string - lihat TopCover,
 * yang harus tetap menampilkan "Dear Mr/Mrs/Ms" (bukan "Dear Tamu Undangan")
 * selama fetch belum selesai. */
export interface GuestSessionState extends GuestSession {
  resolved: boolean
  access: GuestAccess
}

interface ResolvedGuest {
  name: string
  side: 'groom' | 'bride'
  rsvpStatus: GuestSession['status']
  attendingCount: number
  paxQuota: number
  // Status ucapan (docs/plan/wedding-wish/PLAN.md T13): WAJIB diteruskan di
  // sini, kalau tidak field hasWish/wishMessage dari respons by-token tidak
  // pernah sampai ke komponen WeddingWish. Mekanisme cache promise-nya TIDAK
  // berubah - tetap satu request yang sama, tanpa permintaan tambahan.
  hasWish: boolean
  wishMessage: string
}

/** Cache PROMISE (bukan hasilnya) per token, level modul.
 *
 * Menyimpan promise membuat dua konsumen yang mount bersamaan berbagi SATU
 * request GET by-token, bukan dua - kondisi yang muncul begitu TopCover ikut
 * memakai hook ini di samping RsvpConfirmation (PLAN.md D6). Kalau yang
 * disimpan adalah hasilnya, dua mount serentak tetap memicu dua request
 * karena keduanya belum melihat hasil apa pun. */
const sessionCache = new Map<string, Promise<ResolvedGuest>>()

/** Mengosongkan cache di atas. **Hanya untuk test.**
 *
 * Di produksi cache ini memang tidak perlu di-reset: halaman dimuat sekali dan
 * token-nya tetap sepanjang umur halaman. Tapi di test, cache level modul
 * bertahan antar test case, sehingga test kedua yang memakai token SAMA akan
 * menerima respons mock milik test pertama alih-alih mock-nya sendiri.
 * Panggil ini di `afterEach` pada test yang menyentuh jalur by-token. */
export function resetGuestSessionCache(): void {
  sessionCache.clear()
}

function resolveGuest(token: string): Promise<ResolvedGuest> {
  const cached = sessionCache.get(token)
  if (cached) return cached

  const promise = httpClient
    .get<ApiEnvelope<ResolvedGuest>>(`/api/v1/public/guests/by-token/${token}`)
    .then((res) => res.data.data)
    .catch((err) => {
      // Buang entri yang gagal supaya mount berikutnya masih bisa mencoba
      // lagi. Kalau entri gagal dibiarkan tersimpan, satu gangguan jaringan
      // sesaat akan mengunci nama tamu jadi fallback sampai halaman direload.
      sessionCache.delete(token)
      throw err
    })

  sessionCache.set(token, promise)
  return promise
}

/**
 * Pengganti useGuestName (PLAN.md task #13 / keputusan #3): baca token dari
 * `?guest=<token>` (bukan `?to=<nama bebas>` lama), resolve identitas +
 * status RSVP tersimpan lewat GET /api/v1/public/guests/by-token/:token.
 * Tanpa token, atau token invalid -> fallback identik perilaku lama
 * ("Tamu Undangan", `resolved: false`, tanpa persist) supaya link generik
 * tetap berfungsi.
 */
/** Menerjemahkan kegagalan fetch jadi keputusan akses.
 *
 * HANYA 404 yang berarti "tidak terdaftar". 404 itu jawaban TEGAS dari server
 * bahwa tokennya tidak cocok dengan baris tamu mana pun (lihat
 * `guest.Service.ResolveByToken`). Segala kegagalan lain - permintaan tidak
 * terkirim, DNS gagal, 500, gateway timeout - TIDAK membuktikan apa pun
 * tentang undangan si pembuka, jadi tidak boleh berujung tuduhan.
 *
 * Sengaja tanpa `instanceof AxiosError`: hook ini juga dipanggil di test
 * dengan galat tiruan, dan bentuk `response.status` sudah cukup menentukan.
 */
function accessFromError(err: unknown): GuestAccess {
  const status = (err as { response?: { status?: number } })?.response?.status
  return status === 404 ? 'denied' : 'unavailable'
}

export function useGuestSession(): GuestSessionState {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('guest'))
  const [session, setSession] = useState<GuestSessionState>({
    ...DEFAULT_SESSION,
    token,
    resolved: false,
    // Tanpa token TIDAK ada yang perlu ditunggu: keputusannya sudah final
    // sejak render pertama, tanpa satu pun permintaan jaringan.
    access: token ? 'checking' : 'denied',
  })

  useEffect(() => {
    if (!token) return
    let cancelled = false

    resolveGuest(token)
      .then(({ name, side, rsvpStatus, attendingCount, paxQuota, hasWish, wishMessage }) => {
        if (cancelled) return
        setSession({
          name, side, status: rsvpStatus, token,
          attendingCount: attendingCount || 1,
          // `|| 2` mengikuti pola `attendingCount || 1` di atasnya: respons
          // lama/tak lengkap tidak boleh menghasilkan jatah 0, yang akan
          // membuat tamu tidak bisa memilih angka apa pun.
          paxQuota: paxQuota || 2,
          // `??` (bukan `||`): respons backend LAMA yang belum mengenal
          // ucapan tidak punya field ini (undefined) dan harus jatuh ke
          // default; nilai sah (false/'') tidak boleh tertimpa.
          hasWish: hasWish ?? false,
          wishMessage: wishMessage ?? '',
          resolved: true, access: 'granted',
        })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // Identitas TIDAK diisi apa pun - nama tetap fallback generik dan
        // `resolved` tetap false, persis perilaku lama. Yang bertambah hanya
        // keputusan aksesnya.
        setSession((prev) => ({ ...prev, access: accessFromError(err) }))
      })

    return () => {
      cancelled = true
    }
  }, [token])

  return session
}
