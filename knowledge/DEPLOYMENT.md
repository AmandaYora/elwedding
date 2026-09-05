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
new QR code from the WhatsApp menu.

## Production (VPS `elcodelabs`)

Production is **image-only**: the VPS never builds, it only pulls and runs an image CI
already built. Whatever isn't `COPY`'d into `infra/docker/Dockerfile`'s final stage (the
compiled Go binary, the built frontend's static assets, `apps/api/migrations`) never reaches
production, regardless of what's tracked in git.

**The pipeline:**
1. **CI builds.** `.github/workflows/deploy.yml` triggers on every push to `master`, builds
   `infra/docker/Dockerfile`, and pushes `ghcr.io/amandayora/elwedding:<git-sha>` (+ `:latest`).
   The repo is public, so build status can be polled unauthenticated via
   `https://api.github.com/repos/AmandaYora/elwedding/actions/runs`.
2. **Migrations are applied outside the final image.** The final `alpine` stage has no
   `migrate` binary - `apps/api/migrations` is only carried inside the image so the deploy
   step can `docker cp` it out of the freshly-pulled container and run the official
   `migrate/migrate` image against the host-level MySQL.
3. **The server only pulls and runs**, manually: SSH to `elcodelabs`
   (`~/.ssh/config` alias, VPS `103.189.235.79`), then
   `~/elwedding/deploy.sh <git-sha>` (the same SHA CI just tagged), from `~/elwedding/`
   (`docker-compose.prod.yml`, no `build:` key).
4. **Verify.** `docker ps` on the VPS should show `elwedding-app` running that SHA and
   `(healthy)`; `curl -sI https://elwedding.elcodelabs.com/api/v1/health` from outside the VPS
   should return `200`.

**Shared box.** `elcodelabs` also hosts `elproof-app` (port `8082`, proxies to the container's
`8080`) and `elkasir-app` (port `8081`) - unrelated apps, each with its own nginx site under
`/etc/nginx/sites-enabled/` and its own `127.0.0.1`-only port. `elwedding-app` itself listens
on `8083` (its `APP_PORT` is overridden from the Dockerfile's default `8080` to avoid colliding
with the sibling apps). Never run a box-wide destructive Docker command here - always scope to
the `elwedding` container/compose project. `WA_STORE_DIR` (above) must be mounted as a
persistent volume in `docker-compose.prod.yml`, the same as in local Docker. There is **no**
`UPLOADS_DIR` any more - admin photo/music uploads live in S3 object storage (`S3_*`), so
nothing else needs a persistent volume.

## Reverse proxy body size limit

Any nginx in front of this app (`infra/nginx/nginx.conf` locally/Docker, and the VPS vhost at
`/etc/nginx/sites-enabled/elwedding`) **must** set `client_max_body_size 12m;`. nginx's default
is 1 MB, which silently rejects admin photo uploads (413) before the request ever reaches Go -
this was the actual root cause of `/admin/content` upload failures, not a Go-side limit (see
`docs/plan/admin-content-upload-base64/PLAN.md` T1). 12 MB covers both the base64 image
endpoint (`POST /api/v1/admin/uploads/base64`, body ≤ 8 MB) and multipart audio uploads
(`POST /api/v1/admin/uploads`, body ≤ 10 MB). When setting up a new server/proxy in front of
this app, add this directive **before** anything else - it will look fine until the first admin
tries to upload a real photo.

**Symptom & quick check.** An upload that fails for a file comfortably under the Go limit
(e.g. a 6 MB MP3 on Pengaturan, where Go allows 10 MB) is almost always this, not app code.
nginx answers 413 with an **HTML** body, not the project's JSON envelope, so it never reaches
a Go handler and nothing appears in the app log. Verify on the VPS with
`grep -r client_max_body_size /etc/nginx/` (absent = the 1 MB default is in force), and confirm
from the browser Network tab that the 413 response is HTML. The admin UI now surfaces the real
message via `apiErrorMessage`, which has an explicit 413 fallback for exactly this case -
"Ukuran file terlalu besar." on a small file means the proxy, not the app.

See `AI_AGENT_OPERATIONS.md` for gotchas specific to doing this push/deploy cycle as an AI
agent (credential-in-command blocks, what's safe to read on the VPS vs. not).
