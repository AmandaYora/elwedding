import { forwardRef, useId } from 'react'
import type { TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, id, className = '', rows = 3, ...props },
  ref,
) {
  const autoId = useId()
  const textareaId = id ?? autoId

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={textareaId} className="text-xs font-semibold text-slate-700 tracking-tight">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        aria-invalid={!!error}
        className={[
          'rounded-lg border px-3.5 py-2.5 text-sm text-[var(--text)] bg-white resize-y transition-all duration-150',
          'placeholder:text-slate-400 placeholder:text-sm leading-relaxed',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy-500)]/25 focus-visible:border-[var(--navy-600)]',
          error
            ? 'border-red-400 bg-red-50/20 text-red-900 focus-visible:ring-red-500/20 focus-visible:border-red-500'
            : 'border-slate-300 hover:border-slate-400',
          className,
        ].join(' ')}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-0.5">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
})

