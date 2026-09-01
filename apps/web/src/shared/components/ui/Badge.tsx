import type { RsvpStatus } from '@/shared/constants/guests'

type BadgeTone = 'slate' | 'blue' | 'amber' | 'teal' | 'violet'

interface StatusBadgeProps {
  status: RsvpStatus
  label: string
  tone?: never
}

interface ToneBadgeProps {
  status?: never
  label: string
  tone: BadgeTone
}

type BadgeProps = StatusBadgeProps | ToneBadgeProps

const STATUS_STYLE: Record<RsvpStatus, { color: string; background: string; border: string; dot: string }> = {
  attending: {
    color: 'var(--status-attending-text)',
    background: 'var(--status-attending-bg)',
    border: 'var(--status-attending-border)',
    dot: '#0d9488',
  },
  not_attending: {
    color: 'var(--status-not-attending-text)',
    background: 'var(--status-not-attending-bg)',
    border: 'var(--status-not-attending-border)',
    dot: '#e11d48',
  },
  remind_later: {
    color: 'var(--status-remind-later-text)',
    background: 'var(--status-remind-later-bg)',
    border: 'var(--status-remind-later-border)',
    dot: '#d97706',
  },
  pending: {
    color: 'var(--status-pending-text)',
    background: 'var(--status-pending-bg)',
    border: 'var(--status-pending-border)',
    dot: '#64748b',
  },
}

/**
 * Varian netral (guest-fields-admin-layout keputusan B2) untuk data yang
 * bukan status RSVP - jenis undangan, jenis souvenir, dsb. Jalur `status`
 * di atas TIDAK diubah agar Badge.test.tsx tetap lulus tanpa disentuh.
 */
const TONE_CLASS: Record<BadgeTone, string> = {
  slate: 'text-slate-700 bg-slate-100 border-slate-200',
  blue: 'text-blue-700 bg-blue-50 border-blue-200',
  amber: 'text-amber-700 bg-amber-50 border-amber-200',
  teal: 'text-teal-700 bg-teal-50 border-teal-200',
  violet: 'text-violet-700 bg-violet-50 border-violet-200',
}

/** Badge status RSVP modern dengan dot status bercahaya dan kontras optimal */
export function Badge(props: BadgeProps) {
  if (props.tone) {
    return (
      <span
        className={[
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border select-none',
          TONE_CLASS[props.tone],
        ].join(' ')}
      >
        {props.label}
      </span>
    )
  }

  const style = STATUS_STYLE[props.status]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border shadow-2xs select-none"
      style={{ color: style.color, background: style.background, borderColor: style.border }}
    >
      <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: style.dot }} aria-hidden="true" />
      {props.label}
    </span>
  )
}
