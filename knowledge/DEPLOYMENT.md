# Deployment — undangan-ariana-adrian

## Local
```bash
npm run dev:web
npm run dev:api
```

## Docker
One app container serves the static frontend and the API on port 8080.
The database runs on the host; the container reaches it via `host.docker.internal`.

```bash
docker compose up --build
```

Set host DB env in `.env` (copy from `.env.example`).

## WhatsApp session storage

`WA_STORE_DIR` (default `./wa-store`) holds the WhatsApp session as a
SQLite file (`wa.db`), created by `go.mau.fi/whatsmeow` itself - **not**
MySQL, which the library does not fully support. This directory **must**
be mounted as a persistent volume in any deployment (Docker included) -
if it is lost, the admin must re-pair the WhatsApp account by scanning a
new QR code from the WhatsApp menu. See
`docs/plan/dashboard-wa-rsvp/PLAN.md`.
