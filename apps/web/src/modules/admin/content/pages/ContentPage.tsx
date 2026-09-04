import { useEffect, useState } from 'react'
import {
  type ContentFormValues,
  getContent,
  toFormValues,
  updateContent,
  uploadImageBase64,
} from '@/modules/admin/content/services/content.service'
import {
  agendaEventsResource,
  galleryPhotosResource,
  giftBanksResource,
  loveStoryChaptersResource,
  rundownItemsResource,
} from '@/modules/admin/content/services/content-lists.service'
import SimpleListEditor from '@/modules/admin/content/components/SimpleListEditor'
import type { AgendaEvent, GalleryPhoto, LoveStoryChapter, RundownItem, WeddingGiftBank } from '@/types/api'
import { Card, CardHeader, CardBody, Input, Textarea } from '@/shared/components/ui'
import { PageHeader } from '@/shared/components/layout/PageHeader'
import { StickyActionBar } from '@/shared/components/layout/StickyActionBar'
import { Skeleton } from '@/shared/components/feedback/Skeleton'
import { ErrorState } from '@/shared/components/feedback/ErrorState'
import { useToast } from '@/shared/components/toast/ToastProvider'
import { apiErrorMessage } from '@/shared/lib/api-error'

function Field({
  label,
  value,
  onChange,
  textarea,
  placeholder,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
  placeholder?: string
  type?: string
}) {
  return textarea ? (
    <Textarea label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  ) : (
    <Input label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} />
  )
}

function PhotoField({ label, value, onChange, onUploadingChange }: { label: string; value: string; onChange: (url: string) => void; onUploadingChange?: (b: boolean) => void }) {
  const [uploading, setUploading] = useState(false)
  const toast = useToast()
  function setUploadingTracked(v: boolean) {
    setUploading(v)
    onUploadingChange?.(v)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-700 tracking-tight">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          <div className="relative group shrink-0">
            <img
              src={value}
              alt=""
              className="h-16 w-16 object-cover rounded-xl border border-slate-200 shadow-2xs bg-slate-100"
            />
          </div>
        ) : (
          <div className="h-16 w-16 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        <label className="flex-1 cursor-pointer">
          <div className="flex items-center justify-center px-4 py-2.5 rounded-lg border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/30 text-xs font-medium text-slate-600 transition-colors">
            <svg className="w-4 h-4 mr-1.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {uploading ? 'Mengunggah...' : value ? 'Ganti Foto' : 'Unggah Foto'}
          </div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp"
            disabled={uploading}
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              setUploadingTracked(true)
              try {
                onChange(await uploadImageBase64(file))
                toast.success('Foto berhasil diunggah.')
              } catch (err: unknown) {
                toast.error(apiErrorMessage(err, 'Gagal mengunggah foto.'))
              } finally {
                setUploadingTracked(false)
              }
            }}
          />
        </label>
      </div>
    </div>
  )
}

type ProfileTab = 'couple' | 'cover' | 'quote' | 'video' | 'filter' | 'gift'
type DataTab = 'agenda' | 'rundown' | 'gallery' | 'story' | 'bank'
type ContentTab = ProfileTab | DataTab

interface TabDefinition {
  id: ContentTab
  label: string
  icon: React.ReactNode
  badge?: number
}

const PROFILE_TAB_IDS: ProfileTab[] = ['couple', 'cover', 'quote', 'video', 'filter', 'gift']

function isProfileTab(tab: ContentTab): tab is ProfileTab {
  return (PROFILE_TAB_IDS as ContentTab[]).includes(tab)
}

export default function ContentPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>('couple')
  const [form, setForm] = useState<ContentFormValues | null>(null)
  const [initialForm, setInitialForm] = useState<ContentFormValues | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [uploadingCount, setUploadingCount] = useState(0)
  const handlePhotoUploading = (b: boolean) => setUploadingCount((c) => (b ? c + 1 : Math.max(0, c - 1)))
  const toast = useToast()

  const [agendaEvents, setAgendaEvents] = useState<AgendaEvent[]>([])
  const [rundownItems, setRundownItems] = useState<RundownItem[]>([])
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryPhoto[]>([])
  const [loveStoryChapters, setLoveStoryChapters] = useState<LoveStoryChapter[]>([])
  const [giftBanks, setGiftBanks] = useState<WeddingGiftBank[]>([])
  const [loadedDataTabs, setLoadedDataTabs] = useState<Partial<Record<DataTab, true>>>({})

  // Perbaikan B1: singleton content WAJIB punya .catch -> ErrorState +
  // "Coba lagi", bukan skeleton abadi saat API gagal (meniru pola
  // GuestsPage.tsx:78-96).
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

  // 5 resource daftar data dimuat SAAT tabnya dibuka, bukan 6 request
  // serentak saat mount (D4/§8: mengurangi beban awal halaman).
  useEffect(() => {
    if (!isProfileTab(activeTab) && !loadedDataTabs[activeTab as DataTab]) {
      const tab = activeTab as DataTab
      const load = {
        agenda: () => agendaEventsResource.list().then(setAgendaEvents),
        rundown: () => rundownItemsResource.list().then(setRundownItems),
        gallery: () => galleryPhotosResource.list().then(setGalleryPhotos),
        story: () => loveStoryChaptersResource.list().then(setLoveStoryChapters),
        bank: () => giftBanksResource.list().then(setGiftBanks),
      }[tab]
      load()
        .then(() => setLoadedDataTabs((prev) => ({ ...prev, [tab]: true })))
        .catch(() => toast.error('Gagal memuat data, coba buka tab ini lagi.'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  function set<K extends keyof ContentFormValues>(key: K, value: ContentFormValues[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f))
  }

  const dirty = form !== null && initialForm !== null && JSON.stringify(form) !== JSON.stringify(initialForm)

  async function handleSave() {
    if (!form) return
    if (uploadingCount > 0) {
      toast.error('Tunggu unggahan foto selesai.')
      return
    }
    setSaving(true)
    try {
      await updateContent(form)
      setInitialForm(form)
      toast.success('Konten tersimpan.')
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Gagal menyimpan konten.'))
    } finally {
      setSaving(false)
    }
  }

  const TABS: TabDefinition[] = [
    {
      id: 'couple',
      label: 'Profil Pasangan',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      id: 'cover',
      label: 'Cover & Banner',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'quote',
      label: 'Quote & Ucapan',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
      ),
    },
    {
      id: 'video',
      label: 'Video & Streaming',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'filter',
      label: 'Instagram Filter',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        </svg>
      ),
    },
    {
      id: 'gift',
      label: 'Gift & Dresscode',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
        </svg>
      ),
    },
    {
      id: 'agenda',
      label: 'Agenda / Event',
      badge: loadedDataTabs.agenda ? agendaEvents.length : undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'rundown',
      label: 'Rundown',
      badge: loadedDataTabs.rundown ? rundownItems.length : undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'gallery',
      label: 'Galeri Foto',
      badge: loadedDataTabs.gallery ? galleryPhotos.length : undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      id: 'story',
      label: 'Love Story',
      badge: loadedDataTabs.story ? loveStoryChapters.length : undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      id: 'bank',
      label: 'Rekening Bank',
      badge: loadedDataTabs.bank ? giftBanks.length : undefined,
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
  ]

  const PROFILE_TABS = TABS.filter((t) => isProfileTab(t.id))
  const DATA_TABS = TABS.filter((t) => !isProfileTab(t.id))

  function renderNavGroup(title: string, tabs: TabDefinition[]) {
    return (
      <div>
        <p className="px-3 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
        <div className="flex flex-col gap-0.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer select-none w-full text-left',
                  isActive ? 'bg-[var(--navy-600)] text-white shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80',
                ].join(' ')}
              >
                {tab.icon}
                <span className="flex-1">{tab.label}</span>
                {typeof tab.badge === 'number' && (
                  <span
                    className={[
                      'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold',
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700',
                    ].join(' ')}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full rounded-2xl mt-4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Konten" description="Ubah teks, informasi mempelai, foto, & data undangan per section." />
        <ErrorState message="Gagal memuat konten." onRetry={() => setReloadToken((t) => t + 1)} />
      </div>
    )
  }

  if (!form) return null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Konten" description="Ubah teks, informasi mempelai, foto, & data undangan per section." />

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sub-nav vertikal 2 grup - menggantikan 11 tab horizontal yang
            butuh scroll (T4/T5: grup ini juga memisahkan tab yang
            butuh tombol Simpan global dari yang menyimpan per baris). */}
        <nav className="lg:w-56 shrink-0 flex flex-col gap-4 p-2 rounded-2xl bg-white border border-slate-200/80 shadow-xs lg:sticky lg:top-8 lg:self-start">
          {renderNavGroup('Profil & Teks', PROFILE_TABS)}
          {renderNavGroup('Daftar Data', DATA_TABS)}
        </nav>

        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* Tab Contents */}
          {activeTab === 'couple' && (
            <Card className="shadow-sm animate-in fade-in duration-150">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>Profil Pasangan</span>
                </div>
              </CardHeader>
              <CardBody className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Mempelai Wanita */}
                  <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col gap-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                      <h2 className="text-sm font-bold text-slate-800">Mempelai Wanita</h2>
                    </div>
                    <Field label="Nama Mempelai Wanita" value={form.brideName} onChange={(v) => set('brideName', v)} />
                    <Field label="Orang Tua Mempelai Wanita (HTML diperbolehkan)" value={form.brideParentsText} onChange={(v) => set('brideParentsText', v)} textarea />
                    <Field label="Instagram Mempelai Wanita (URL)" value={form.brideInstagram} onChange={(v) => set('brideInstagram', v)} placeholder="https://instagram.com/username" />
                    <PhotoField label="Foto Mempelai Wanita" value={form.bridePhotoUrl} onChange={(v) => set('bridePhotoUrl', v)} onUploadingChange={handlePhotoUploading} />
                  </div>

                  {/* Mempelai Pria */}
                  <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col gap-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200/60">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <h2 className="text-sm font-bold text-slate-800">Mempelai Pria</h2>
                    </div>
                    <Field label="Nama Mempelai Pria" value={form.groomName} onChange={(v) => set('groomName', v)} />
                    <Field label="Orang Tua Mempelai Pria (HTML diperbolehkan)" value={form.groomParentsText} onChange={(v) => set('groomParentsText', v)} textarea />
                    <Field label="Instagram Mempelai Pria (URL)" value={form.groomInstagram} onChange={(v) => set('groomInstagram', v)} placeholder="https://instagram.com/username" />
                    <PhotoField label="Foto Mempelai Pria" value={form.groomPhotoUrl} onChange={(v) => set('groomPhotoUrl', v)} onUploadingChange={handlePhotoUploading} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5 pt-5 border-t border-slate-100">
                  <Field label="Tanggal & Jam Acara" value={form.weddingDate} onChange={(v) => set('weddingDate', v)} type="datetime-local" />
                  <Field label="Hashtag" value={form.hashtag} onChange={(v) => set('hashtag', v)} placeholder="#PernikahanBahagia" />
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'cover' && (
            <Card className="shadow-sm animate-in fade-in duration-150">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Cover &amp; Banner</span>
                </div>
              </CardHeader>
              <CardBody className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <PhotoField label="Logo" value={form.coverLogoUrl} onChange={(v) => set('coverLogoUrl', v)} onUploadingChange={handlePhotoUploading} />
                  <PhotoField label="Gambar Cover (Desktop)" value={form.coverImageDesktopUrl} onChange={(v) => set('coverImageDesktopUrl', v)} onUploadingChange={handlePhotoUploading} />
                  <PhotoField label="Gambar Cover (Mobile)" value={form.coverImageMobileUrl} onChange={(v) => set('coverImageMobileUrl', v)} onUploadingChange={handlePhotoUploading} />
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'quote' && (
            <Card className="shadow-sm animate-in fade-in duration-150">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <span>Quote &amp; Ucapan</span>
                </div>
              </CardHeader>
              <CardBody className="p-6 flex flex-col gap-4">
                <Field label="Kutipan (Quote)" value={form.quoteText} onChange={(v) => set('quoteText', v)} textarea />
                <Field label="Judul Ucapan Terima Kasih" value={form.thanksTitle} onChange={(v) => set('thanksTitle', v)} />
                <Field label="Isi Ucapan Terima Kasih" value={form.thanksDescription} onChange={(v) => set('thanksDescription', v)} textarea />
              </CardBody>
            </Card>
          )}

          {activeTab === 'video' && (
            <Card className="shadow-sm animate-in fade-in duration-150">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Galeri Video &amp; Live Streaming</span>
                </div>
              </CardHeader>
              <CardBody className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Judul Galeri Video" value={form.videoGalleryTitle} onChange={(v) => set('videoGalleryTitle', v)} />
                  <Field label="URL YouTube Galeri Video" value={form.videoGalleryYoutubeUrl} onChange={(v) => set('videoGalleryYoutubeUrl', v)} placeholder="https://youtube.com/watch?v=..." />
                </div>
                <Field label="Caption Galeri Video" value={form.videoGalleryCaption} onChange={(v) => set('videoGalleryCaption', v)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <Field label="Judul Live Streaming" value={form.liveStreamingTitle} onChange={(v) => set('liveStreamingTitle', v)} />
                  <Field label="URL YouTube Live Streaming" value={form.liveStreamingYoutubeUrl} onChange={(v) => set('liveStreamingYoutubeUrl', v)} placeholder="https://youtube.com/live/..." />
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'filter' && (
            <Card className="shadow-sm animate-in fade-in duration-150">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Instagram Filter</span>
                </div>
              </CardHeader>
              <CardBody className="p-6 flex flex-col gap-4">
                <Field label="Judul" value={form.instagramFilterTitle} onChange={(v) => set('instagramFilterTitle', v)} />
                <Field label="Caption" value={form.instagramFilterCaption} onChange={(v) => set('instagramFilterCaption', v)} textarea />
                <PhotoField label="Foto Preview" value={form.instagramFilterPreviewPhotoUrl} onChange={(v) => set('instagramFilterPreviewPhotoUrl', v)} onUploadingChange={handlePhotoUploading} />
                <Field label="Link Filter Instagram" value={form.instagramFilterLink} onChange={(v) => set('instagramFilterLink', v)} placeholder="https://instagram.com/ar/..." />
              </CardBody>
            </Card>
          )}

          {activeTab === 'gift' && (
            <Card className="shadow-sm animate-in fade-in duration-150">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  <span>Wedding Gift &amp; Dresscode</span>
                </div>
              </CardHeader>
              <CardBody className="p-6 flex flex-col gap-4">
                <Field label="Deskripsi Wedding Gift" value={form.weddingGiftDescription} onChange={(v) => set('weddingGiftDescription', v)} textarea />
                <div className="pt-4 border-t border-slate-100 flex flex-col gap-4">
                  <Field label="Judul Dresscode" value={form.dresscodeTitle} onChange={(v) => set('dresscodeTitle', v)} />
                  <Field label="Deskripsi Dresscode" value={form.dresscodeDescription} onChange={(v) => set('dresscodeDescription', v)} textarea />
                  <Field label="Catatan Dresscode" value={form.dresscodeNote} onChange={(v) => set('dresscodeNote', v)} textarea />
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'agenda' && (
            <div className="animate-in fade-in duration-150">
              <SimpleListEditor<AgendaEvent>
                title="Agenda / Event"
                items={agendaEvents}
                columns={[
                  { key: 'eventLabel', label: 'Nama Acara', required: true },
                  { key: 'timeLabel', label: 'Jam', type: 'time' },
                  { key: 'venueName', label: 'Nama Gedung', required: true },
                  { key: 'venueAddress', label: 'Alamat', type: 'textarea' },
                  { key: 'city', label: 'Kota' },
                  { key: 'mapsUrl', label: 'Link Maps' },
                ]}
                emptyItem={{ eventLabel: '', timeLabel: '', venueName: '', venueAddress: '', city: '', mapsUrl: '', sortOrder: 0 }}
                onCreate={async (item) => { await agendaEventsResource.create(item); setAgendaEvents(await agendaEventsResource.list()) }}
                onUpdate={async (id, item) => { await agendaEventsResource.update(id, item); setAgendaEvents(await agendaEventsResource.list()) }}
                onDelete={async (id) => { await agendaEventsResource.remove(id); setAgendaEvents(await agendaEventsResource.list()) }}
                onUploadPhoto={uploadImageBase64}
              />
            </div>
          )}

          {activeTab === 'rundown' && (
            <div className="animate-in fade-in duration-150">
              <SimpleListEditor<RundownItem>
                title="Rundown"
                items={rundownItems}
                columns={[
                  { key: 'groupLabel', label: 'Grup' },
                  { key: 'timeLabel', label: 'Jam', type: 'time' },
                  { key: 'activityText', label: 'Aktivitas', required: true },
                ]}
                emptyItem={{ groupLabel: '', timeLabel: '', activityText: '', sortOrder: 0 }}
                onCreate={async (item) => { await rundownItemsResource.create(item); setRundownItems(await rundownItemsResource.list()) }}
                onUpdate={async (id, item) => { await rundownItemsResource.update(id, item); setRundownItems(await rundownItemsResource.list()) }}
                onDelete={async (id) => { await rundownItemsResource.remove(id); setRundownItems(await rundownItemsResource.list()) }}
                onUploadPhoto={uploadImageBase64}
              />
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="animate-in fade-in duration-150">
              <SimpleListEditor<GalleryPhoto>
                title="Galeri Foto"
                items={galleryPhotos}
                columns={[
                  {
                    key: 'photoUrl',
                    label: 'Foto',
                    type: 'photo',
                    required: true,
                    maxDim: 1920,
                    derivesTo: { key: 'thumbUrl', maxDim: 480 },
                  },
                ]}
                emptyItem={{ photoUrl: '', thumbUrl: '', sortOrder: 0 }}
                onCreate={async (item) => { await galleryPhotosResource.create(item); setGalleryPhotos(await galleryPhotosResource.list()) }}
                onUpdate={async (id, item) => { await galleryPhotosResource.update(id, item); setGalleryPhotos(await galleryPhotosResource.list()) }}
                onDelete={async (id) => { await galleryPhotosResource.remove(id); setGalleryPhotos(await galleryPhotosResource.list()) }}
                onUploadPhoto={uploadImageBase64}
              />
            </div>
          )}

          {activeTab === 'story' && (
            <div className="animate-in fade-in duration-150">
              <SimpleListEditor<LoveStoryChapter>
                title="Love Story"
                items={loveStoryChapters}
                columns={[
                  { key: 'photoUrl', label: 'Foto', type: 'photo', required: true, maxDim: 1920 },
                  { key: 'title', label: 'Judul', required: true },
                  { key: 'caption', label: 'Caption', type: 'textarea' },
                ]}
                emptyItem={{ photoUrl: '', title: '', caption: '', sortOrder: 0 }}
                onCreate={async (item) => { await loveStoryChaptersResource.create(item); setLoveStoryChapters(await loveStoryChaptersResource.list()) }}
                onUpdate={async (id, item) => { await loveStoryChaptersResource.update(id, item); setLoveStoryChapters(await loveStoryChaptersResource.list()) }}
                onDelete={async (id) => { await loveStoryChaptersResource.remove(id); setLoveStoryChapters(await loveStoryChaptersResource.list()) }}
                onUploadPhoto={uploadImageBase64}
              />
            </div>
          )}

          {activeTab === 'bank' && (
            <div className="animate-in fade-in duration-150">
              <SimpleListEditor<WeddingGiftBank>
                title="Rekening Wedding Gift"
                items={giftBanks}
                columns={[
                  { key: 'bankName', label: 'Nama Bank', required: true },
                  { key: 'accountNumber', label: 'No. Rekening', required: true },
                  { key: 'accountName', label: 'Atas Nama', required: true },
                ]}
                emptyItem={{ bankName: '', accountNumber: '', accountName: '', sortOrder: 0 }}
                onCreate={async (item) => { await giftBanksResource.create(item); setGiftBanks(await giftBanksResource.list()) }}
                onUpdate={async (id, item) => { await giftBanksResource.update(id, item); setGiftBanks(await giftBanksResource.list()) }}
                onDelete={async (id) => { await giftBanksResource.remove(id); setGiftBanks(await giftBanksResource.list()) }}
                onUploadPhoto={uploadImageBase64}
              />
            </div>
          )}

          {/* StickyActionBar hanya untuk grup "Profil & Teks" (T5) - grup
              "Daftar Data" menyimpan per baris lewat SimpleListEditor
              sendiri, tombol Simpan global di sana tidak berarti apa-apa. */}
          {isProfileTab(activeTab) && (
            <StickyActionBar dirty={dirty} saving={saving} uploading={uploadingCount > 0} onSave={handleSave} hint="Ada perubahan profil/konten belum disimpan." />
          )}
        </div>
      </div>
    </div>
  )
}
