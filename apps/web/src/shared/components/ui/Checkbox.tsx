import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, id, className = '', ...props },
  ref,
) {
  const autoId = useId()
  const checkboxId = id ?? autoId

  return (
    <label htmlFor={checkboxId} className="inline-flex items-center gap-2.5 text-sm font-medium text-[var(--text)] cursor-pointer select-none group">
      <input
        ref={ref}
        id={checkboxId}
        type="checkbox"
        className={[
          'h-4.5 w-4.5 rounded border-slate-300 text-[var(--navy-600)] accent-[var(--navy-600)] transition-colors cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy-500)]/30 focus-visible:ring-offset-1',
          'group-hover:border-slate-400',
          className,
        ].join(' ')}
        {...props}
      />
      {label && <span>{label}</span>}
    </label>
  )
})

