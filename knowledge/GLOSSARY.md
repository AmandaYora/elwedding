# Glossary

> Istilah yang dipakai lintas kode, dokumen, dan percakapan di project ini.
> Yang masuk ke sini hanya istilah yang **pernah tertukar** atau yang maknanya
> tidak bisa ditebak dari namanya.

## Tamu & kehadiran

Lima hal di bawah ini terdengar mirip tapi **bukan sinonim**, dan sering
tertukar. Urutannya dari "jatah" ke "bukti":

| Istilah | Kolom | Siapa yang mengisi | Artinya |
|---|---|---|---|
| **Jatah kursi (pax quota)** | `guests.pax_quota` | Admin | Berapa orang yang BOLEH datang atas undangan ini. Ditentukan sebelum tamu menjawab. Rentang 1..20. Nilai awalnya diambil dari `guest_groups.default_pax` saat input, lalu bisa ditimpa per tamu. |
| **RSVP status** | `guests.rsvp_status` | Tamu | Jawaban tamu: `pending` / `attending` / `not_attending` / `remind_later`. Niat, bukan bukti. |
| **Diperkirakan hadir** | `guests.is_expected_attending` | Admin | Dugaan admin, terpisah dari jawaban tamu. **Hanya berlaku untuk tamu yang BELUM menjawab** - lihat catatan di bawah. |
| **Jumlah tamu (pax)** | `guests.attending_count` | Tamu | Berapa orang yang benar-benar dijanjikan saat RSVP `attending`, maksimal sebesar `pax_quota`. Sejak migration `000017` **tidak lagi** terbatas 1-2. Tetap **janji**. |
| **Check-in** | `guests.checked_in_at` | Petugas gate | Satu-satunya **bukti** tamu benar-benar tiba, dicatat saat QR dipindai di pintu. `NULL` = belum datang. |

- **Dihubungi** (`guests.contacted_at`) - kapan admin menekan "Kirim Undangan"
  dan WhatsApp terbuka. `NULL` = belum pernah. **Bukan "terkirim":** `wa.me`
  secara desain tidak bisa melaporkan balik apa pun, jadi yang tercatat
  hanyalah bahwa admin membuka percakapannya — bukan bahwa tamu menerima
  pesannya. Label di UI berbunyi "Dihubungi", dan penandanya bisa dibatalkan
  admin justru karena sistem tidak bisa memastikannya sendiri.
- **Hapus reservasi** vs **hapus tamu** - beda tombol, beda akibat, dan mudah
  tertukar karena dua-duanya berlabel "Hapus". Di menu **Reservasi** yang
  dihapus adalah *jawaban RSVP*-nya (`rsvp_status` balik ke `pending`,
  `attending_count` ke 1, `rsvp_responded_at` jadi NULL) — barisnya, token,
  QR, `pax_quota`, dan `checked_in_at` semuanya **tetap**, dan tamu bisa
  menjawab ulang. Di menu **Tamu** yang dihapus adalah barisnya, permanen.

**Jawaban tamu menang atas dugaan admin.** `is_expected_attending` hanya
dipakai untuk tamu yang belum menjawab. Begitu tamu menjawab `attending`,
`attending_count`-nya yang dihitung dan dugaan admin diabaikan. Alasannya
konkret: admin mematikan "diperkirakan hadir" untuk Om Hasan di Surabaya, lalu
Om Hasan menjawab "Hadir, 4 orang" — kalau dugaan tetap menang, empat orang
datang tanpa porsi. Dugaan dibuat *sebelum* jawaban ada; begitu tamunya
menjawab, dugaan itu kedaluwarsa. Ditegakkan di
`CountGuestsGroupedBySide` (`docs/plan/guest-pax-quota/PLAN.md` K4).

- **Pax** - jumlah orang (bukan jumlah undangan). Satu baris `guests` bisa
  bernilai banyak pax. `Total` di Ringkasan menghitung undangan (labelnya
  memang **"Total undangan"**, bukan "Total tamu"); `AttendingPax` menghitung
  orang. Hal yang sama berlaku di menu Tamu Masuk: `arrivedTotal` menghitung
  undangan, `arrivedPax` menghitung orang - dan yang kedua selalu perkiraan,
  karena berasal dari janji RSVP dan bukan hitung kepala di pintu.
- **Proyeksi catering** - kartu di Ringkasan, satuannya ORANG. Tiga baris yang
  **tidak boleh** diringkas jadi satu angka: `confirmedPax` (FAKTA - tamu sudah
  menjawab hadir), `expectedPax` (TEBAKAN - tamu belum menjawab, dipakai
  `pax_quota`-nya bila admin menduga ia hadir), dan `projectedPax` yang
  menjumlahkan keduanya. Justru karena baris ketiga adalah campuran fakta +
  tebakan, kedua baris di atasnya wajib ikut terlihat - tanpa itu admin tidak
  bisa menilai seberapa besar risikonya saat memesan katering.
- **Token tamu** (`guests.token`) - identitas rahasia per tamu, dibuat
  server-side, dipakai di link personal `?guest=<token>` **dan** sebagai isi
  QR. Perlakukan seperti kredensial: tidak pernah dikirim ke akun petugas.
- **`ELW1:`** - prefiks berversi di depan token pada isi QR
  (`ELW1:<token>`). Prefiksnya yang membuat pemindai bisa menolak QR asing
  sebelum menembak API. Nilainya kembar di Go dan TypeScript - lihat
  `BACKEND.md`.
- **Tamu Masuk** - menu `/arrivals`: daftar tamu yang `checked_in_at`-nya
  sudah terisi, plus ringkasan kedatangan. Bukan daftar tamu yang ber-RSVP
  hadir (itu menu Reservasi) - yang ini bukti tiba di pintu.

## Akun & akses

- **Admin (penuh)** - `admin_users.role = 'admin'`. Akses seluruh dashboard.
- **Petugas gate / scanner** - `admin_users.role = 'scanner'`. HANYA menu
  Scan & Tamu Masuk. Ditegakkan `authmw.RequireFullAdmin` di server;
  penyaringan menu di frontend cuma kosmetik.
- **Peran kosong** - JWT lama tanpa klaim `role`. Diperlakukan sebagai **admin
  penuh**, bukan petugas. Lihat `BACKEND.md`.

## Konten & tampilan

- **Section** - satu blok undangan (17 buah, mis. `cover`, `rsvp`,
  `love_story`). Diidentifikasi `section_key` yang **stabil**: dipakai
  sebagai key `window.INVITATION_LAYOUTS` di frontend.
- **Singleton** - tabel yang selalu berisi tepat 1 baris `id=1`
  (`invitation_content`, `whatsapp_config`). Diubah lewat read-modify-write.
- **Mode pratinjau** - undangan dibuka tanpa `?guest=`. Tetap tampil, tapi
  RSVP tidak tersimpan dan QR-nya tidak mewakili tamu mana pun.
- **Legacy / template** - CSS & JS jQuery ter-minify warisan katsudoto.id
  yang masih menyalakan sebagian animasi undangan tamu. Bukan kode mati -
  lihat `apps/web/README.md` sebelum menghapus apa pun darinya.

## Dua template WhatsApp

Sering tertukar karena sama-sama "template pesan":

- **`message_template`** - pesan QR **otomatis** lewat modul `whatsapp`
  (whatsmeow), dikirim server sesudah tamu RSVP.
- **`invitation_template`** - tombol **"Kirim Undangan"** per tamu, murni
  klien lewat `wa.me`. Tidak menyentuh modul `whatsapp`, tidak tercatat di
  mana pun. Lihat `BACKEND.md`.
