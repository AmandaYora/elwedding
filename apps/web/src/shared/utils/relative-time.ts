// Diekstrak dari DashboardPage.tsx (dashboard-wa-rsvp) supaya bisa dipakai
// ulang di ReservationsPage (guest-reservation-split) - tanpa library
// tambahan, Intl bawaan browser sudah cukup.
const rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' })

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffSeconds = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(diffSeconds)
  if (abs < 60) return rtf.format(diffSeconds, 'second')
  const diffMinutes = Math.round(diffSeconds / 60)
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute')
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour')
  const diffDays = Math.round(diffHours / 24)
  return rtf.format(diffDays, 'day')
}
