import { useEffect, useRef, useState } from 'react'
import { type ContentFormValues, getContent, toFormValues, updateContent, uploadAudioFile } from '@/modules/admin/content/services/content.service'
import { Card, CardHeader, CardBody, Input } from '@/shared/components/ui'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { StickyActionBar } from '@/shared/components/layout/StickyActionBar'
import { Skeleton } from '@/shared/components/feedback/Skeleton'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { useToast } from '@/shared/components/toast/ToastProvider'

export default function SettingsPage() {
  const [form, setForm] = useState<ContentFormValues | null>(null)
  const [initialForm, setInitialForm] = useState<ContentFormValues | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const toast = useToast()

  // Perbaikan B1: sebelumnya tanpa .catch sama sekali -> halaman macet
  // permanen di skeleton saat API gagal (meniru pola GuestsPage.tsx:78-96).
  useEffect(() => {
    let cancelled = false
    getContent()
      .then((c) => {
        if (cancelled) return
        const values = toFormValues(c)
        setForm(values)
        setInitialForm(values)
        setError(false)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  async function handleSave() {
    if (!form) return
    setSaving(true)
    try {
      await updateContent(form)
      setInitialForm(form)
      toast.success('Pengaturan tersimpan.')
    } catch {
      toast.error('Gagal menyimpan pengaturan.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file || !form) return
    setUploading(true)
    try {
      const url = await uploadAudioFile(file)
      setForm({ ...form, musicUrl: url })
      toast.success('File musik berhasil diunggah.')
    } catch {
      toast.error('Gagal mengunggah file musik.')
    } finally {
      setUploading(false)
    }
  }

  function toggleAudio() {
    if (!audioRef.current || !form?.musicUrl) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play().catch(() => {
        toast.error('Gagal memutar audio preview.')
      })
      setIsPlaying(true)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-48 w-full rounded-2xl mt-4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Pengaturan" description="Atur musik latar belakang dan konfigurasi sistem undangan." />
        <ErrorState message="Gagal memuat pengaturan." onRetry={() => setReloadToken((t) => t + 1)} />
      </div>
    )
  }

  if (!form) return null

  const dirty = initialForm !== null && form.musicUrl !== initialForm.musicUrl

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pengaturan" description="Atur musik latar belakang dan konfigurasi sistem undangan." />

      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            <span>Musik Latar</span>
          </div>
        </CardHeader>
        <CardBody className="p-6 flex flex-col gap-5">
          <Input
            label="URL Musik"
            value={form.musicUrl}
            onChange={(e) => setForm({ ...form, musicUrl: e.target.value })}
            placeholder="https://example.com/audio.mp3 atau path audio"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            }
          />

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-700 tracking-tight">atau unggah file musik</label>
            <label className="cursor-pointer">
              <div className="flex flex-col items-center justify-center p-5 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/20 text-center transition-colors">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-700">
                  {uploading ? 'Mengunggah file musik...' : 'Pilih file audio dari perangkat'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Format didukung: MP3, WAV, AAC, M4A</p>
              </div>
              <input
                type="file"
                accept="audio/*"
                disabled={uploading}
                className="sr-only"
                onChange={(e) => void handleUpload(e.target.files?.[0])}
              />
            </label>
          </div>

          {/* Audio Player Preview */}
          {form.musicUrl && (
            <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between gap-4 shadow-sm">
              <audio
                ref={audioRef}
                src={form.musicUrl}
                onEnded={() => setIsPlaying(false)}
                onError={() => setIsPlaying(false)}
              />
              <div className="flex items-center gap-3 min-w-0">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/25 transition-colors cursor-pointer"
                  aria-label={isPlaying ? 'Pause music' : 'Play music'}
                >
                  {isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-100 truncate">Audio Preview</p>
                  <p className="text-[11px] text-slate-400 truncate">{form.musicUrl}</p>
                </div>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-blue-300 border border-slate-700">
                {isPlaying ? 'Memutar...' : 'Siap'}
              </span>
            </div>
          )}
        </CardBody>
      </Card>

      <StickyActionBar dirty={dirty} saving={saving} onSave={handleSave} hint="Ada perubahan pengaturan belum disimpan." />
    </div>
  )
}
