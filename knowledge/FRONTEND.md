# Frontend

`apps/web` adalah SATU paket Vite dengan **dua entry HTML** - baca
`ARCHITECTURE.md` dulu untuk kenapa, sebelum menyentuh salah satunya.

## Undangan tamu (`index.html` / `src/main.tsx`, `src/App.tsx`, `src/components/*`)

- React 18.3.1 (lihat `decisions/ADR-0004-react-18.md` untuk alasan tidak 19).
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
- **Meta Open Graph di `index.html` DITIMPA SERVER-SIDE - menyuntingnya di
  sini saja TIDAK mengubah preview produksi** (docs/plan/og-share-image-dinamis/
  PLAN.md D1/T9; menggantikan catatan lama dari revisi-uat-logo-og-nama-tamu-
  dresscode/PLAN.md R2 yang menyatakan nilainya murni statis). Blok `og:*` &
  `twitter:*` dibungkus marker `<!--OG_META_START-->` / `<!--OG_META_END-->`,
  dan `spaFallback` di `apps/api/internal/router` mengganti isi di antaranya
  dengan nama mempelai + gambar preview dari database sebelum HTML dikirim.
  Untuk mengubah preview, pakai menu admin **Konten > Cover > "Gambar Preview
  Link"**, bukan menyunting HTML.
  Nilai statis di dalam marker **tetap harus dipelihara** - itulah yang
  disajikan saat DB gagal dibaca, saat tidak ada gambar yang layak, dan di dev.
  Karena itu aturan lamanya tetap berlaku penuh untuk nilai statis tersebut:
  **WAJIB URL absolut + PNG/JPEG**. Crawler WhatsApp/Facebook **tidak
  menyelesaikan path relatif** dan **tidak merender WebP** - dua-duanya membuat
  preview link tampil hitam/kosong, dan itu bug nyata yang sudah terjadi.
  Jangan "mengoptimalkan" `og:image` PNG kembali ke `.webp`.
  Origin nilai statis **di-hardcode**, bukan lewat `%VITE_*%`: kalau env lupa
  diisi saat build, nilainya tertinggal sebagai teks mentah dan preview rusak
  lagi tanpa peringatan. (Nilai hasil injeksi memakai origin dari `Host`
  request, bukan hardcode - lihat `knowledge/BACKEND.md`.)
  Dan tidak bisa ditambal lewat JavaScript - crawler WA tidak menjalankan JS,
  jadi nilainya harus sudah benar di byte HTML yang dikirim server.
  **JANGAN menghapus kedua marker**: tanpa keduanya injeksi mati diam-diam dan
  preview kembali ke frame template.
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
- **Isi QR tamu adalah `ELW1:<token>`, bukan teks undangan** (docs/plan/
  scan-checkin-gate/PLAN.md T18/D10). `composeLocalQrPayload` di
  `RsvpConfirmation.tsx` mengembalikan `ELW1:${session.token}` bila token ada.
  Prefiks itu **kembar lintas bahasa** dengan `checkinCodePrefix` di
  `apps/api/internal/modules/guest/application/service.go` - browser tidak bisa
  memanggil konstanta Go, jadi duplikasinya tidak terhindarkan dan keduanya
  sudah diberi komentar saling merujuk (pola sama seperti `normalizePhone` vs
  `normalizePhoneForWa`). Mengubah salah satu saja memutus rantai antara QR
  yang diterbitkan dan pemindai di gate.
  **Tanpa token** (mode pratinjau, `/` tanpa `?guest=`) fungsi ini sengaja
  mengembalikan teks lama apa adanya: QR itu memang tidak mewakili tamu mana
  pun dan pemindai akan menolaknya dengan pesan yang benar - konsisten dengan
  perilaku yang sudah ada, karena RSVP-nya juga tidak tersimpan.
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
  - JWT **dan peran** di localStorage), Zod, Axios, Tailwind 4.
- **Dua peran akun** (docs/plan/scan-checkin-gate/PLAN.md T12/T13): respons
  login membawa `role`, disimpan berdampingan dengan `token` di
  `auth.store.ts`. Petugas (`scanner`) diarahkan ke `/scan` saat login,
  `AdminLayout` hanya merender item nav miliknya, dan `ProtectedRoute`
  mengalihkannya kembali ke `/scan` dari rute di luar jatahnya.
  **Semua itu KOSMETIK.** Penegakan sebenarnya ada di `authmw.RequireFullAdmin`
  di backend, yang membalas **403** untuk seluruh `/api/v1/admin/` selain
  `/checkin/*` - lihat `BACKEND.md`. Jangan pernah menjadikan penyembunyian
  menu sebagai satu-satunya pembatas.
  Peran `null` (sesi lama yang ter-rehydrate dari localStorage sebelum field
  ini ada) diperlakukan sebagai **admin penuh**, sama seperti klaim `role`
  kosong di backend - `isScannerRole()` memusatkan aturan itu.
- **Petugas punya DUA rute: `/scan` dan `/arrivals`.** Daftarnya terpusat di
  `SCANNER_ALLOWED_PATHS` (`app/routes/route-paths.ts`) dan dipakai bersama
  `ProtectedRoute` (pengalihan) serta `AdminLayout` (penyaringan menu) -
  dulu aturannya ditulis dua kali, dan itu cara paling gampang menambah menu
  yang muncul di sidebar tapi langsung memantul balik saat diklik. Tambah rute
  petugas baru = tambah satu entri di sana, bukan di dua tempat.
- **Menu Group (`/groups`, `modules/admin/groups/`) ADMIN-ONLY**
  (docs/plan/guest-groups/PLAN.md). SENGAJA **tidak** masuk
  `SCANNER_ALLOWED_PATHS`: petugas gate MELIHAT nama group di hasil scan, tapi
  tidak mengelolanya - dan `RequireFullAdmin` tetap membalas 403 kalau
  URL-nya dipaksa. CRUD-nya mengikuti struktur `UsersPage`, tanpa filter
  maupun pencarian (jumlah group puluhan).
  Kolom **"Jumlah tamu" wajib ada**: dialah yang menjelaskan kenapa sebuah
  group tidak bisa dihapus, sebelum admin mencobanya. Pesan penolakan hapus
  diambil **apa adanya dari respons backend** (`apiErrorMessage`) - jangan
  menulis ulang kalimat "masih dipakai N tamu" di frontend; hanya server yang
  punya hitungan segar.
- **Form tamu MEWAJIBKAN group, dan `GuestsPage` wajib menangani dua alur
  terputus yang lahir dari kewajiban itu** (guest-groups §2.5). Keduanya
  menghasilkan dropdown group kosong tapi **sebabnya beda, jadi pesannya
  beda**:
  1. *Belum ada group sama sekali* (instalasi baru) -> panel amber + tautan ke
     `/groups`. Tanpa ini menu Tamu **mati total**: form mewajibkan group
     sementara dropdown-nya tidak punya satu pun pilihan.
  2. *Daftar group gagal dimuat* -> panel rose + tombol "Coba lagi"; daftar
     tamu di bawahnya TETAP terbaca.
  Di kedua keadaan itu tombol "+ Tambah tamu" nonaktif dengan `title` yang
  menyebut sebabnya. Jangan menyatukan kedua pesan.
  Nama group di kolom tabel **dipetakan di frontend** dari `listAllGroups()`
  yang dimuat sekali (D2) - backend sengaja hanya mengirim `groupId`, jadi
  tidak ada JOIN maupun query per baris. `groupId` null = tamu lama yang belum
  bergroup, ditampilkan sebagai "—". `listAllGroups()` memakai `limit: 100`
  (`pagination.MaxLimit` di backend) - **batas yang diketahui**; menaikkan
  angkanya sendirian tidak berefek, backend memotongnya kembali.
- **Kartu hasil Scan menampilkan group sebagai baris teks** di bawah nama,
  berdampingan dengan pihak & status RSVP - **bukan** kartu besar sejajar
  "Jumlah orang"/"Souvenir". Kedua kartu itu dipilih karena mengubah tindakan
  TANGAN petugas; group adalah konteks. `groupName` datang sudah ter-resolve
  dari server (petugas tidak bisa memanggil `/api/v1/admin/groups`) dan boleh
  kosong - kartu wajib tetap utuh saat itu terjadi.
- **`/arrivals` ("Tamu Masuk")** menampilkan daftar tamu yang sudah tiba
  (nama, pihak, souvenir, jam masuk - terbaru di atas, berpaginasi 20) plus
  empat kartu ringkasan dan satu bilah progres yang memecah kedatangan per
  pihak mempelai. Dua permintaannya (`listArrivals` + `getCheckinSummary`)
  dijalankan **paralel lewat `Promise.all`**, bukan berurutan - perangkat gate
  belum tentu bersinyal kencang.
  Angka **"± N orang" wajib tetap diberi tanda perkiraan**: ia berasal dari
  `attendingCount` yang dijanjikan tamu saat RSVP, bukan hitung kepala di
  pintu. Menghapus tanda "±" atau catatan kecil di bawah bilah progres akan
  mengubahnya jadi klaim yang tidak bisa dibuktikan.
  Halaman ini **lazy** dan mendapat chunk sendiri (~7 kB) yang terpisah dari
  `ScanPage` - membuka daftar tidak ikut menarik pustaka kamera 465 kB.
- **Halaman Scan (`modules/admin/scan/`) BUTUH HTTPS.** `getUserMedia` hanya
  tersedia di secure context, jadi menguji lewat IP LAN ber-`http://` **tidak
  akan bisa membuka kamera** - pakai `localhost` (dianggap secure) atau
  terowongan HTTPS. Produksi sudah HTTPS.
  - Satu-satunya rute yang diimpor **lazy** (`React.lazy` + `Suspense`),
    berbeda dari rute admin lain yang eager: `@zxing/browser` sekitar 465 kB
    dan mayoritas pengguna tidak pernah membuka Scan. Terbukti terpisah jadi
    chunk `ScanPage-*.js` sendiri di hasil `npm run build:web`.
  - Stream kamera **wajib dihentikan saat unmount** - kamera yang menyala
    terus menguras baterai perangkat gate sepanjang acara.
  - **Empat keadaan harus terlihat berbeda**: berhasil check-in, sudah
    check-in sebelumnya (dengan jamnya), QR/tamu ditolak, dan **permintaan
    gagal terkirim**. Yang terakhir sengaja memakai warna **netral, bukan
    merah**: karena mode online-only, gangguan sinyal adalah kegagalan yang
    paling mungkin terjadi di gate, dan petugas harus tahu tamunya belum
    tercatat lalu mengulang - bukan menyangka QR tamu itu palsu dan menahannya
    di pintu. Membedakannya dilakukan dengan memeriksa **ada-tidaknya
    `err.response`**, bukan status code.
  - Pindaian berulang **diredam** (kode identik diabaikan beberapa detik):
    kamera mengirim frame terus-menerus, jadi satu QR yang tertahan di depan
    lensa akan menembak API puluhan kali per detik tanpa itu.
  - Izin kamera ditolak **tidak boleh membuat halaman buntu** - pencarian nama
    tetap jalan sebagai jalur cadangan petugas.
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
  selalu keluar PNG **tanpa flatten latar apa pun**; `"jpeg"` **selalu** JPEG
  (quality 0.85 + flatten `#ffffff`) **apa pun dukungan WebP browser** -
  dipakai field "Gambar Preview Link" karena crawler WhatsApp tidak merender
  WebP dan PNG fotografis 1200x630 bisa 1-2,5 MB sehingga preview berisiko
  diam-diam tidak muncul (docs/plan/og-share-image-dinamis/PLAN.md K3/D9).
  `"jpeg"` adalah **satu-satunya** format yang **MENOLAK** sumber GIF/WebP
  alih-alih meneruskannya lewat passthrough - `accept` pada `<input>` cuma
  filter dialog, bukan penegakan, jadi penolakannya harus di pipeline.
  Field yang butuh
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
