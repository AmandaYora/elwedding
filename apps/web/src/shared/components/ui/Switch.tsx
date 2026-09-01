interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

/**
 * Toggle on/off beraksesibilitas (role="switch") - dashboard-wa-rsvp task
 * B1. Berbeda dari Checkbox: dipakai untuk pernyataan status ("aktif/tidak
 * aktif"), bukan pilihan dalam daftar.
 */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  return (
    <label className="inline-flex items-start gap-3 cursor-pointer select-none group">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 cursor-pointer mt-0.5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy-500)]/30 focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          checked ? 'bg-[var(--navy-600)]' : 'bg-slate-300',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-sm transition-transform duration-150',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
      {(label || description) && (
        <span className="flex flex-col">
          {label && <span className="text-sm font-medium text-[var(--text)]">{label}</span>}
          {description && <span className="text-xs text-slate-500 mt-0.5">{description}</span>}
        </span>
      )}
    </label>
  )
}
