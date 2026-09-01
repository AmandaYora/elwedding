import type { HTMLAttributes } from 'react'

export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        'rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs transition-shadow duration-200 overflow-hidden',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={[
        'px-5 py-4 border-b border-[var(--border)] bg-gradient-to-r from-slate-50/50 to-transparent font-semibold text-sm text-[var(--text)] flex items-center justify-between gap-2',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardBody({ className = '', children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['p-5', className].join(' ')} {...props}>
      {children}
    </div>
  )
}

