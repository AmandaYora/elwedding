import { useEffect } from 'react'
import { Button } from '@/shared/components/ui'

interface StickyActionBarProps {
  dirty: boolean
  saving: boolean
  onSave: () => void
  label?: string
  hint?: string
}

/**
 * Action bar Simpan seragam untuk halaman form admin (guest-fields-admin-
 * layout T2/T3) - menggantikan 4 posisi Simpan berbeda dan bar
 * `fixed ... lg:left-64` yang salah align (ContentPage.tsx lama).
 *
 * `sticky bottom-0` menempel di dalam kolom konten, BUKAN `fixed`, jadi
 * otomatis sejajar dengan lebar kolom tanpa meng-hardcode lebar sidebar.
 *
 * Guard "perubahan belum disimpan" dibatasi ke `beforeunload` saja
 * (keputusan #15/#16) - `useBlocker` DILARANG dipakai karena AdminApp.tsx
 * memakai `BrowserRouter` biasa (bukan data router), dan `useBlocker` akan
 * melempar invariant "must be used within a data router" saat dipanggil.
 */
export function StickyActionBar({ dirty, saving, onSave, label, hint }: StickyActionBarProps) {
  useEffect(() => {
    if (!dirty) return
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  return (
    <div className="sticky bottom-0 -mx-4 sm:-mx-8 mt-6 border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 shadow-[0_-4px_12px_-4px_rgba(15,23,42,0.06)]">
      <p className="text-xs text-slate-500">
        {dirty ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            {hint ?? 'Ada perubahan belum disimpan.'}
          </span>
        ) : (
          <span className="hidden sm:inline">Tidak ada perubahan.</span>
        )}
      </p>
      <Button onClick={onSave} loading={saving} disabled={!dirty} size="md" className="shadow-sm">
        {label ?? 'Simpan'}
      </Button>
    </div>
  )
}
