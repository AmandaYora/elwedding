// Package config membaca konfigurasi aplikasi dari environment variable,
// mengikuti standar `.env` di api-standard.md.
package config

import (
	"os"
	"path/filepath"
	"time"
)

type Config struct {
	AppEnv  string
	AppPort string

	DBDSN string

	JWTSecret    string
	JWTExpiresIn time.Duration

	// PublicDir: build statis apps/web (index.html + admin.html). Kosong di
	// dev (Vite yang menyajikan).
	PublicDir string

	// S3*: object storage IDCloudHost untuk foto/musik yang diunggah admin
	// (docs/plan/content-uploads-object-storage/PLAN.md - menggantikan
	// UPLOADS_DIR/disk lokal). Tanpa default - kosong berarti storage.New
	// gagal saat boot, sama seperti DBDSN.
	S3Endpoint  string
	S3Bucket    string
	S3AccessKey string
	S3SecretKey string
	S3UseSSL    bool

	// WAStoreDBPath: file SQLite sesi WhatsApp (dashboard-wa-rsvp keputusan
	// #5) - TERPISAH dari MySQL project, whatsmeow tidak mendukung MySQL.
	// WAJIB ikut volume persisten - kalau hilang, WhatsApp harus di-pairing
	// ulang lewat scan QR.
	WAStoreDBPath string
}

func Load() Config {
	return Config{
		AppEnv:  getenv("APP_ENV", "development"),
		AppPort: getenv("APP_PORT", "8080"),

		DBDSN: os.Getenv("DB_DSN"),

		JWTSecret:    getenv("JWT_SECRET", "change-me"),
		JWTExpiresIn: parseDuration(getenv("JWT_EXPIRES_IN", "24h"), 24*time.Hour),

		PublicDir: os.Getenv("PUBLIC_DIR"),

		S3Endpoint:  os.Getenv("S3_ENDPOINT"),
		S3Bucket:    os.Getenv("S3_BUCKET"),
		S3AccessKey: os.Getenv("S3_ACCESS_KEY"),
		S3SecretKey: os.Getenv("S3_SECRET_KEY"),
		S3UseSSL:    getenv("S3_USE_SSL", "true") == "true",

		WAStoreDBPath: filepath.Join(getenv("WA_STORE_DIR", "./wa-store"), "wa.db"),
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func parseDuration(s string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return fallback
	}
	return d
}
