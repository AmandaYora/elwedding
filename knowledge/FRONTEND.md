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
- **Meta Open Graph di `index.html` WAJIB URL absolut + PNG/JPEG** (docs/plan/
  revisi-uat-logo-og-nama-tamu-dresscode/PLAN.md R2). Crawler WhatsApp/Facebook
  **tidak menyelesaikan path relatif** dan **tidak merender WebP** - dua-duanya
  membuat preview link tampil hitam/kosong, dan itu bug nyata yang sudah
  terjadi. Jangan "mengoptimalkan" `og:image` PNG kembali ke `.webp`.
  Origin **di-hardcode**, bukan lewat `%VITE_*%`: kalau env lupa diisi saat
  build, nilainya tertinggal sebagai teks mentah dan preview rusak lagi tanpa
  peringatan. Dan tidak bisa ditambal lewat JavaScript - crawler WA tidak
  menjalankan JS, jadi nilainya harus sudah absolut di HTML statis.
- **Nama tamu di `TopCover`** memakai `useGuestSession()` yang dipanggil
  **langsung di komponen** (pola sama seperti `RsvpConfirmation`), bukan
  dialirkan sebagai prop lewat `SectionRegistry`/`App.tsx`. Hook-nya
  **memoisasi promise per token** di level modul, jadi dua konsumen tetap
  memicu satu request `by-token`. Fallback tanpa token WAJIB
  `Dear Mr/Mrs/Ms` - **jangan** mencetak `session.name` apa adanya, karena
  `DEFAULT_SESSION.name` adalah `'Tamu Undangan'`. Pakai penanda
  `session.resolved`; itu juga yang menutup jendela "token ada tapi fetch
  belum selesai".
- **Dress code**: ikon dress + palet warna yang dulu hardcode sudah diganti
  **satu gambar** dari admin (`dresscodeImageUrl`, PNG `lossless`). Dirender
  **bersyarat** - nilai `''` berarti belum ada gambar, dan `<img src="">`
  memicu request ke URL halaman itu sendiri. Judul/deskripsi/Catatan tetap
  dari `dresscodeTitle`/`dresscodeDescription`/`dresscodeNote`. Selektor
  `.dress-color-item`/`--bg-color` di `4e66ef9e.css` jadi tidak terpakai tapi
  **sengaja tidak dihapus** - berkas itu aset template ter-minify bersama.
- **Form "Fill the form below" di section Wedding Gift sudah dihapus** dan
  jangan dikembalikan: itu kode mati sisa template PHP (`action="#"`,
  `post=sendGift`) dan **tidak ada endpoint** gift submission di backend.
  Daftar rekening tetap ada; `#weddingGiftForm` sekarang `<div>` dengan `id`
  yang sama supaya CSS dan animasi slide jQuery tidak kehilangan target.
  Tombol salin rekening bergantung pada atribut `[data-copy]` (handler
  delegasi di `universal.js`), bukan pada kelas `.bank-copy`.

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
  (docs/plan/admin-content-image-format-pipeline/PLAN.md T5). Output
  ditentukan **PER-FIELD** lewat parameter `format` (docs/plan/
  admin-content-png-lossless-galeri-tajam/PLAN.md K1/K2), bukan ditebak
  dari isi gambar: `"lossy"` (default) mengonversi PNG/JPEG ke WebP lewat
  canvas (fallback JPEG bila browser tak punya encoder WebP, dideteksi via
  probe `canEncodeWebp`, bukan ditebak dari hasil `toBlob`); `"lossless"`
  selalu keluar PNG **tanpa flatten latar apa pun**. Field yang butuh
  transparansi (mis. Logo di `ContentPage.tsx`) HARUS memakai `"lossless"` -
  memakai `"lossy"` di situ berisiko latar transparan dibakar putih kalau
  browser jatuh ke fallback JPEG (JPEG tidak mendukung alpha; bug nyata
  yang sudah terjadi, lihat `encodeTargetFor` di `image-compress.ts`).
  Flatten `#ffffff` di `drawToCanvas` hanya sah untuk target JPEG - jangan
  pernah dipanggil dengan `background` pada target PNG. **GIF dan WebP
  WAJIB diteruskan apa adanya, TANPA createImageBitmap/canvas, pada KEDUA
  format** - canvas hanya mengambil frame pertama dan akan membunuh
  animasi GIF secara senyap (cover animasi dipakai produksi, lihat
  `Cover.tsx` + `shared/lib/coverMedia.ts`). Jangan menambah format baru
  ke jalur konversi tanpa memastikan dulu apakah formatnya beranimasi.
- **Peringatan alpha pada field `lossless`** (docs/plan/
  revisi-uat-logo-og-nama-tamu-dresscode/PLAN.md D2): setelah decode,
  `prepareImageForUpload` menjalankan `probeAlpha` **sekali** (kanvas probe
  64x64, bukan gambar ukuran penuh) dan melaporkan hasilnya lewat
  `CompressedImage.hasAlpha`; `uploadImageBase64` meneruskannya ke pemanggil
  lewat **callback opsional keempat** `onAlphaInfo`. Kalau field `lossless`
  menerima gambar tanpa area transparan, `PhotoField` **memperingatkan** admin
  tapi **tetap menerima** unggahannya - ini bukan penolakan, dan bukan
  pemindah format otomatis. `hasAlpha === undefined` berarti **tidak
  diketahui** (jalur passthrough GIF/WebP), bukan "tidak transparan" - jangan
  memperingatkan untuk kasus itu.
  Nilai kembalian `uploadImageBase64` **WAJIB tetap `Promise<string>`**: ia
  dipasang langsung sebagai `onUploadPhoto={uploadImageBase64}` di lima
  `SimpleListEditor`, jadi mengubah bentuknya menggagalkan typecheck di
  kelima tempat itu.
  Preview field `lossless` memakai **latar kotak-kotak + `object-contain`**;
  dengan latar solid + `object-cover`, PNG transparan dan PNG berlatar putih
  terlihat identik - itu yang membuat bug logo berlatar putih lolos ke
  produksi tanpa disadari.

## Shared

`src/shared/services/http-client.ts` - satu instance Axios untuk
keduanya. Header `Authorization` hanya ditempel ke path
`/api/v1/admin/*`, dan store Zustand di-`import()` dinamis di dalam
interceptor supaya kode admin tidak ikut ter-bundle ke chunk undangan
tamu (dikonfirmasi lewat `npm run build` - `main-*.js` tidak memuat
`auth.store`).
