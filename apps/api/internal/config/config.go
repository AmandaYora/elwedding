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
	// dev (Vite yang menyajikan). UploadsDir: folder terpisah untuk foto
	// yang diunggah admin (keputusan #12/#9 PLAN.md) - dipisah dari
	// PublicDir supaya tidak tertimpa saat build ulang SPA.
	PublicDir  string
	UploadsDir string

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

		PublicDir:  os.Getenv("PUBLIC_DIR"),
		UploadsDir: getenv("UPLOADS_DIR", "./uploads"),

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
