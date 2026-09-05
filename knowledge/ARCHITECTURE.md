# Architecture

## Apps

- `apps/api` — Go modular monolith. 4 modul: `auth`, `content`, `guest`,
  `whatsapp` (lihat `MODULE_MAP.md`). `net/http` `ServeMux` (Go 1.22+
  pattern matching), tanpa framework HTTP tambahan. `whatsapp` adalah
  modul pertama yang mengekspos `contracts/` nyata dan dikonsumsi modul
  lain (`guest` mengonsumsi `content/contracts.InvitationInfoProvider` &
  `whatsapp/contracts.Sender`) - arah ketergantungan searah
  `content -> guest -> whatsapp`, tanpa siklus, tanpa satu pun modul saling
  mengimpor internal (`application`/`infrastructure`/`domain`) modul lain.
- `apps/web` — satu paket Vite, **dua entry HTML terpisah**:
  - `index.html` (`src/main.tsx`) — undangan tamu. React 18.3.1 (BUKAN 19 —
    lihat `decisions/ADR-0004-react-18.md`), tanpa Tailwind, sepenuhnya
    bergantung pada bundle jQuery legacy pihak ketiga
    (`public/assets/js/*`) untuk animasi/slider/countdown/musik.
  - `admin.html` (`src/admin-main.tsx`) — dashboard admin. React Router,
    Zustand, Zod, Axios, Tailwind 4. Tidak pernah memuat CSS/JS legacy.
  - Alasan dua entry terpisah: `index.html` memuat jQuery + CSS vendor +
    `body class="arsya"` secara global; kalau digabung satu entry, CSS
    Tailwind bocor ke undangan tamu dan sebaliknya (PLAN.md keputusan
    #10/F9). Dikonfirmasi terisolasi di level build - `admin-*.css` hanya
    direferensikan `admin.html`, `main-*.js` tidak memuat store Zustand
    admin (lazy-imported).

## Alur data undangan tamu (kritis, baca PLAN.md §2.3/§2.5/§5.3 sebelum
mengubah `App.tsx`/`useLegacyBootstrap.ts`/`Cover.tsx`/`RsvpConfirmation.tsx`)

1. `useInvitationData` fetch `GET /api/v1/public/invitation` sekali (tanpa
   polling/refetch - re-render ulang berisiko crash `removeChild` karena
   bundle legacy memindahkan node section lewat `appendChild`/`remove`).
2. `App.tsx` merender section sesuai `data.sections` (hanya yang enabled,
   backend sudah menormalisasi `order` 1..N) lewat `SectionRegistry` -
   TANPA elemen wrapper (bundle legacy menghitung parent lewat
   `a[0].parentNode`).
3. `useLegacyBootstrap` baru boleh jalan setelah DOM ter-paint
   (`requestAnimationFrame`) dan `ready===true`: mengisi
   `window.INVITATION_LAYOUTS` (object map `{key: {enabled, order}}` -
   BUKAN array), `window.MANAGE_SECTION_ENABLED=true`,
   `window.EVENT` (epoch detik, keputusan #16), `window.COVERS` (gambar
   cover - keputusan #15, karena `#cover-main` ditimpa jQuery
   `$(el).html("")`), `window.BANK_OPTIONS`, lalu memuat
   `LEGACY_SCRIPTS` berurutan.
4. `RsvpConfirmation` terhubung ke `useGuestSession` (token dari
   `?guest=<token>`) dan mem-PATCH status RSVP hanya jika ada token.

## Kenapa server Go menolak semua request non-GET yang tidak dikenal dengan
JSON 404 (bukan fallback HTML)

Bundle legacy (`fn_rsvp_init`, `wedding_gift_form`, dst.) mem-POST ke URL
halaman sendiri. Kalau server pernah membalas HTML atau JSON yang
kebetulan cocok dengan bentuk yang diharapkan, jQuery bisa menghapus DOM
React (`$(el).html(...)`) atau memicu `window.location.reload()`. Lihat
`internal/router/router.go` (`spaFallback`) dan PLAN.md §2.5/keputusan
#17/F17/F20.
