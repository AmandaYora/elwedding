package application

import (
	"errors"
	"strings"
	"testing"
)

// Tes group tamu (docs/plan/guest-groups/PLAN.md T10). Seluruhnya menguji
// FUNGSI MURNI - tanpa koneksi database, pola yang sama dengan
// resolve_attending_count_test.go & guest_summary_test.go di direktori ini.

func TestValidateGroupName(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr error
	}{
		{"nama kosong ditolak", "", ErrGroupNameRequired},
		// Spasi saja HARUS ditolak sama seperti kosong: tanpa TrimSpace di
		// dalam validateGroupName, group bernama "   " lolos ke database dan
		// muncul sebagai baris tak berlabel di dropdown.
		{"spasi saja ditolak", "   ", ErrGroupNameRequired},
		{"tab & newline saja ditolak", "\t\n ", ErrGroupNameRequired},
		{"tepat 100 karakter diterima", strings.Repeat("a", 100), nil},
		{"101 karakter ditolak", strings.Repeat("a", 101), ErrGroupNameTooLong},
		{"nama wajar diterima", "Teman Kantor", nil},
		// Nama ter-trim yang muat DI KOLOM tetap diterima walau string
		// mentahnya lebih panjang - yang disimpan memang versi ter-trim.
		{"spasi di ujung tidak ikut dihitung", "  " + strings.Repeat("a", 100) + "  ", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateGroupName(tt.input)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("validateGroupName(%q) = %v, mau %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

// Panjang dihitung per RUNE, bukan per byte: VARCHAR(100) MySQL menghitung
// karakter, jadi 100 huruf beraksen (200 byte) masih muat.
func TestValidateGroupName_HitungRuneBukanByte(t *testing.T) {
	if err := validateGroupName(strings.Repeat("é", 100)); err != nil {
		t.Fatalf("100 rune beraksen seharusnya diterima, dapat %v", err)
	}
	if err := validateGroupName(strings.Repeat("é", 101)); !errors.Is(err, ErrGroupNameTooLong) {
		t.Fatalf("101 rune seharusnya ErrGroupNameTooLong, dapat %v", err)
	}
}

func TestValidateGroupDescription(t *testing.T) {
	// Deskripsi BOLEH kosong (K3) - kolomnya NOT NULL DEFAULT string kosong.
	if err := validateGroupDescription(""); err != nil {
		t.Fatalf("deskripsi kosong seharusnya diterima, dapat %v", err)
	}
	if err := validateGroupDescription(strings.Repeat("a", 255)); err != nil {
		t.Fatalf("255 karakter seharusnya diterima, dapat %v", err)
	}
	if err := validateGroupDescription(strings.Repeat("a", 256)); !errors.Is(err, ErrGroupDescriptionTooLong) {
		t.Fatalf("256 karakter seharusnya ErrGroupDescriptionTooLong, dapat %v", err)
	}
}

// canDeleteGroup adalah penjaga K4. Angkanya WAJIB ikut di pesan - itulah
// yang membedakan "ditolak dengan alasan" dari sekadar "gagal".
func TestCanDeleteGroup(t *testing.T) {
	if err := canDeleteGroup(0); err != nil {
		t.Fatalf("group tanpa tamu seharusnya boleh dihapus, dapat %v", err)
	}

	err := canDeleteGroup(1)
	if !errors.Is(err, ErrGroupInUse) {
		t.Fatalf("1 tamu seharusnya ErrGroupInUse, dapat %v", err)
	}
	if !strings.Contains(err.Error(), "1 tamu") {
		t.Fatalf("pesan wajib menyebut jumlah tamunya (K4), dapat %q", err.Error())
	}

	err = canDeleteGroup(12)
	if !errors.Is(err, ErrGroupInUse) {
		t.Fatalf("12 tamu seharusnya ErrGroupInUse, dapat %v", err)
	}
	if !strings.Contains(err.Error(), "12 tamu") {
		t.Fatalf("pesan wajib menyebut jumlah tamunya (K4), dapat %q", err.Error())
	}
}

// parseGroupIDFilter: string kosong = TANPA filter (Valid:false), bukan
// filter "group_id = 0" yang tidak akan pernah cocok.
func TestParseGroupIDFilter(t *testing.T) {
	arg, err := parseGroupIDFilter("")
	if err != nil {
		t.Fatalf("string kosong seharusnya tanpa error, dapat %v", err)
	}
	if arg.Valid {
		t.Fatalf("string kosong = tanpa filter, seharusnya Valid=false")
	}

	arg, err = parseGroupIDFilter("7")
	if err != nil {
		t.Fatalf("id valid seharusnya tanpa error, dapat %v", err)
	}
	if !arg.Valid || arg.Int64 != 7 {
		t.Fatalf("mau {7,true}, dapat {%d,%v}", arg.Int64, arg.Valid)
	}

	for _, bad := range []string{"abc", "-1", "0", "1.5", " 7"} {
		if _, err := parseGroupIDFilter(bad); !errors.Is(err, ErrInvalidGroupID) {
			t.Fatalf("parseGroupIDFilter(%q) seharusnya ErrInvalidGroupID, dapat %v", bad, err)
		}
	}
}

// StatusHTTPCode untuk error group - 404 hanya untuk "tidak ditemukan",
// sisanya 400. Tanpa tes ini, error baru yang lupa didaftarkan diam-diam
// jatuh ke default 500 dan admin melihat "terjadi kesalahan" alih-alih
// alasan sebenarnya.
func TestStatusHTTPCode_ErrorGroup(t *testing.T) {
	tests := []struct {
		err  error
		want int
	}{
		{ErrGroupNotFound, 404},
		{ErrGroupNameRequired, 400},
		{ErrGroupNameTooLong, 400},
		{ErrGroupDescriptionTooLong, 400},
		{ErrGroupNameTaken, 400},
		{ErrGroupInUse, 400},
		{ErrInvalidGroupID, 400},
		// Error ter-bungkus (canDeleteGroup memakai %w) harus tetap 400,
		// bukan jatuh ke default 500.
		{canDeleteGroup(3), 400},
	}
	for _, tt := range tests {
		if got := StatusHTTPCode(tt.err); got != tt.want {
			t.Fatalf("StatusHTTPCode(%v) = %d, mau %d", tt.err, got, tt.want)
		}
	}
}
