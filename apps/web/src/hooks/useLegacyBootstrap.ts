import { useEffect } from 'react'
import type { InvitationData } from '@/types/api'
import * as legacy from '@/data/legacyConfig'

const LEGACY_SCRIPTS = [
  '/vendor/tsparticles/tsparticles.bundle.min.js',
  '/vendor/aos/dist/aos.js',
  '/vendor/slick/slick.min.js',
  '/vendor/selectize/dist/js/standalone/selectize.min.js',
  '/vendor/modal-video/js/jquery-modal-video.min.js',
  '/vendor/lightgallery/dist/js/lightgallery.min.js',
  '/vendor/video-js/video.min.js',
  '/vendor/videojs-youtube/Youtube.min.js',
  '/assets/js/html2canvas-1.4.1.1787212065.js',
  '/assets/js/universal.js',
  '/assets/js/fddf2641.js',
  '/assets/js/39d8abba.js',
]

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = false
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.body.appendChild(script)
  })
}

let bootstrapped = false

/**
 * Reset-only untuk test (production code tidak pernah memanggil ini).
 */
export function __resetLegacyBootstrapForTest() {
  bootstrapped = false
}

/**
 * Sama seperti sebelumnya (set window.* lalu load script legacy secara
 * berurutan), TAPI sekarang sumber datanya `data` (hasil fetch API), bukan
 * `legacyConfig.ts` statis, dan efeknya WAJIB digerbangi `ready` (PLAN.md
 * §5.3 aturan 4 / F6): bundle `fddf2641.js` membaca
 * `document.querySelectorAll("[data-section-order]")` SEKALI saat file itu
 * dieksekusi dan langsung `return` kalau elemennya belum ada - jadi harus
 * dipastikan React sudah selesai mem-paint section sebelum script dimuat
 * (requestAnimationFrame, dijalankan setelah commit).
 */
export function useLegacyBootstrap(data: InvitationData | null, ready: boolean) {
  useEffect(() => {
    if (!ready || !data || bootstrapped) return
    bootstrapped = true

    const { content } = data

    window.MUSIC = { url: content.musicUrl, box: '#music-box' }

    // keputusan #16 (PLAN.md F18): epoch DETIK dari backend - JANGAN
    // `new Date(string)` di browser, supaya countdown tidak bergeser di
    // luar timezone WIB.
    window.EVENT = content.weddingDateUnix

    // keputusan #15 (PLAN.md F16): #cover-main dihapus & ditulis ulang oleh
    // jQuery ($(el).html("") lalu append) - gambar cover TIDAK bisa lewat
    // props React, harus lewat window.COVERS.
    window.COVERS = [
      { position: 'OPENING', details: { desktop: '', mobile: '' }, element: '#cover-opening' },
      {
        position: 'MAIN',
        element: '#cover-main',
        details: {
          desktop: `<div class="picture desktop"><img src="${content.coverImageDesktopUrl}" alt=""></div>`,
          mobile: `<div class="picture mobile"><img src="${content.coverImageMobileUrl}" alt=""></div>`,
        },
      },
      { position: 'PANE', details: { desktop: '', mobile: '' }, element: '#cover-pane' },
    ]

    // Dipakai dropdown pilih-bank di form Wedding Gift (selectize, dibaca
    // fddf2641.js `init_wedding_gift`) - diisi dari data yang sama dengan
    // yang ditampilkan WeddingGift.tsx, bukan lagi hardcode legacyConfig.
    window.BANK_OPTIONS = data.giftBanks.map((b) => ({
      id: b.id,
      title: b.bankName,
      credential: b.accountNumber,
    }))

    // Tidak berubah - widget RSVP lama & fitur gift/guestbook di luar scope
    // (PLAN.md §4), backend-nya memang tidak dibuat.
    window.RSVP = legacy.rsvp
    window.RSVP_DATA = legacy.rsvpData
    window.KADO_DATA = legacy.kadoData
    window.LANG_ID = legacy.langId
    window.CROPPED_SONG = legacy.croppedSong
    window.LANGUAGE_TOGGLE = legacy.languageToggle
    window.DEFAULT_LANG = legacy.defaultLang
    window.SECTION_HIDDEN_CLASS = legacy.sectionHiddenClass // dipertahankan apa adanya (F10)

    // keputusan #8 (F3): WAJIB true, kalau tidak seluruh apply
    // reorder/enable di sortSectionsByLayout tidak pernah dijalankan.
    window.MANAGE_SECTION_ENABLED = true

    // keputusan #6 (F1): OBJECT MAP {key: {enabled, order}}, BUKAN array -
    // sortSectionsByLayout meng-index window.INVITATION_LAYOUTS[section_key].
    window.INVITATION_LAYOUTS = Object.fromEntries(
      data.sections.map((s) => [s.key, { enabled: true, order: s.order }]),
    )

    async function bootstrap() {
      for (const src of LEGACY_SCRIPTS) {
        await loadScript(src)
      }
    }

    // Tunggu paint (F6): fddf2641.js membaca DOM section sekali saat
    // dieksekusi, harus dipastikan sudah ter-render.
    requestAnimationFrame(() => {
      void bootstrap()
    })
  }, [ready, data])
}
