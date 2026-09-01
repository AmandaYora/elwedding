import { useEffect, useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'

type ModalSize = 'lg' | 'xl' | '2xl'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  /** Lebar modal. Default `lg` (512px) - modal konfirmasi tetap tidak berubah. */
  size?: ModalSize
}

const SIZE_CLASS: Record<ModalSize, string> = {
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
}

/** Modal dialog modern dengan backdrop blur dan transisi elegan */
export function Modal({ open, onClose, title, children, footer, size = 'lg' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const pointerDownOnBackdropRef = useRef(false)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  if (!open) return null

  function handleBackdropMouseDown(e: MouseEvent<HTMLDivElement>) {
    pointerDownOnBackdropRef.current = e.target === e.currentTarget
  }

  function handleBackdropClick(e: MouseEvent<HTMLDivElement>) {
    const shouldClose = pointerDownOnBackdropRef.current && e.target === e.currentTarget
    pointerDownOnBackdropRef.current = false
    if (shouldClose) onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={[
          'w-full rounded-2xl bg-white shadow-2xl border border-slate-100 outline-none overflow-hidden transition-all duration-200 max-h-[90vh] flex flex-col',
          SIZE_CLASS[size],
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <h2 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40 flex items-center justify-end gap-2.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
