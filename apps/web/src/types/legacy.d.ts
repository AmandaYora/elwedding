export {}

/**
 * The invitation's interactive behavior (RSVP, gift bank tabs, guestbook,
 * gallery, sliders, countdown, music player, loading screen...) is driven
 * entirely by the bundled scripts
 * (public/assets/js/{universal,fddf2641,39d8abba,1e92684f}.js) plus a
 * handful of jQuery-based vendor plugins. We don't own that source - it's
 * loaded as opaque global scripts, exactly as it was in the original
 * server-rendered page, and it reads its configuration from these
 * `window.*` globals. React's job is only to render the same markup those
 * scripts expect to find; see src/hooks/useLegacyBootstrap.ts.
 */
declare global {
  interface Window {
    $: JQueryStatic
    jQuery: JQueryStatic

    LOADING_LOGO_TYPE?: string
    CUSTOM_LOGO?: string
    CUSTOM_TEXT?: string
    COLOR_CUSTOM_TEXT?: string
    CUSTOM_LOADING_TEXT?: string
    COLOR_CUSTOM_LOADING_TEXT?: string
    BACKGROUND_COLOR?: string
    USING_EFFECT?: number
    EFFECT?: number
    EFFECT_VOLUME?: string
    EFFECT_SPEED?: string
    isDreamboard?: boolean
    DREAMBOARD_JSON?: string
    designTempId?: number

    MUSIC?: MusicConfig
    EVENT?: number
    BANK_OPTIONS?: BankOption[]
    RSVP?: RsvpConfig
    COVERS?: CoverConfig[]
    RSVP_DATA?: RsvpDataConfig
    KADO_DATA?: KadoDataConfig

    LANG_ID?: false | string
    CROPPED_SONG?: { start: number | null; end: number | null }
    LANGUAGE_TOGGLE?: number
    DEFAULT_LANG?: string
    MANAGE_SECTION_ENABLED?: boolean
    INVITATION_LAYOUTS?: unknown
    SECTION_HIDDEN_CLASS?: Record<string, string>
    DEFAULT_LAYOUTS?: unknown

    /** Defined by the loading-screen bundle (public/assets/js/1e92684f.js); invoked by the cover's "Open Invitation" button. */
    startTheJourney?: () => void
  }
}

// Minimal ambient type for the vendored jQuery build - it's a UMD global,
// not an npm package here, so `jquery`'s own @types don't apply. `any` is
// deliberate: this stands in for an untyped legacy plugin API surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JQueryStatic = ((selector: unknown) => any) & Record<string, any>

export interface MusicConfig {
  url: string
  box: string
}

export interface BankOption {
  id: number
  title: string
  credential: string
}

export interface RsvpConfig {
  button_text: {
    attend: string
    not_attend: string
  }
}

export interface CoverConfig {
  position: 'OPENING' | 'MAIN' | 'PANE'
  details: {
    desktop: string
    mobile: string
  }
  element: string
  options?: unknown
}

export interface RsvpDataConfig {
  post: string
  request: string
  content: string
  template: string
  changeButton: string
  amountElement: string
}

export interface KadoDataConfig {
  post: string
  request: string
  content: string
  template: string
}
