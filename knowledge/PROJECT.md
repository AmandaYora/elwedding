# Project Brief

Undangan pernikahan digital untuk Ariana & Adrian, hasil migrasi dari
platform katsudoto.id (lihat `apps/web/README.md` untuk sejarah migrasi
HTML→React). Backend Go + dashboard admin ditambahkan agar konten,
visibility/urutan section, data tamu, musik, dan status kehadiran bisa
dikelola tanpa mengubah kode - lihat `docs/plan/admin-backend/PLAN.md`
untuk analisis lengkap (requirement, trace, keputusan terkunci, dan 20
temuan validasi Step 7 yang sudah diperbaiki).

## Skala

Satu deployment = satu pernikahan (bukan platform multi-tenant). Desain
visual & animasi undangan tetap hardcode di kode; hanya kontennya (teks per
field + foto) yang dikelola dari database.

## Fitur

1. Manage konten undangan per section (17 section, lihat `MODULE_MAP.md`).
2. Enable/disable tiap section.
3. Atur urutan tiap section.
4. CRUD data tamu (nama, telepon, pihak mempelai pria/wanita) + link
   personal bertoken untuk RSVP.
5. Setting musik latar.
6. Kelola status kehadiran tamu (belum jawab / hadir / tidak hadir / perlu
   diingatkan).
7. **Scan QR & check-in tamu di gate pada hari-H** - petugas memindai QR
   tamu (atau mencari namanya bila QR-nya hilang), sistem mencatat kehadiran
   nyata dan menampilkan nama, jumlah orang, serta jenis souvenir. Pemindaian
   kedua memperingatkan "sudah check-in" dan tidak dihitung ganda. Lihat
   `docs/plan/scan-checkin-gate/PLAN.md`.
8. **Daftar tamu masuk + ringkasan kedatangan** - nama, pihak, souvenir, dan
   jam masuk, dengan kartu jumlah masuk per pihak mempelai, total masuk, dan
   total tamu keseluruhan.
9. **Akun petugas gate berakses terbatas** - peran `scanner` hanya bisa
   membuka menu Scan & Tamu Masuk, tidak bisa mengubah konten maupun
   menghapus tamu.

## Yang di luar scope (lihat PLAN.md §4 untuk alasan lengkap)

Konten guestbook (Wedding Wish), verifikasi transfer wedding gift, upgrade
React 19 pada `apps/web`, multi-tenant, personalisasi teks sapaan per tamu.

Khusus fitur Scan (alasan lengkap di `docs/plan/scan-checkin-gate/PLAN.md`
§3.2): mode offline/antrean sinkronisasi (lokasi dipastikan online),
koreksi jumlah orang yang benar-benar masuk (tidak ada kolom
`checked_in_count`, jadi angka orang selalu berasal dari janji RSVP),
kompatibilitas QR format lama, pencatatan siapa petugas yang memindai, batal
check-in/undo, dan status check-in di halaman Reservasi/Ringkasan.

Catatan: penghitung kehadiran yang semula ditolak di §3.2 **kini ada**, tapi
sebagai menu terpisah ("Tamu Masuk"), bukan sebagai penghitung yang menempel
di layar Scan - layar Scan tetap hanya menampilkan hasil pindaian terakhir
supaya tidak memecah perhatian petugas di pintu.
