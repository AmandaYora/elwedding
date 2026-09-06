# PLAN — Hapus reservasi + penanda "sudah dihubungi"

Modul: `guest`. Dua fitur kecil yang tidak saling bergantung, digabung dalam
satu plan karena keduanya membalik keputusan lama dan keduanya menyentuh
berkas yang sama.

**Klasifikasi intent: Enhancement** (dua kapabilitas baru di atas alur yang
sudah ada).

---

## 1. Keputusan terkunci

### 1.1 Jawaban user (K)

| # | Pertanyaan | Jawaban |
|---|---|---|
| K1 | "Hard delete" di `/admin/reservations` menghapus apa? | **Hanya jawaban RSVP-nya.** Baris tamu, token, dan QR-nya TETAP utuh; statusnya balik ke `pending` dan tamu bisa RSVP lagi. Yang dihapus adalah *reservasi*, bukan *tamu*. |
| K2 | Penanda "sudah dihubungi" ditandai bagaimana? | **Otomatis saat klik "Kirim Undangan", dan bisa dibatalkan admin.** |

### 1.2 Keputusan desain analis (D)

| # | Keputusan | Alasan |
|---|---|---|
| D1 | Reset RSVP **TIDAK menyentuh `checked_in_at`** | [GLOSSARY.md](../../../knowledge/GLOSSARY.md) memisahkan tegas *niat* (`rsvp_status`) dari *bukti* (`checked_in_at`). Menghapus niat tidak boleh ikut menghapus bukti bahwa seseorang benar-benar tiba di pintu. Keadaan "sudah check-in tapi belum jawab" juga sudah mungkin hari ini lewat check-in manual, jadi bukan keadaan baru yang diciptakan fitur ini. |
| D2 | Reset juga menormalkan `attending_count` ke `1` dan `rsvp_responded_at` ke `NULL` | Membiarkannya berarti tamu ber-status `pending` tetap membawa angka janji dan jam jawaban dari jawaban yang sudah dihapus. `1` adalah DEFAULT kolomnya (migration `000007`), dan `resolveAttendingCount` memang menetralkan ke 1 untuk status non-`attending`. |
| D3 | Reset **TIDAK menyentuh `pax_quota`** | Itu setelan ADMIN, bukan jawaban tamu. Menghapus jawaban tamu tidak ada hubungannya dengan jatah kursi yang admin tentukan. |
| D4 | Endpoint `DELETE /api/v1/admin/guests/{id}/rsvp` | RSVP diperlakukan sebagai sub-resource yang dihapus — sesuai K1 ("menghapus reservasi"), dan tidak bentrok dengan `DELETE /guests/{id}` karena jumlah segmennya beda. |
| D5 | Reset bersifat **idempoten**, tidak menolak tamu yang sudah `pending` | Admin bisa saja bekerja dari daftar basi (tab lain sudah mereset). Membalas sukses lebih benar daripada error untuk keadaan yang memang sudah sesuai yang diminta. |
| D6 | Kolom bernama **`contacted_at`**, BUKAN `invitation_sent_at` | `wa.me` secara desain tidak bisa melaporkan balik apakah pesan benar-benar terkirim — yang kita tahu hanya admin membuka WhatsApp. `sent` akan mengklaim lebih dari yang bisa dibuktikan sistem, kesalahan yang sama dengan menyebut `arrivedPax` sebagai jumlah terverifikasi. `contacted_at` juga cukup luas kalau admin menghubungi lewat cara lain. |
| D7 | `DATETIME NULL`, bukan `BOOLEAN` | Pola `checked_in_at` (migration `000014`): NULL bermakna "belum", dan timestamp-nya sendiri berguna ("dihubungi 3 hari lalu"). Boolean membuang informasi itu tanpa menghemat apa pun. |
| D8 | Menandai memakai `NOW()` di SQL, dan **menimpa** nilai lama | Klik kedua berarti admin menghubungi ulang; waktu terbaru lebih berguna daripada yang pertama. Tidak perlu UPDATE bersyarat seperti `MarkGuestCheckedIn` — di sini tidak ada dua petugas yang bisa saling menimpa. |
| D9 | Penanda dipasang lewat `onClick` pada `<a>` yang sudah ada, **tanpa `preventDefault`** | Keadaan bisa-kirim sengaja dirender `<a>`, bukan `window.open`, supaya tidak diblokir popup blocker dan admin bisa Ctrl/Cmd-klik ([og-share-image-dinamis](../og-share-image-dinamis/PLAN.md)). Mencegat kliknya akan merusak dua-duanya. PATCH-nya fire-and-forget di samping navigasi. |
| D10 | Kegagalan PATCH penanda **tidak** menggagalkan apa pun, tapi **wajib** memberi tahu admin | Penandanya kosmetik, jadi tidak boleh memblokir kirim undangan. Tapi diam-diam gagal lebih buruk: admin mengira sudah tertandai padahal tidak, lalu melewati tamu itu. Toast error, WhatsApp tetap terbuka. |

---

## 2. Konflik dengan keputusan lama — WAJIB dibaca

Keduanya dibalik atas permintaan langsung user. Dicatat, bukan ditabrak diam-diam
([SOURCE_PRIORITY.md](../../../knowledge/SOURCE_PRIORITY.md)).

**2.1 Halaman Reservasi sengaja read-only.**
[ReservationsPage.tsx:12-16](../../../apps/web/src/modules/admin/reservations/pages/ReservationsPage.tsx#L12)
menyatakan *"Read-only: tidak ada tambah/ubah/hapus/salin link, karena status
RSVP hanya diubah tamu sendiri lewat link publik, bukan admin."*

Yang dibalik hanya **sebagian**: tambah/ubah/salin-link tetap tidak ada. Yang
masuk cuma satu tombol hapus. Alasan aslinya pun tidak sepenuhnya gugur — RSVP
memang tetap hanya bisa *diisi* tamu; yang admin dapatkan sekarang adalah
kemampuan **membatalkannya**, mis. untuk membersihkan RSVP uji coba. Admin tidak
bisa mengarang jawaban tamu, hanya mengosongkannya.

**2.2 K6 og-share-image-dinamis: pelacakan pengiriman ditolak.**
[K6](../og-share-image-dinamis/PLAN.md) berbunyi *"**Tidak dilacak.** ...
Konsekuensi yang diterima sadar: nol kolom baru di tabel `guests`, nol endpoint
baru, dan admin melacak sendiri siapa yang sudah dikirimi di luar aplikasi."*
Daftar out-of-scope-nya bahkan menyebut persis *"tidak ada kolom
`invitation_sent_at`, tidak ada penanda di daftar tamu"*.

Konsekuensi itu ternyata merepotkan dalam pemakaian nyata, dan user meminta
dibalik. Ini pembalikan yang sah — persis pola migration `000015` yang membalik
"semua admin setara/tanpa role". **Batas K6 yang TETAP berlaku:** yang dicatat
bukan "terkirim" melainkan "dihubungi" (D6), karena keterbatasan teknis `wa.me`
yang mendasari K6 tidak berubah sedikit pun.

---

## 3. Scope

**In scope**

- `apps/api/migrations/000018_add_guest_contacted_at.{up,down}.sql`
- `queries/guests.sql` — `ResetGuestRsvpByID`, `MarkGuestContacted`, `UnmarkGuestContacted`
- `guest/infrastructure/repository.go`, `application/{dto,service}.go`, `presentation/handler.go`
- `internal/router/router.go` — 2 route baru
- `apps/web` — `guests.service.ts`, `ReservationsPage.tsx`, `GuestsPage.tsx`
- `knowledge/{DATABASE,GLOSSARY,API}.md`, `docs/plan/og-share-image-dinamis/PLAN.md` (catatan K6 dibalik)

**Out of scope**

- **Menghapus baris tamu dari Reservasi** — ditolak K1. Tombol Hapus di menu Tamu sudah melakukannya.
- **Tambah/ubah/salin link di Reservasi** — bagian read-only yang TIDAK dibalik (§2.1).
- **Menandai manual tanpa klik "Kirim Undangan"** — K2 hanya meminta otomatis + bisa dibatalkan.
- **Filter "belum dihubungi" di daftar tamu** — tidak diminta. Layak jadi lanjutan; penandanya sudah tersimpan sehingga filter bisa ditambahkan kapan saja tanpa migrasi.
- **Kirim massal / broadcast** — tetap ditolak seperti di og-share-image-dinamis.
- **Modul `whatsapp` (whatsmeow)** — tidak tersentuh. Tombol ini murni `wa.me` klien.

---

## 4. Task list

### Backend

- [ ] **T1 — Migration `000018`.** `ALTER TABLE guests ADD COLUMN contacted_at DATETIME NULL AFTER checked_in_at;`
      Tanpa index (pola `checked_in_at`): dibaca per baris lewat daftar tamu yang sudah dipaginasi, tidak pernah jadi kunci filter.
- [ ] **T2 — 3 query baru** di `queries/guests.sql` (lihat D2/D8).
- [ ] **T3 — Regenerate sqlc.**
- [ ] **T4 — `GuestDTO.ContactedAt *string`** (RFC3339, pola `RsvpRespondedAt`) + isi di `toDTO`.
- [ ] **T5 — Repository:** `ResetRsvp`, `MarkContacted`, `UnmarkContacted`.
- [ ] **T6 — Service:** `ResetRsvp(ctx, id)` dan `SetContacted(ctx, id, contacted bool)` — keduanya `requireGuestExists` dulu supaya id asing balas 404, pola `Update`/`Delete`.
- [ ] **T7 — Handler + 2 route** di mux `admin` (RequireFullAdmin):
      `DELETE /api/v1/admin/guests/{id}/rsvp` dan `PATCH /api/v1/admin/guests/{id}/contacted`.

### Frontend

- [ ] **T8 — `guests.service.ts`:** field `contactedAt: string | null`, fungsi `resetRsvp(id)` & `setContacted(id, contacted)`.
- [ ] **T9 — `ReservationsPage`:** tombol Hapus (danger) + modal konfirmasi. Teksnya WAJIB menyatakan tamunya tidak ikut terhapus, dan menyebut kalau tamu itu sudah check-in (D1).
- [ ] **T10 — `GuestsPage`:** `onClick` penanda pada `<a>` Kirim Undangan (D9/D10) + badge "Dihubungi" inline di sel Nama yang bisa diklik untuk membatalkan.

### Knowledge

- [ ] **T11 —** `DATABASE.md` (kolom baru), `GLOSSARY.md` (istilah "Dihubungi" + bedanya dari "terkirim"), `API.md` (2 endpoint), dan catatan pembalikan di `docs/plan/og-share-image-dinamis/PLAN.md` K6.

### Test

- [ ] Go: `SetContacted` memetakan bool ke query yang benar; `StatusHTTPCode` untuk id asing = 404.
- [ ] Vitest `ReservationsPage`: tombol Hapus memunculkan konfirmasi dan **tidak** memanggil service sebelum dikonfirmasi; setelah dikonfirmasi memanggil `resetRsvp(id)`.
- [ ] Vitest `GuestsPage`: klik "Kirim Undangan" memanggil `setContacted(id, true)` **dan** `<a>`-nya tetap membawa `href` wa.me; klik badge memanggil `setContacted(id, false)`; PATCH gagal → toast muncul, tidak melempar.

---

## 5. Jalur galat

| Kondisi | Perilaku |
|---|---|
| Reset RSVP pada id yang sudah dihapus tab lain | 404 `ErrNotFound` — pola `Update`/`Delete` yang sudah ada. |
| Reset RSVP pada tamu yang statusnya sudah `pending` | 200, idempoten (D5). |
| Reset RSVP pada tamu yang sudah check-in | Berhasil; `checked_in_at` TETAP (D1). Konfirmasi menyebutkannya supaya admin tidak kaget. |
| PATCH penanda gagal (jaringan/500) | Toast error, badge tidak berubah, **WhatsApp tetap terbuka** (D10). |
| Klik "Kirim Undangan" pada tamu tanpa nomor HP | Tidak berubah: tombol tetap `disabled`, tidak ada PATCH, tidak ada penanda (K7 og-share-image-dinamis). |

## 6. Volume & performa

Tidak ada query baru di dalam loop, tidak ada agregasi baru, tidak ada index
baru. Ketiga query T2 adalah UPDATE satu baris lewat primary key. Daftar tamu
tidak menambah kolom yang di-filter maupun di-sort, jadi rencana eksekusi
`ListGuestsFiltered` tidak berubah sama sekali.
