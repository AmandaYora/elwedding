# Frontend

`apps/web` adalah SATU paket Vite dengan **dua entry HTML** - baca
`ARCHITECTURE.md` dulu untuk kenapa, sebelum menyentuh salah satunya.

## Undangan tamu (`index.html` / `src/main.tsx`, `src/App.tsx`, `src/components/*`)

- React 18.3.1 (lihat `decisions/0001-react-18.md` untuk alasan tidak 19).
- Kode dipindah **apa adanya** dari project pre-monorepo - jangan
  restrukturisasi ke pola `modules/` demi konsistensi; itu berisiko
  meregresi interop jQuery yang sudah terverifikasi (`apps/web/README.md`).
- Section baru HARUS didaftarkan di 3 tempat sekaligus: migration seed
  `sections` (backend), `SectionRegistry.tsx` (pemetaan key->komponen), dan
  `docs/plan/admin-backend/PLAN.md` §2.1 (dokumentasi) - kalau terlewat
  satu, section itu tidak bisa di-toggle/reorder tanpa error yang jelas
  (lihat F4 di PLAN.md, kasus nyata `footnote` yang sempat terlewat).
- Jangan menambah props ke `Cover.tsx` untuk gambar `#cover-main` - isinya
  sengaja ditimpa jQuery (`window.COVERS`, lihat `useLegacyBootstrap.ts`).

## Dashboard admin (`admin.html` / `src/admin-main.tsx`,
`src/modules/admin/*`, `src/app/routes/*`)

- React Router (`basename="/admin"`), Zustand (`shared/stores/auth.store.ts`
  - JWT di localStorage), Zod, Axios, Tailwind 4.
- `globals.css` (Tailwind) HANYA diimpor dari `admin-main.tsx` - jangan
  pernah diimpor dari `main.tsx`/komponen undangan.
- Endpoint singleton (`GET/PATCH /api/v1/admin/content`) memakai pola
  read-modify-write - lihat `modules/admin/content/services/content.service.ts`.
- 5 resource list (agenda events, dst.) memakai `SimpleListEditor`
  generik (`modules/admin/content/components/`) - tambah resource baru
  lewat konfigurasi kolom, bukan menulis ulang tabel CRUD.
- **Pipeline gambar admin** (`shared/lib/image-compress.ts`,
  `prepareImageForUpload`) menerima PNG/JPG/JPEG/GIF/WebP lewat `accept`
  di `ContentPage.tsx`/`SimpleListEditor.tsx` - format lain (HEIC/AVIF/BMP/SVG)
  sengaja tidak bisa dipilih karena gagal di-decode `createImageBitmap`
  (docs/plan/admin-content-image-format-pipeline/PLAN.md T5). PNG/JPEG
  dikonversi ke WebP lewat canvas (fallback JPEG bila browser tak punya
  encoder WebP, dideteksi via probe `canEncodeWebp`, bukan ditebak dari
  hasil `toBlob`). **GIF dan WebP WAJIB diteruskan apa adanya, TANPA
  createImageBitmap/canvas** - canvas hanya mengambil frame pertama dan
  akan membunuh animasi GIF secara senyap (cover animasi dipakai produksi,
  lihat `Cover.tsx` + `shared/lib/coverMedia.ts`). Jangan menambah format
  baru ke jalur konversi tanpa memastikan dulu apakah formatnya beranimasi.

## Shared

`src/shared/services/http-client.ts` - satu instance Axios untuk
keduanya. Header `Authorization` hanya ditempel ke path
`/api/v1/admin/*`, dan store Zustand di-`import()` dinamis di dalam
interceptor supaya kode admin tidak ikut ter-bundle ke chunk undangan
tamu (dikonfirmasi lewat `npm run build` - `main-*.js` tidak memuat
`auth.store`).
