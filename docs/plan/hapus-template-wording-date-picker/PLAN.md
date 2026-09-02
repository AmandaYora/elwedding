# PLAN — Hapus Wording Template & Katsudoto, Ganti Semua Input Tanggal ke Date Picker

## Ringkasan Requirement & Klasifikasi Intent

**Permintaan user (data):**
1. *Semua wording yang berkaitan dengan `undangan-ariana-adrian` dihilangkan* — bawaan template tidak relevan lagi.
2. *Semua inputan tanggal gunakan date picker* (bukan text bebas).
3. *Hapus watermark/wording yang berkaitan dengan `katsudoto`*.

**Klasifikasi analyst:** **Enhancement** — kapabilitas sudah ada (halaman undangan, form admin `ContentPage.tsx:381`, `SimpleListEditor` 5 list), yang diubah adalah *kualitas & netralitas template* + UX input. Verifikasi: bukan Bug (tidak ada laporan error) dan bukan New capability (tidak ada tabel/modul baru yang diminta).

**Keputusan terkunci Step 0 (prognosi, minta konfirmasi — jika salah trace terbuang):**
- **Wording `undangan-ariana-adrian`:** diasumsikan yang dimaksud adalah **hard-code nama pasangan & hashtag template** `Ariana & Adrian` / `AriaMeetsAdrian` yang masih tersebar di `index.html:12,37,65`, `admin.html:6`, `AdminLayout.tsx:138`, `LoginPage.tsx:73,108,126`, `apps/api/migrations/000004_seed.up.sql:21` — **bukan** menghapus fitur pasangan itu sendiri (nama tetap dinamis dari `invitation_content.bride_name/groom_name` `dto.go:12`). Rekomendasi: ganti hard-code jadi generik (`Undangan Pernikahan` / `{{bride}} & {{groom}}` dinamis), bukan hapus field.
- **Date picker:** diasumsikan **semua field yang menyimpan tanggal/waktu** yang saat ini `type="text"` — `weddingDate` `ContentPage.tsx:419` (`Field label="Tanggal & Jam Acara"`) + `timeLabel` / `eventLabel` di `agenda_events`/`rundown_items` bila dipakai sebagai jam. Rekomendasi: `weddingDate` → `type="datetime-local"` (cocok `service.go:124` `2006-01-02T15:04`), field jam lain → `type="time"` bila hanya jam.
- **Katsudoto:** watermark `Footer.tsx:5` `Powered by <a href="https://katsudoto.id/">` + logo SVG + meta `Katsudoto.id` `index.html:12` + komentar `legacy.d.ts:6` + sisa hashtag default `#AriaMeetsAdrian`. Rekomendasi: hapus Footer branding atau ganti jadi generik `Powered by` tanpa link, meta ganti jadi `{{bride}} & {{groom}} Wedding`.

> Jika asumsi di atas meleset (mis. “hapus wording undangan-ariana-adrian” maksudnya ganti repo name saja, atau date picker hanya untuk tamu), koreksi — plan ini langsung revisi via `Edit` + re-validasi Step 7.

## Step 1 — Entry Point Terkonfirmasi Ada

Stack `knowledge/INDEX.md:1` `monorepo-standard`: `apps/web` Vite 5 React 18.3.1 (`package.json:7`), `apps/api` Go `net/http` `ServeMux` (`router.go:45`).

Front door yang disentuh:
- **Undangan tamu SEO/branding:** `apps/web/index.html:12` `meta title/description`, `19` `og:title`, `27` `twitter:title`, `37` `CUSTOM_TEXT = "Ariana & Adrian"`, `65` `<title>`, `apps/web/public/media/kat/katsudoto-logo-lg-2.jpg` `og:image:21`
- **Admin shell:** `apps/web/admin.html:6` `<title>Admin - Undangan Ariana & Adrian`, `modules/admin/shared/AdminLayout.tsx:138` `Ariana & Adrian`, `modules/admin/auth/pages/LoginPage.tsx:73` hero, `108` footer `&copy; Ariana & Adrian Wedding`
- **Footer watermark:** `components/Footer/Footer.tsx:5` `Powered by -> katsudoto.id` + SVG 25 path — satu-satunya watermark undangan (`grep -rn katsudoto` hanya di `Footer.tsx:5`, `legacy.d.ts:6`)
- **Form tanggal:** `ContentPage.tsx:419` `Field weddingDate` `placeholder="Minggu, 12 Oktober 2026"` (saat ini `type` default `text` — tidak ada date picker), `SimpleListEditor` `agendaEvents`/`rundownItems` kolom `timeLabel` masih `text` (`ContentPage.tsx:536`)
- **Seed/template:** `apps/api/migrations/000004_seed.up.sql:21` `Ariana Claire Valen`/`Adrian Lucas Hale` + `000004:65` `bankName` contoh — bawaan template

Semua path diverifikasi `read` sesi ini, bukan tebak. `infra/nginx/nginx.conf` placeholder tidak dipakai (`knowledge/DEPLOYMENT.md:30`).

## Step 2 — Trace Pass 1

1. `index.html:12` meta → browser tab/SEO, `37` `CUSTOM_TEXT` dibaca `fddf2641.js` untuk loading logo (div `#cover-main` diisi `window.COVERS` `useLegacyBootstrap.ts:79`), `65` title — **statis**, tidak dari `GET /api/v1/public/invitation`.
2. `admin.html:6` → `admin-main.tsx` → `AdminLayout.tsx:138` → `ContentPage.tsx:419` `Field` → `shared/components/ui/Input.tsx:4` `InputProps extends InputHTMLAttributes` (sudah support `type` apa pun, tinggal `type="datetime-local"`).
3. `ContentPage.tsx:184` `handleSave` → `services/content.service.ts:21` `PATCH /api/v1/admin/content` `{weddingDate:"2026-05-16T09:00", ...}` → `handler.go:51` `UpdateContent` → `service.go:123` `time.ParseInLocation("2006-01-02T15:04", in.WeddingDate)` → `invitation_content.wedding_date` `000001:14` `DATETIME NOT NULL`.
4. `Footer.tsx:5` dirender `SectionRegistry.tsx` (undangan) — tanpa prop, hard-code link `katsudoto.id`.

## Step 3 — Data Source

**Tidak enhance/add tabel.** Semua wording yang dimaksud adalah **nilai** di `invitation_content` (`bride_name`, `groom_name`, `hashtag`, `wedding_date`) + hard-code FE, bukan kolom baru. `invitation_content` `000001:1` `VARCHAR(500)` + `TEXT` sudah muat nilai generik. Seed `000004` hanya data awal, tidak butuh migrasi baru — ubah via admin `PATCH` cukup. Konfirmasi: tidak ada FK lintas modul (`knowledge/DATABASE.md:22`).

## Step 4 — Konsep Desain (rekomendasi dengan kriteria)

**F1 — Hilangkan wording `undangan-ariana-adrian` / `Ariana & Adrian`:**
- Opsi A (rekomendasi, **kecocokan + blast radius kecil**): Ganti semua hard-code jadi **generik dinamis**: `index.html:12` → `Undangan Pernikahan` / `{{hashtag}}` tidak hard-code, `AdminLayout.tsx:138` → ambil dari `useInvitationData` atau jadi `Dashboard` saja, `LoginPage.tsx:73` → `Pernikahan`, `000004` seed biarkan (data, bukan wording). Tetap pakai `invitation_content` yang sudah ada — tidak tambah tabel.
- Opsi B: Hapus field pasangan sekalian — salah, requirement adalah hilangkan *template*, bukan fitur pasangan.

**F2 — Date picker:**
- Opsi A (rekomendasi, **simplest mechanism**): Ubah `Input` `type="datetime-local"` untuk `weddingDate` (`ContentPage.tsx:419`) dan `type="time"` untuk `timeLabel` di `SimpleListEditor` (`agendaEvents`/`rundownItems`). `Input.tsx:4` sudah `forwardRef` + `...props`, tinggal `type` prop — tidak perlu lib `react-datepicker`. Sesuai `service.go:124` yang sudah parse `2006-01-02T15:04`.
- Opsi B: Lib berat `react-datepicker` + `date-fns` — overengineering untuk 1 field, menambah bundle, tidak dibayar requirement.

**F3 — Hapus Katsudoto:**
- Opsi A (rekomendasi): Hapus blok `Powered by` `Footer.tsx:5` atau ganti jadi generik tanpa link/SEO meta ganti jadi dinamis `{{bride}} & {{groom}}`. `index.html:21` `og:image` `katsudoto-logo-lg-2.jpg` → ganti `coverLogoUrl` dinamis atau `/media/template/arsya/frame-cover.webp`. Blast radius 3 file, reversible.

## Step 5 — Re-trace untuk Reuse (Pass 2)

**In scope (sentuh):**
- `apps/web/index.html:12,19,27,37,65` + `apps/web/admin.html:6`
- `apps/web/src/components/Footer/Footer.tsx:5`
- `apps/web/src/modules/admin/shared/AdminLayout.tsx:138`
- `apps/web/src/modules/admin/auth/pages/LoginPage.tsx:73,108,126`
- `apps/web/src/modules/admin/content/pages/ContentPage.tsx:419` + kolom `SimpleListEditor` `timeLabel`
- `apps/web/src/shared/components/ui/Input.tsx:4` (reuse, tidak buat komponen baru)
- `apps/web/src/types/legacy.d.ts:6` komentar `katsudoto.id` (hapus)
- Tests `SectionRegistry.test.tsx:7`, `App.test.tsx:12` data `Ariana` (ganti generik)

**Out of scope (keputusan, bukan kelalaian):**
- `apps/api` `invitation_content` schema (`000001:1`) — tidak diubah, hanya nilai via `PATCH`
- `wa-store`, `UPLOADS_DIR`/`S3` (`knowledge/DEPLOYMENT.md:22`) — bukan wording
- `admin` auth `guest`/`whatsapp` — tidak ada tanggal/wording di sana selain `weddingDate`
- `lighthouse` / `optimize-assets.mjs` — tidak terkait branding

**Reuse inventory (terverifikasi baca):**
- `Input.tsx:11` `forwardRef` + `InputHTMLAttributes` — sudah support `type="datetime-local"` tanpa lib baru
- `content.service.ts:35` `toFormValues` `weddingDateRaw: "2006-01-02T15:04"` — preseden format datetime-local, reuse
- `service.go:124` `ParseInLocation` `Asia/Jakarta` — reuse tz `id/jakarta`
- `Footer.tsx` tanpa prop — hapus langsung, tidak perlu `contracts/` baru (batas modul `content` tidak tersentuh)

**Klasifikasi akhir:** Tetap **Enhancement** (reuse tinggi, tidak ada tabel/modul baru).

## File yang Akan Disentuh (anchor file:line)

- `apps/web/index.html:12` `meta title` `Ariana & Adrian - Katsudoto.id` → `Undangan Pernikahan`
- `apps/web/index.html:19,27` `og:title`/`twitter:title` sama
- `apps/web/index.html:21` `og:image` `katsudoto-logo-lg-2.jpg` → `coverLogoUrl` atau `/media/template/arsya/frame-cover.webp`
- `apps/web/index.html:37` `CUSTOM_TEXT = "Ariana & Adrian"` → `""` atau dinamis
- `apps/web/index.html:65` `<title> Ariana & Adrian | Katsudoto` → `Undangan Pernikahan`
- `apps/web/admin.html:6` `Admin - Undangan Ariana & Adrian` → `Admin - Undangan Pernikahan`
- `apps/web/src/components/Footer/Footer.tsx:5` `Powered by -> katsudoto.id` + SVG → hapus blok atau ganti `© {new Date().getFullYear()}`
- `apps/web/src/modules/admin/shared/AdminLayout.tsx:138` `Ariana & Adrian` → `Dashboard` atau `useInvitationData` dinamis
- `apps/web/src/modules/admin/auth/pages/LoginPage.tsx:73,108,126` hero/footer `Ariana & Adrian` → `Pernikahan` generik
- `apps/web/src/modules/admin/content/pages/ContentPage.tsx:419` `<Field label="Tanggal & Jam Acara" type="datetime-local" ...>` (tambah `type` prop)
- `apps/web/src/modules/admin/content/pages/ContentPage.tsx:536` columns `timeLabel` → `type: 'time'` atau `type: 'datetime-local'` (di `SimpleListEditor.tsx:6` `ListColumn.type` tambah `'time'|'datetime-local'`)
- `apps/web/src/shared/components/ui/Input.tsx:4` — tidak diubah, hanya pakai `type` prop
- `apps/web/src/types/legacy.d.ts:6` komentar `katsudoto.id` — hapus
- Tests `App.test.tsx:12`, `SectionRegistry.test.tsx:7`, `Cover.test.tsx:21` — ganti `Ariana` → `Budi` generik (agar `npm run test` tidak brittle)

## Task List (urut, tanpa dependensi terbalik)

1. **[FE] Hapus Katsudoto SEO** `index.html:12,19,27,65` ganti hard-code `Ariana & Adrian - Katsudoto.id` → `Undangan Pernikahan` (atau `{{bride}} & {{groom}}` bila mau dinamis via `useInvitationData` nanti — untuk plan ini statis generik dulu). Verifikasi `grep -rn Katsudoto apps/web` kosong kecuali `legacy.d.ts` yang dibersihkan di task 4.
2. **[FE] Hapus watermark Footer** `Footer.tsx:5` — hapus `<p>Powered by</p> <a href="https://katsudoto.id">` + SVG, ganti dengan `<p>© {new Date().getFullYear()}</p>` generik (tanpa link). Verifikasi `grep -rn katsudoto.id` kosong.
3. **[FE] Bersihkan admin branding** `AdminLayout.tsx:138` `Ariana & Adrian` → `Dashboard`, `LoginPage.tsx:73` `Ariana & Adrian` → `Pernikahan`, `108` footer `Ariana & Adrian Wedding` → `Wedding`, `admin.html:6` title generik, `legacy.d.ts:6` komentar hapus. `npm run build -w apps/web` + `grep -rn "Ariana.*Adrian" apps/web/src --include="*.tsx" --exclude="*.test.tsx"` sisa 0 (test dikecualikan).
4. **[FE] Date picker weddingDate** `ContentPage.tsx:419` → `<Field label="Tanggal & Jam Acara" type="datetime-local" value={form.weddingDate} onChange={v=>set('weddingDate',v)} />` (hapus `placeholder` human). `Input.tsx:4` sudah support `type`, tidak perlu ubah lib. Verifikasi `npx tsc -b --noEmit` + `go vet` (BE tidak tersentuh).
5. **[FE] Date/time picker list** `ContentPage.tsx:536` `columns` `agendaEvents`/`rundownItems` `timeLabel` `type: 'time'` (atau `datetime-local` bila butuh tanggal) — perlu tambah `'time'` ke `ListColumn.type` `SimpleListEditor.tsx:6`. Verifikasi `vitest run` 80 test lolos.
6. **[Test] Update tests generik** `App.test.tsx:12`, `SectionRegistry.test.tsx:7`, `Cover.test.tsx:21` `brideName: 'Ariana'` → `Budi` / `Siti` generik (agar tidak brittle terhadap penghapusan template). `npm run test -w apps/web` 95/95.
7. **[Manual] Verifikasi** `npm run dev:web` buka `/` cek title tab `Undangan Pernikahan` (bukan `Ariana | Katsudoto`), Footer tanpa `Powered by katsudoto.id`, buka `/admin` login cek branding `Dashboard`, buka Konten → Profil → `Tanggal & Jam Acara` muncul date picker native, ubah → Simpan → `GET /api/v1/admin/content` `weddingDateRaw` sesuai, buka undangan cek countdown `weddingDateUnix` tetap benar (`service.go:63` `Asia/Jakarta`).

## Test yang Harus Ditulis

- Vitest `Input.test.tsx` — `type="datetime-local"` render `input[type=datetime-local]`
- `ContentPage.test.tsx` — `Field weddingDate` punya `type="datetime-local"`
- `Footer.test.tsx` (baru) — tidak mengandung `katsudoto.id`
- `go test ./internal/modules/content -run TestUpdateContent_WeddingDate` sudah ada (reuse) — pastikan `2006-01-02T15:04` lolos, format human gagal (tidak diubah di BE)

## Diagram

### Class Diagram
```mermaid
classDiagram
  class IndexHtml {
    <<apps/web/index.html:12>>
    -meta title/description
    -og:title/image
    -CUSTOM_TEXT
  }
  class AdminHtml {
    <<apps/web/admin.html:6>>
  }
  class Footer {
    <<Footer.tsx:5>>
    -Powered by katsudoto
  }
  class AdminLayout {
    <<AdminLayout.tsx:138>>
    -Ariana & Adrian
  }
  class ContentPage {
    <<ContentPage.tsx:419>>
    +Field weddingDate
    +handleSave()
  }
  class SimpleListEditor {
    <<SimpleListEditor.tsx:6>>
    +columns timeLabel
  }
  class Input {
    <<Input.tsx:4>>
    +type prop
  }
  class Handler {
    <<handler.go:51>>
    +UpdateContent()
  }
  class Service {
    <<service.go:123>>
    +Parse 2006-01-02T15:04
  }
  IndexHtml ..> ContentPage : brand generik
  AdminLayout ..> ContentPage : branding
  Footer ..> IndexHtml : og:image
  ContentPage --> Input : type=datetime-local
  SimpleListEditor --> Input : type=time
  ContentPage --> Handler : PATCH weddingDate
  Handler --> Service
```

### ERD
```mermaid
erDiagram
  invitation_content {
    varchar bride_name "reuse, jadi generik via PATCH"
    varchar groom_name "reuse"
    datetime wedding_date "dipakai datetime-local"
    varchar hashtag "reuse #AriaMeetsAdrian -> generik"
  }
  note right of invitation_content : tidak ada kolom baru\nnilai lama Ariana/Adrian di 000004_seed hanya data, bukan schema
```

### Sequence Diagram
```mermaid
sequenceDiagram
  actor Admin
  participant FE as ContentPage.tsx
  participant Input as Input.tsx
  participant Svc as content.service.ts
  participant H as handler.go
  participant App as service.go
  participant DB as invitation_content
  Admin->>FE: buka tab Profil
  FE->>Input: render Field type=datetime-local value=2026-05-16T09:00
  Admin->>Input: pilih tanggal via picker
  Input-->>FE: onChange 2026-06-01T10:00
  FE->>FE: set weddingDate
  Admin->>FE: klik Simpan
  FE->>Svc: updateContent({weddingDate:"2026-06-01T10:00", brideName:"Budi", ...})
  Svc->>H: PATCH /api/v1/admin/content JSON
  H->>App: UpdateContent(in)
  App->>App: time.Parse 2006-01-02T15:04 Asia/Jakarta
  App->>DB: UpdateInvitationContent
  DB-->>App: ok
  App-->>H: nil
  H-->>Svc: 200
  Svc-->>FE: toast tersimpan
  Admin->>FE: cek Footer tanpa katsudoto
```

## Validasi Sebelum Done (7 checks)

- **Requirement agreement:** Plan membangun 3 poin user (hapus Ariana/Adrian, date picker semua tanggal, hapus katsudoto) — tidak tambah fitur lain. Jika “semua inputan tanggal” ternyata hanya `weddingDate`, task 5 bisa dipangkas.
- **Sequence completeness:** Hapus wording → `index.html`/`Footer`/`AdminLayout`/`LoginPage`; date picker → `Input` → `PATCH` → `Parse` → `DB`; tiap hop ada file:line.
- **Ordering:** 1 SEO → 2 Footer → 3 admin branding → 4 weddingDate → 5 list time → 6 tests → 7 manual. Tidak ada DDL sebelum pakai.
- **Diagram↔prosa↔task:** `IndexHtml`, `Footer`, `AdminLayout`, `ContentPage`, `Input`, `Handler`, `Service`, `invitation_content` konsisten di 3 diagram + task + prose.
- **Fact re-check:** `index.html:12,37,65`, `Footer.tsx:5`, `AdminLayout.tsx:138`, `ContentPage.tsx:419`, `Input.tsx:4`, `service.go:124`, `000004:21` semua dari `read`/`grep` sesi ini.
- **Exception/error path:** Date picker browser fallback ke text bila tidak support → `Parse` gagal `400` + toast `Gagal menyimpan` (sudah `handler.go:57`), tidak happy-path saja.
- **Performance/volume:** Singleton `1` row `WHERE id=1`, tidak ada loop N+1; `grep` 3 file branding, bukan full scan per request. Aman volume undangan (ratusan tamu, `knowledge/PROJECT.md:12`).

---

*Plan ini siap handoff. Menunggu 1 konfirmasi Anda (Step 4) untuk kunci wording generik vs dinamis & cakupan date picker, lalu eksekusi — tidak ada file ditulis sebelum confirm (file ini adalah deliverable Step 6 yang memang harus ditulis via Write).*
