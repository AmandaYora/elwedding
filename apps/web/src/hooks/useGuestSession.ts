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

/**
 * Pengganti useGuestName (PLAN.md task #13 / keputusan #3): baca token dari
 * `?guest=<token>` (bukan `?to=<nama bebas>` lama), resolve identitas +
 * status RSVP tersimpan lewat GET /api/v1/public/guests/by-token/:token.
 * Tanpa token, atau token invalid -> fallback identik perilaku lama
 * ("Tamu Undangan", tanpa persist) supaya link generik tetap berfungsi.
 */
export function useGuestSession(): GuestSession {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('guest'))
  const [session, setSession] = useState<GuestSession>({ ...DEFAULT_SESSION, token })

  useEffect(() => {
    if (!token) return
    let cancelled = false

    httpClient
      .get<
        ApiEnvelope<{ name: string; side: 'groom' | 'bride'; rsvpStatus: GuestSession['status']; attendingCount: number }>
      >(`/api/v1/public/guests/by-token/${token}`)
      .then((res) => {
        if (cancelled) return
        const { name, side, rsvpStatus, attendingCount } = res.data.data
        setSession({ name, side, status: rsvpStatus, token, attendingCount: attendingCount || 1 })
      })
      .catch(() => {
        // Token tidak valid -> biarkan fallback default (nama generik,
        // status pending, tanpa persist saat RSVP diisi).
      })

    return () => {
      cancelled = true
    }
  }, [token])

  return session
}
