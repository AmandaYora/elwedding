// Package config membaca konfigurasi aplikasi dari environment variable,
// mengikuti standar `.env` di api-standard.md.
package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
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

// Validate memastikan konfigurasi yang SENGAJA tidak punya default memang
// terisi, dan menyebut nama variabelnya.
//
// Tanpa ini kegagalannya tidak bisa didiagnosis: S3_ENDPOINT kosong hanya
// muncul sebagai error minio yang tidak menyebut satu pun nama variabel
// ("Endpoint:  does not follow ip address or domain name standards"), dan
// DB_DSN kosong sebagai error driver MySQL - keduanya membuat orang menebak
// berkas .env mana yang kurang. Ditemukan langsung saat `npm run dev:api`
// gagal boot dengan .env yang belum ikut diperbarui setelah unggahan konten
// pindah ke object storage.
//
// JWT_SECRET & APP_PORT TIDAK ikut diperiksa - keduanya memang punya default
// di Load() di atas.
func (c Config) Validate() error {
	required := []struct {
		name  string
		value string
	}{
		{"DB_DSN", c.DBDSN},
		{"S3_ENDPOINT", c.S3Endpoint},
		{"S3_BUCKET", c.S3Bucket},
		{"S3_ACCESS_KEY", c.S3AccessKey},
		{"S3_SECRET_KEY", c.S3SecretKey},
	}

	var missing []string
	for _, r := range required {
		if strings.TrimSpace(r.value) == "" {
			missing = append(missing, r.name)
		}
	}
	if len(missing) == 0 {
		return nil
	}
	return fmt.Errorf(
		"environment variable wajib belum terisi: %s - salin .env.example ke .env di root repo lalu isi nilainya",
		strings.Join(missing, ", "),
	)
}
