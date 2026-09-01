# ADR-0001: `apps/web` tetap React 18.3.1, bukan React 19

**Status:** Diterima. **Konteks:** implementasi `docs/plan/admin-backend/PLAN.md`.

## Konteks

Standar `monorepo-standard` mengunci frontend ke React 19 + Tailwind 4
(lihat `frontend.md`). Project ini sebelumnya (`ariana-adrian-invitation`)
adalah hasil migrasi HTML statis ke React 18.3.1, dengan seluruh
interaktivitas (RSVP, galeri, slider, countdown, musik, animasi scroll)
didorong oleh bundle jQuery pihak ketiga terkompilasi
(`public/assets/js/{universal,fddf2641,39d8abba,1e92684f}.js`) yang
memanipulasi DOM milik React secara langsung (`$(el).html("")`,
`.remove()`, `.appendChild()`) - lihat `apps/web/README.md` dan
`docs/plan/admin-backend/PLAN.md` §2.5.

## Keputusan

`apps/web` (baik entry undangan tamu `index.html` maupun entry admin
`admin.html`, karena keduanya satu paket npm/satu versi React) tetap di
React 18.3.1. **Tidak** upgrade ke React 19 sebagai bagian dari pekerjaan
ini.

## Alasan

Interop DOM manipulation langsung dari jQuery ke node yang dikelola React
sudah terverifikasi bekerja di React 18 (387 elemen AOS, integrasi jQuery
penuh - `apps/web/README.md`). Melakukan upgrade mayor React di saat yang
sama dengan perubahan arsitektur besar (backend baru, data-driven
rendering, pemisahan section) akan membuat sumber regresi tidak bisa
diisolasi kalau sesuatu rusak - tidak jelas apakah penyebabnya perubahan
arsitektur atau perubahan versi React.

## Konsekuensi

- Deviasi eksplisit dari `frontend.md` standar skill `monorepo-standard`.
- `package.json` di `apps/web` mengunci `react`/`react-dom` ke `^18.3.1`,
  bukan `^19.0.0`.
- Upgrade ke React 19 tetap mungkin dilakukan **sebagai pekerjaan
  terpisah** setelah arsitektur ini stabil di produksi, dengan regresi
  visual/interaktivitas diuji ulang secara independen dari perubahan lain.
