package config

import (
	"strings"
	"testing"
)

// Validate adalah satu-satunya tempat kegagalan boot karena .env kurang
// lengkap bisa menyebut NAMA variabelnya. Yang dikunci di sini bukan sekadar
// "mengembalikan error", melainkan bahwa nama variabel yang kosong benar-benar
// ikut tercetak - itulah keseluruhan gunanya.
func TestValidate_MenyebutSetiapVariabelYangKosong(t *testing.T) {
	err := Config{}.Validate()
	if err == nil {
		t.Fatal("config kosong seharusnya ditolak")
	}
	for _, name := range []string{"DB_DSN", "S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY"} {
		if !strings.Contains(err.Error(), name) {
			t.Errorf("pesan error tidak menyebut %s: %s", name, err.Error())
		}
	}
}

// Spasi saja TIDAK boleh lolos: `S3_BUCKET= ` di .env menghasilkan nilai yang
// tidak kosong tapi tetap membuat minio gagal dengan error aslinya yang tidak
// bisa didiagnosis.
func TestValidate_SpasiDianggapKosong(t *testing.T) {
	cfg := lengkap()
	cfg.S3Bucket = "   "
	err := cfg.Validate()
	if err == nil || !strings.Contains(err.Error(), "S3_BUCKET") {
		t.Fatalf("spasi seharusnya ditolak sebagai kosong, dapat: %v", err)
	}
}

func TestValidate_LengkapLolos(t *testing.T) {
	if err := lengkap().Validate(); err != nil {
		t.Fatalf("config lengkap seharusnya lolos: %v", err)
	}
}

// JWT_SECRET & APP_PORT punya default di Load(), jadi keduanya TIDAK boleh
// ikut menggagalkan boot walau kosong di struct.
func TestValidate_TidakMewajibkanYangPunyaDefault(t *testing.T) {
	cfg := lengkap()
	cfg.JWTSecret = ""
	cfg.AppPort = ""
	if err := cfg.Validate(); err != nil {
		t.Fatalf("field ber-default seharusnya tidak diwajibkan: %v", err)
	}
}

func lengkap() Config {
	return Config{
		DBDSN:       "root:@tcp(localhost:3306)/db",
		S3Endpoint:  "s3.example.com",
		S3Bucket:    "bucket",
		S3AccessKey: "key",
		S3SecretKey: "secret",
	}
}
