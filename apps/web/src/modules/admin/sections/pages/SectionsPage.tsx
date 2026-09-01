import { useEffect, useState } from 'react'
import { type AdminSection, listSections, updateSections } from '@/modules/admin/sections/services/sections.service'
import { Card, CardBody, Checkbox, Button } from '@/shared/components/ui'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { StickyActionBar } from '@/shared/components/layout/StickyActionBar'
import { Skeleton } from '@/shared/components/feedback/Skeleton'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { useToast } from '@/shared/components/toast/ToastProvider'

export default function SectionsPage() {
  const [sections, setSections] = useState<AdminSection[]>([])
  const [initialSections, setInitialSections] = useState<AdminSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    listSections()
      .then((data) => {
        const sorted = [...data].sort((a, b) => a.sortOrder - b.sortOrder)
        setSections(sorted)
        setInitialSections(sorted)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  function toggle(key: string) {
    setSections((prev) => prev.map((s) => (s.key === key ? { ...s, isEnabled: !s.isEnabled } : s)))
  }

  function move(index: number, direction: -1 | 1) {
    setSections((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((s, i) => ({ ...s, sortOrder: i + 1 }))
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await updateSections(sections.map((s) => ({ key: s.key, isEnabled: s.isEnabled, sortOrder: s.sortOrder })))
      setInitialSections(sections)
      toast.success('Perubahan section tersimpan.')
    } catch {
      toast.error('Gagal menyimpan perubahan section.')
    } finally {
      setSaving(false)
    }
  }

  const enabledCount = sections.filter((s) => s.isEnabled).length
  const dirty = JSON.stringify(sections) !== JSON.stringify(initialSections)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Section"
        description="Atur bagian mana yang tampil di undangan dan urutkan susunannya."
        action={
          !loading && !error ? (
            <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {enabledCount} dari {sections.length} Aktif
            </span>
          ) : undefined
        }
      />

      {loading && (
        <Card>
          <CardBody className="flex flex-col gap-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </CardBody>
        </Card>
      )}

      {!loading && error && <ErrorState message="Gagal memuat daftar section." />}

      {!loading && !error && (
        <>
          <Card className="shadow-sm">
            <ul className="divide-y divide-slate-100">
              {sections.map((section, index) => (
                <li
                  key={section.key}
                  className={[
                    'flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-150',
                    section.isEnabled ? 'bg-white hover:bg-slate-50/70' : 'bg-slate-50/50 opacity-75 hover:opacity-100',
                  ].join(' ')}
                >
                  <div className="w-8 text-center font-mono text-xs font-bold text-slate-400">
                    #{String(index + 1).padStart(2, '0')}
                  </div>

                  <div className="flex items-center">
                    <Checkbox checked={section.isEnabled} onChange={() => toggle(section.key)} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{section.label}</p>
                      <span
                        className={[
                          'text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                          section.isEnabled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200',
                        ].join(' ')}
                      >
                        {section.isEnabled ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{section.key}</p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Naikkan ${section.label}`}
                      className="px-2.5 h-8 hover:bg-slate-200/70"
                    >
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                      </svg>
                      <span className="sr-only">↑</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => move(index, 1)}
                      disabled={index === sections.length - 1}
                      aria-label={`Turunkan ${section.label}`}
                      className="px-2.5 h-8 hover:bg-slate-200/70"
                    >
                      <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                      <span className="sr-only">↓</span>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <StickyActionBar dirty={dirty} saving={saving} onSave={handleSave} label="Simpan perubahan" hint="Ada perubahan section belum disimpan." />
        </>
      )}
    </div>
  )
}
