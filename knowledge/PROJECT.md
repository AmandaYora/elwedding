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

## Yang di luar scope (lihat PLAN.md §4 untuk alasan lengkap)

Konten guestbook (Wedding Wish), verifikasi transfer wedding gift, upgrade
React 19 pada `apps/web`, multi-tenant, personalisasi teks sapaan per tamu.
