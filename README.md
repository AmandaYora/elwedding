# undangan-digital

Monorepo generated to Dimas' standard (Go modular-monolith backend +
React frontend). Undangan pernikahan digital dengan dashboard admin —
lihat `docs/plan/admin-backend/PLAN.md` untuk analisis lengkap dan
`knowledge/PROJECT.md` untuk ringkasan fitur.

## Development

Run frontend and backend separately from the project root:

```bash
cp .env.example .env   # sesuaikan DB_DSN dkk. dulu
npm install
npm run migrate:up     # butuh MySQL berjalan & `migrate` CLI terpasang
npm run dev:web
npm run dev:api
```

`apps/web` melayani **dua** halaman: `/` (undangan tamu) dan `/admin`
(dashboard, login default `admin` / `ubah-password-ini` — **wajib diganti**
setelah deploy pertama, lihat `apps/api/migrations/000005_seed_admin.up.sql`).

## Structure

- `apps/web` — React 18.3.1 (bukan 19 — lihat
  `knowledge/decisions/ADR-0004-react-18.md`) + Tailwind 4 (khusus dashboard
  admin). Dua entry Vite: `index.html` (undangan) dan `admin.html` (admin).
- `apps/api` — Go modular-monolith backend (`net/http` bawaan, tanpa
  framework tambahan)
- `packages/` — shared code and API contract
- `knowledge/` — the project's one knowledge base: brief, architecture, module map, API,
  database, deployment, and locked decisions (read before editing; start at
  `knowledge/INDEX.md`)
- `.claude/rules/` — path-scoped technical rules
- `analysis/` — per-requirement analysis artifacts (see `analysis/README.md`)
- `infra/` — Docker (tanpa nginx — satu binary Go menyajikan API + kedua
  halaman statis)

## Deployment

One Docker app container serving both the static frontend and the API on port 8080.
The database runs on the host (see `knowledge/DEPLOYMENT.md`).
