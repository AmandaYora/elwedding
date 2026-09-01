import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-[var(--navy-600)] text-white hover:bg-[var(--navy-700)] active:bg-[var(--navy-800)] border border-transparent shadow-sm hover:shadow active:scale-[0.98]',
  secondary:
    'bg-white text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface-subtle)] hover:border-slate-300 active:bg-slate-100 shadow-xs active:scale-[0.98]',
  ghost:
    'bg-transparent text-[var(--muted)] hover:text-[var(--text)] border border-transparent hover:bg-slate-100/80 active:bg-slate-200/70',
  danger:
    'bg-white text-[var(--danger)] border border-[var(--danger-border)] hover:bg-[var(--danger-bg)] hover:border-[var(--danger)] active:bg-red-100 active:scale-[0.98]',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 font-medium',
  md: 'h-9 px-4 text-sm gap-2 font-medium',
  lg: 'h-11 px-5 text-base gap-2.5 font-semibold',
}

/** Tombol modern dengan animasi mikro dan varian visual yang elegan */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center rounded-lg transition-all duration-150 cursor-pointer select-none',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy-500)] focus-visible:ring-offset-2',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
})

