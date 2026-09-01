// Token warna yang sama dengan theme.css, diekspor untuk dipakai dari TS
// (mis. inline style yang butuh nilai literal, bukan var() CSS).
export const colors = {
  navy900: 'var(--navy-900)',
  navy800: 'var(--navy-800)',
  navy600: 'var(--navy-600)',
  navy100: 'var(--navy-100)',

  canvas: 'var(--canvas)',
  surface: 'var(--surface)',
  border: 'var(--border)',
  text: 'var(--text)',
  muted: 'var(--muted)',

  statusAttendingText: 'var(--status-attending-text)',
  statusAttendingBg: 'var(--status-attending-bg)',
  statusNotAttendingText: 'var(--status-not-attending-text)',
  statusNotAttendingBg: 'var(--status-not-attending-bg)',
  statusRemindLaterText: 'var(--status-remind-later-text)',
  statusRemindLaterBg: 'var(--status-remind-later-bg)',
  statusPendingText: 'var(--status-pending-text)',
  statusPendingBg: 'var(--status-pending-bg)',

  danger: 'var(--danger)',
  dangerBg: 'var(--danger-bg)',
} as const
