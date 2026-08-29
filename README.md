# Ariana & Adrian — Wedding Invitation

Static HTML wedding invitation (katsudoto.id "arsya" template). Single page,
no build step, fully self-contained — open `index.html` directly or serve
the folder with any static file server.

## Structure

```
index.html     The invitation page (only page in the project)

assets/
  css/         Page stylesheets
  js/          Page scripts (jquery, universal.js, html2canvas)
  fonts/       Self-hosted webfonts (Roboto, Cormorant Upright, Ovo, Kapakana)
  icons/       Small template icons (dress code, etc.)
  audio/       Background music

vendor/        Third-party libraries, one folder per library
  aos/ flexbin/ lightgallery/ modal-video/ selectize/ slick/
  video-js/ videojs-youtube/ font-awesome/ tsparticles/ phosphor-icons/

media/
  template/arsya/    Decorative template artwork (ornaments, frames, masks)
  kat/               Shared platform media (logo, icons)
  photos/            Couple & gallery photos
  uploads/           Cover images + loading-screen logo
  youtube-thumbs/    Cached YouTube video thumbnails

cdn-cgi/       Cloudflare bot-challenge script (left untouched, path-sensitive)
```

## What changed from the original mirror

This started as a raw HTTrack mirror of the live site (domain-named folders,
a separate "Dreamboard" editor page, Google Tag Manager, and ~30 assets still
loaded live from external CDNs). It's now a single, fully offline template:

- Removed the editor/"Dreamboard" page and its exclusive libraries (select2,
  pickr, color-thief) — only the public invitation page remains.
- Removed Google Tag Manager (script + noscript iframe).
- Downloaded and self-hosted everything that was still loading live:
  - All 27 couple/gallery photos (previously served through the
    `img.katsudoto.id` resize proxy) → `media/photos/`.
  - The background music track → `assets/audio/`.
  - The loading-screen logo → `media/uploads/loading-logo.png` (this also
    fixes a broken source path that existed in the original page, which
    caused that image to fail silently on every load).
  - The "Kapakana" heading font (was loaded live from Google Fonts on every
    visit) → `assets/fonts/kapakana/` (latin + latin-ext subsets only).
  - Phosphor icons (previously a live loader script pulling 6 full icon
    font families from unpkg for 2 icons actually used) → self-hosted
    `vendor/phosphor-icons/{regular,fill}/`, just the 2 weights in use.
- Removed now-redundant Google Fonts `<link rel="preload">` hints (the
  actual fonts were already self-hosted).
- Fixed a mask/background image (`mask-couple.png`) that 404'd due to how
  CSS custom properties resolve `url()` values across files.

## Inherent limitations (not fixable by restructuring)

A few features are part of the katsudoto.id platform's live backend and
cannot work offline no matter how the files are organized:

- The wedding-wishes/guestbook form and visit counter POST back to the
  page's own URL, expecting a live PHP backend on katsudoto.id's servers.
- The "download as image" feature calls a server-side screenshot proxy
  (`katsudoto.id/html2canvasproxy.php`).
- The two videos are embedded YouTube videos — playing them always
  requires internet, since the video itself is hosted on YouTube.
- `assets/js/universal.js` does an optional, non-blocking connectivity
  check against `speed.cloudflare.com` / `google.com` — harmless if it
  fails offline.

None of these affect the page loading or displaying correctly offline.
