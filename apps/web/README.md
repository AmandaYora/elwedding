# Ariana & Adrian — Wedding Invitation

A React 18 + TypeScript + Vite port of the "arsya" katsudoto.id wedding
invitation template — same design, same content, same interactivity.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build       # production build to dist/
npm run typecheck   # tsc -b --noEmit
npm run lint         # eslint .
```

## Structure

```
index.html               Vite entry: meta tags, self-hosted @font-face
                          blocks, vendor <link> tags, the instant
                          loading-screen bootstrap script, then <div id="root">
src/
  main.tsx               ReactDOM root
  App.tsx                 Assembles every section in the original page order
  components/             One component per section (PascalCase folder + .tsx),
                           matching the original page's data-section-order:
                           PrimaryPane, TopCover, Cover, Couple, SaveTheDate,
                           Quote, Agenda (+ its RSVP call-to-action), Rundown,
                           PhotoGallery, VideoGallery, LiveStreaming, LoveStory,
                           WeddingGift, InstagramFilter, Notes, WeddingWish,
                           Footnote, Footer, MusicPlayer, AlertModal
  data/legacyConfig.ts     Typed content the legacy bundles read from `window.*`
                           (music, event date, bank accounts, RSVP copy, cover
                           media, gift/RSVP endpoints, language/section flags)
  hooks/useLegacyBootstrap.ts  Sets those `window.*` globals, then loads the
                           vendor + platform scripts in dependency order
  types/legacy.d.ts        Window/jQuery ambient type declarations

public/
  assets/                 css/ js/ fonts/ icons/ audio/ (self-hosted, offline)
  vendor/                 aos/ flexbin/ lightgallery/ modal-video/ selectize/
                          slick/ video-js/ videojs-youtube/ font-awesome/
                          tsparticles/ phosphor-icons/
  media/                  template/arsya (ornaments) kat/ photos/ uploads/
                          youtube-thumbs/
```

## Why the legacy scripts are still global `<script>` tags

The page's actual interactivity — RSVP, the photo/video galleries, sliders,
the countdown, the music player, scroll animations, bank-tab switching,
guestbook — is driven entirely by the katsudoto.id platform's own compiled
JS bundles (`public/assets/js/{universal,fddf2641,39d8abba,1e92684f}.js`)
plus a handful of jQuery plugins (AOS, Slick, Selectize, lightGallery,
video.js). That's proprietary, minified, third-party code with no source
available — reimplementing its behavior in React state would be guesswork
with real regression risk.

Instead, this port keeps that layer exactly as it was: React's only job is
to render the same markup (same ids, same classes, same data-* attributes)
those scripts already expect to find, and `useLegacyBootstrap` loads them
— in the same order, against the config in `legacyConfig.ts` — right after
React mounts. The result is byte-faithful markup with 100% of the original
behavior, verified by loading the page and confirming jQuery/AOS/Slick/
Selectize/lightGallery/video.js/tsParticles all initialize (4 sliders,
387 AOS-animated elements, 9 lightGallery links) with no visual difference
from the pre-migration static build.

## Inherent limitations (unrelated to this migration)

Same as before the React port — these depend on katsudoto.id's live backend
or on YouTube, not on how the frontend is built:

- The wedding-wishes/guestbook form and visit counter POST back to the
  page's own URL, expecting a live PHP backend.
- The "download as image" feature calls a server-side screenshot proxy.
- The two videos are embedded YouTube videos — playing them needs internet.
- An optional, non-blocking connectivity check pings `speed.cloudflare.com`
  / `google.com`; harmless if it fails offline.
