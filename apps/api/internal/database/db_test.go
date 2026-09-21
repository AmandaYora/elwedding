package database

import (
	"strings"
	"testing"

	"github.com/go-sql-driver/mysql"
)

// Tes DSN (docs/plan/timezone-wib/PLAN.md T2/§7.1).
//
// Seluruhnya menguji FUNGSI MURNI tanpa koneksi database - pola yang sama
// dengan parseGroupIDFilter/parseContactedFilter di modul guest.
//
// Yang diverifikasi adalah hasil parsing driver YANG SEBENARNYA
// (mysql.ParseDSN), bukan pencocokan string: string yang "terlihat benar"
// tidak membuktikan apa pun, karena kesalahan yang dikejar tes ini justru
// terjadi di tahap unescape.

const baseDSN = "user:pass@tcp(127.0.0.1:3306)/undangan_db"

func TestBuildDSN_DiterimaDriver(t *testing.T) {
	if _, err := mysql.ParseDSN(buildDSN(baseDSN)); err != nil {
		t.Fatalf("mysql.ParseDSN(buildDSN(...)) error = %v, mau nil", err)
	}
}

// INTI perbaikan bug mundur 7 jam. Nilainya harus '+07:00' LENGKAP DENGAN
// kutip tunggal, karena driver menulis nilai apa adanya ke perintah
// `SET time_zone = <val>` tanpa menambahkan kutip sendiri.
func TestBuildDSN_TimeZoneWIB(t *testing.T) {
	cfg, err := mysql.ParseDSN(buildDSN(baseDSN))
	if err != nil {
		t.Fatalf("ParseDSN error: %v", err)
	}
	const want = "'+07:00'"
	if got := cfg.Params["time_zone"]; got != want {
		t.Fatalf("time_zone = %q, mau %q", got, want)
	}
}

// Penjaga jebakan encoding: '+' HARUS ditulis %2B.
//
// url.QueryUnescape menerjemahkan '+' menjadi SPASI, jadi DSN yang memakai
// '+' literal menghasilkan `SET time_zone = ' 07:00'` - ditolak MySQL saat
// handshake, sehingga SETIAP koneksi gagal dan seluruh aplikasi mati. Tanpa
// tes ini, kesalahan itu baru ketahuan di produksi.
func TestBuildDSN_PlusTidakJadiSpasi(t *testing.T) {
	cfg, err := mysql.ParseDSN(buildDSN(baseDSN))
	if err != nil {
		t.Fatalf("ParseDSN error: %v", err)
	}
	if strings.Contains(cfg.Params["time_zone"], " ") {
		t.Fatalf("time_zone = %q mengandung spasi - '+' kemungkinan ditulis literal, bukan %%2B", cfg.Params["time_zone"])
	}
	// Kutipnya juga tidak boleh lupa di-encode: tanpa %27, nilainya jadi
	// +07:00 telanjang dan `SET time_zone = +07:00` bukan sintaks yang sah.
	if strings.Contains(dsnParams, "time_zone=%2B") {
		t.Fatalf("dsnParams = %q: kutip tunggal di sekitar offset hilang", dsnParams)
	}
}

// loc & parseTime yang sudah ada TIDAK BOLEH hilang saat parameter baru
// ditambahkan. Keduanya sama pentingnya: tanpa loc, literal DATETIME dibaca
// sebagai UTC; tanpa parseTime, kolom waktu datang sebagai []byte dan seluruh
// pemetaan DTO gagal.
func TestBuildDSN_LocDanParseTimeTetap(t *testing.T) {
	cfg, err := mysql.ParseDSN(buildDSN(baseDSN))
	if err != nil {
		t.Fatalf("ParseDSN error: %v", err)
	}
	if got := cfg.Loc.String(); got != "Asia/Jakarta" {
		t.Fatalf("loc = %q, mau %q", got, "Asia/Jakarta")
	}
	if !cfg.ParseTime {
		t.Fatal("parseTime = false, mau true")
	}
}

// DSN dasar dari env diteruskan utuh - buildDSN hanya menempelkan parameter,
// tidak boleh ikut mengubah host/kredensial/nama database.
func TestBuildDSN_BasisTidakBerubah(t *testing.T) {
	cfg, err := mysql.ParseDSN(buildDSN(baseDSN))
	if err != nil {
		t.Fatalf("ParseDSN error: %v", err)
	}
	if cfg.DBName != "undangan_db" {
		t.Fatalf("DBName = %q, mau %q", cfg.DBName, "undangan_db")
	}
	if cfg.Addr != "127.0.0.1:3306" {
		t.Fatalf("Addr = %q, mau %q", cfg.Addr, "127.0.0.1:3306")
	}
}
