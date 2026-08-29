import { useEffect } from 'react'
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
 * Wires up the invitation's non-React interactivity exactly like the
 * original server-rendered page did: set the platform's `window.*` config,
 * then load its vendor plugins (AOS, Slick, Selectize, lightGallery,
 * video.js, tsParticles) and its own app bundles in the same dependency
 * order, only after React has rendered the DOM those scripts expect to
 * find and manipulate (jQuery-style, by id/class selector).
 *
 * Guarded against React StrictMode's double-invoked effects and re-mounts
 * so the legacy bundles never get injected/executed twice.
 */
export function useLegacyBootstrap() {
  useEffect(() => {
    if (bootstrapped) return
    bootstrapped = true

    window.MUSIC = legacy.music
    window.EVENT = legacy.eventTimestamp
    window.BANK_OPTIONS = legacy.bankOptions
    window.RSVP = legacy.rsvp
    window.COVERS = legacy.covers
    window.RSVP_DATA = legacy.rsvpData
    window.KADO_DATA = legacy.kadoData

    window.LANG_ID = legacy.langId
    window.CROPPED_SONG = legacy.croppedSong
    window.LANGUAGE_TOGGLE = legacy.languageToggle
    window.DEFAULT_LANG = legacy.defaultLang
    window.MANAGE_SECTION_ENABLED = legacy.manageSectionEnabled
    window.INVITATION_LAYOUTS = legacy.invitationLayouts
    window.SECTION_HIDDEN_CLASS = legacy.sectionHiddenClass
    window.DEFAULT_LAYOUTS = legacy.defaultLayouts

    async function bootstrap() {
      for (const src of LEGACY_SCRIPTS) {
        await loadScript(src)
      }
    }

    void bootstrap()
  }, [])
}
