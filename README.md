# Ariana & Adrian — Wedding Invitation

Static HTML wedding invitation (katsudoto.id "arsya" template). No build step —
open `index.html` directly or serve the folder with any static file server.

## Structure

```
index.html     Public invitation page
editor.html    Platform "Dreamboard" design-editor view of the same invitation
gtm.html       Local Google Tag Manager bootstrap frame

assets/
  css/         Compiled page stylesheets + dreamboard.css (editor.html only)
  js/          Page scripts (jquery, universal.js, html2canvas, module/popover.js)
  fonts/       Self-hosted webfonts (Roboto, Cormorant Upright, Ovo)
  icons/       Small template icons (dress code, etc.)

vendor/        Third-party libraries, one folder per library
  aos/ flexbin/ lightgallery/ modal-video/ selectize/ slick/
  video-js/ videojs-youtube/ font-awesome/ tsparticles/
  select2/ pickr/ color-thief/     (last three: editor.html only)

media/
  template/arsya/    Decorative template artwork (ornaments, frames, masks)
  kat/               Shared platform media (logo, icons)
  uploads/           Per-invitation uploaded media (cover images)
  youtube-thumbs/    Cached YouTube video thumbnails

cdn-cgi/       Cloudflare bot-challenge script (left untouched, path-sensitive)
```

## Notes

- This is a reorganized HTTrack mirror of the live site — folder names no
  longer mirror source domains (`cdn.jsdelivr.net/`, `katsudoto.id/`, etc.);
  every reference was rewritten to the new relative paths and verified.
- Several assets are intentionally **not** local and require internet access,
  exactly as on the live site: couple/gallery photos (served through the
  `img.katsudoto.id` resize proxy), the background music track, Google Fonts
  preload hints, and Phosphor Icons (loaded from unpkg). These were never
  part of the mirror and are unrelated to this restructuring.
- `assets/js/universal.js` is shared by both `index.html` and `editor.html`
  (the mirror previously had two byte-identical copies of this file).
