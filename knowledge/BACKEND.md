# Backend

`apps/api` - Go modular monolith, `net/http` `ServeMux` bawaan (Go 1.22+
pattern matching `"METHOD /path/{param}"`), tanpa framework HTTP pihak
ketiga (anti-overengineering).

## Struktur per modul

```
internal/modules/<nama>/
├── application/service.go       # logika bisnis, DTO
├── infrastructure/repository.go  # wrapper tipis di atas sqlc.Queries
├── infrastructure/queries/*.sql  # sumber untuk `sqlc generate`
├── infrastructure/sqlc/          # KODE TER-GENERATE, jangan diedit manual
├── presentation/handler.go       # HTTP handler
└── <nama>.module.go              # wiring repo->service->handler
```

Ubah query: edit `.sql` di `infrastructure/queries/`, lalu jalankan
`npm run sqlc:generate` (butuh binary `sqlc` terpasang) dari root, atau
`cd apps/api && sqlc generate`.

## Konvensi

- `internal/shared/` murni utilitas teknis (response envelope, pagination,
  JWT encode/decode, format tanggal) - tidak ada logika domain di sana.
- `internal/router/router.go` mendaftarkan semua route dan menangani
  fallback SPA - baca komentar di `spaFallback` sebelum mengubahnya (lihat
  `ARCHITECTURE.md` untuk kenapa non-GET selalu 404 JSON).
- Password admin di-hash `bcrypt`; JWT via `golang-jwt/jwt/v5`, secret dari
  `JWT_SECRET`.
- Koneksi DB (`internal/database/db.go`) pakai DSN dengan
  `?parseTime=true&loc=Asia%2FJakarta` - ini yang membuat konversi
  `wedding_date` -> epoch selalu benar tanpa perlu konversi timezone manual
  di kode lain.
