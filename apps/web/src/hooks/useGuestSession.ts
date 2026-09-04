import { useEffect, useState } from 'react'
import { httpClient } from '@/shared/services/http-client'
import type { ApiEnvelope, GuestSession } from '@/types/api'

const DEFAULT_SESSION: GuestSession = {
  name: 'Tamu Undangan',
  side: null,
  status: 'pending',
  token: null,
  attendingCount: 1,
}

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
}

interface ResolvedGuest {
  name: string
  side: 'groom' | 'bride'
  rsvpStatus: GuestSession['status']
  attendingCount: number
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
export function useGuestSession(): GuestSessionState {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('guest'))
  const [session, setSession] = useState<GuestSessionState>({ ...DEFAULT_SESSION, token, resolved: false })

  useEffect(() => {
    if (!token) return
    let cancelled = false

    resolveGuest(token)
      .then(({ name, side, rsvpStatus, attendingCount }) => {
        if (cancelled) return
        setSession({ name, side, status: rsvpStatus, token, attendingCount: attendingCount || 1, resolved: true })
      })
      .catch(() => {
        // Token tidak valid -> biarkan fallback default (nama generik,
        // resolved tetap false, tanpa persist saat RSVP diisi).
      })

    return () => {
      cancelled = true
    }
  }, [token])

  return session
}
