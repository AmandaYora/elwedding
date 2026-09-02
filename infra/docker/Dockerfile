# Multi-stage build: static frontend (2 entry HTML - index.html untuk
# undangan tamu, admin.html untuk dashboard, keputusan #10 PLAN.md) + Go API
# dalam satu container (docker-deployment.md - tanpa nginx, tanpa DB container).
FROM node:20-alpine AS web
WORKDIR /repo
COPY package.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN npm install
RUN npm run build -w apps/web

FROM golang:1.26-alpine AS api
WORKDIR /src
COPY apps/api ./apps/api
WORKDIR /src/apps/api
RUN go build -o /out/api ./cmd/server

FROM alpine:3.20
# tzdata: database/db.go membuka koneksi dengan DSN "?loc=Asia%2FJakarta" -
# parameter loc go-sql-driver/mysql memanggil time.LoadLocation() DI DALAM
# binary Go itu sendiri (bukan di sisi server MySQL), yang butuh
# /usr/share/zoneinfo. alpine:3.20 dasar tidak membawanya - tanpa ini,
# koneksi DB gagal terus dengan "unknown time zone Asia/Jakarta"
# (ditemukan saat deploy pertama ke elcodelabs).
RUN apk add --no-cache tzdata
WORKDIR /app
COPY --from=api /out/api ./api
COPY --from=web /repo/apps/web/dist ./public
# Migrasi golang-migrate diikutkan di image (BUKAN di-run di sini) - deploy.sh
# di server mengekstraknya lewat `docker cp <container>:/app/migrations` lalu
# menjalankannya dengan image resmi migrate/migrate terhadap MySQL host,
# karena image final ini (alpine minimal) tidak membawa binary migrate.
COPY apps/api/migrations ./migrations
ENV APP_PORT=8080
ENV PUBLIC_DIR=/app/public
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${APP_PORT}/api/v1/health || exit 1
CMD ["./api"]
