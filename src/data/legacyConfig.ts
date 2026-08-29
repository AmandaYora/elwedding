import type {
  BankOption,
  CoverConfig,
  KadoDataConfig,
  MusicConfig,
  RsvpConfig,
  RsvpDataConfig,
} from '@/types/legacy'

/**
 * Values extracted from the original page's inline `<script>` blocks.
 * Kept as plain data here so they have one typed home instead of being
 * spread across template strings; see useLegacyBootstrap for how they're
 * attached to `window` before the platform scripts load.
 */

export const music: MusicConfig = {
  url: '/assets/audio/background-music.mp3',
  box: '#music-box',
}

export const eventTimestamp = 1778904000

export const bankOptions: BankOption[] = [
  { id: 28999, title: 'BANK BRI', credential: '001122301' },
  { id: 29001, title: 'BANK MANDIRI', credential: '10002133' },
]

export const rsvp: RsvpConfig = {
  button_text: {
    attend: 'Will Attend',
    not_attend: 'Unable To Attend',
  },
}

export const covers: CoverConfig[] = [
  {
    position: 'OPENING',
    details: { desktop: '', mobile: '' },
    element: '#cover-opening',
  },
  {
    position: 'MAIN',
    details: {
      desktop:
        '<div class="picture desktop">\n                                            <img src="/media/uploads/gif-872375-1775705339-9344566539b63ad1a7e5d2b5.gif" alt="">\n                                        </div>',
      mobile:
        '<div class="picture mobile">\n                                            <img src="/media/uploads/gif-872371-1775705325-e8e2cfa87b364b0f5d80e465.gif" alt="">\n                                        </div>',
    },
    element: '#cover-main',
  },
  {
    position: 'PANE',
    details: { desktop: '', mobile: '' },
    element: '#cover-pane',
  },
]

export const rsvpData: RsvpDataConfig = {
  post: 'rsvp_request',
  request: 'get_rsvp',
  content: '',
  template: 'template_arsya',
  changeButton: '#changeRSVP',
  amountElement: '#rsvpAmountWrap',
}

export const kadoData: KadoDataConfig = {
  post: 'post_kado_data',
  request: 'getKado',
  content: '',
  template: 'template_arsya',
}

export const langId = false as const

export const croppedSong = { start: null as number | null, end: null as number | null }

export const languageToggle = 0

export const defaultLang = 'EN'

export const manageSectionEnabled = true

export const invitationLayouts = null

export const sectionHiddenClass: Record<string, string> = {
  greet_thanks: '',
  love_story: '',
  gallery_photo: '',
  gallery_video: '',
  rsvp: '',
  live_streaming: '',
  filter_instagram: '',
  health_protocol: '',
  save_the_date: '',
}

export const defaultLayouts = null
