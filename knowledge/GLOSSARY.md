# Glossary

> Istilah yang dipakai lintas kode, dokumen, dan percakapan di project ini.
> Yang masuk ke sini hanya istilah yang **pernah tertukar** atau yang maknanya
> tidak bisa ditebak dari namanya.

## Tamu & kehadiran

Empat hal di bawah ini terdengar mirip tapi **bukan sinonim**, dan sering
tertukar. Urutannya dari "niat" ke "bukti":

| Istilah | Kolom | Siapa yang mengisi | Artinya |
|---|---|---|---|
| **RSVP status** | `guests.rsvp_status` | Tamu | Jawaban tamu: `pending` / `attending` / `not_attending` / `remind_later`. Niat, bukan bukti. |
| **Diperkirakan hadir** | `guests.is_expected_attending` | Admin | Dugaan admin, terpisah dari jawaban tamu. Dipakai memperkirakan, bukan melaporkan. |
| **Jumlah tamu (pax)** | `guests.attending_count` | Tamu | 1 atau 2 orang, dijanjikan saat RSVP `attending`. Dasar hitung pax makanan. Tetap **janji**. |
| **Check-in** | `guests.checked_in_at` | Petugas gate | Satu-satunya **bukti** tamu benar-benar tiba, dicatat saat QR dipindai di pintu. `NULL` = belum datang. |

- **Pax** - jumlah orang (bukan jumlah undangan). Satu baris `guests` bisa
  bernilai 2 pax. `Total` di Ringkasan menghitung undangan; `AttendingPax`
  menghitung orang. Hal yang sama berlaku di menu Tamu Masuk: `arrivedTotal`
  menghitung undangan, `arrivedPax` menghitung orang - dan yang kedua selalu
  perkiraan, karena berasal dari janji RSVP dan bukan hitung kepala di pintu.
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
