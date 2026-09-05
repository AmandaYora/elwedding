package application

import (
	"database/sql"
	"testing"
	"time"

	"undangan-ariana-adrian/internal/modules/guest/infrastructure/sqlc"
)

// parseCheckinCode & buildQRPayload adalah fungsi murni (docs/plan/
// scan-checkin-gate/PLAN.md T11) - diuji tanpa DB, pola sama seperti
// resolve_attending_count_test.go & escape_like_test.go.

func TestParseCheckinCode(t *testing.T) {
	tests := []struct {
		name      string
		code      string
		wantToken string
		wantOK    bool
	}{
		{"kode sah", "ELW1:abc123", "abc123", true},
		{"token heksadesimal penuh", "ELW1:0f9d2c1b4a7e6538f0c1d2e3a4b5c6d7", "0f9d2c1b4a7e6538f0c1d2e3a4b5c6d7", true},
		// Pembaca QR kadang menyisipkan newline/spasi di ujung - TrimSpace
		// menanganinya, kalau tidak tamu yang sah ditolak di pintu.
		{"spasi di ujung", "  ELW1:abc123  ", "abc123", true},
		{"newline di ujung", "ELW1:abc123\n", "abc123", true},
		{"CRLF di ujung", "ELW1:abc123\r\n", "abc123", true},

		// Versi prefiks lain harus ditolak, bukan diterima diam-diam -
		// itulah gunanya prefiks berversi (D1).
		{"prefiks versi lain", "ELW2:abc123", "", false},
		{"prefiks asing", "WA:abc123", "", false},
		{"tanpa prefiks", "abc123", "", false},
		{"prefiks tanpa token", "ELW1:", "", false},
		{"prefiks tanpa token, dengan spasi", "  ELW1:  ", "", false},
		{"string kosong", "", "", false},
		{"prefiks huruf kecil", "elw1:abc123", "", false},
		// QR format LAMA sengaja ditolak (K1) - tidak ada jalur kompatibilitas.
		{"QR format lama", "Wedding Invitation - Adrian & Ariana\nNama Tamu: Budi", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, ok := parseCheckinCode(tt.code)
			if ok != tt.wantOK {
				t.Fatalf("parseCheckinCode(%q) ok = %v, mau %v", tt.code, ok, tt.wantOK)
			}
			if token != tt.wantToken {
				t.Fatalf("parseCheckinCode(%q) token = %q, mau %q", tt.code, token, tt.wantToken)
			}
		})
	}
}

func TestBuildQRPayload(t *testing.T) {
	got := buildQRPayload("abc123")
	if got != "ELW1:abc123" {
		t.Fatalf("buildQRPayload = %q, mau %q", got, "ELW1:abc123")
	}
}

// Uji BOLAK-BALIK: inilah yang mengunci kontrak antara QR yang diterbitkan
// dan pemindai di gate. Kalau prefiks di salah satu sisi berubah tanpa
// sisi lain ikut, tes ini yang gagal - bukan petugas di hari-H.
func TestBuildQRPayloadBisaDibacaParseCheckinCode(t *testing.T) {
	for _, token := range []string{"abc123", "0f9d2c1b4a7e6538f0c1d2e3a4b5c6d7", "A"} {
		payload := buildQRPayload(token)
		parsed, ok := parseCheckinCode(payload)
		if !ok {
			t.Fatalf("payload %q terbitan buildQRPayload ditolak parseCheckinCode", payload)
		}
		if parsed != token {
			t.Fatalf("token bolak-balik = %q, mau %q", parsed, token)
		}
	}
}

// buildCheckinSummaryDTO: pemetaannya sepele, TAPI menukar groom<->bride di
// sini menghasilkan angka yang tetap terlihat masuk akal di layar gate -
// tidak ada yang akan menyadarinya sampai ada yang menghitung manual. Angka
// pembeda dipakai sengaja supaya tiap field terkunci ke sumbernya.
func TestBuildCheckinSummaryDTO(t *testing.T) {
	got := buildCheckinSummaryDTO(sqlc.GetCheckinSummaryRow{
		ArrivedGroom: 3,
		ArrivedBride: 5,
		ArrivedTotal: 8,
		ArrivedPax:   13,
		TotalGuests:  21,
	})

	if got.ArrivedGroom != 3 {
		t.Errorf("ArrivedGroom = %d, mau 3", got.ArrivedGroom)
	}
	if got.ArrivedBride != 5 {
		t.Errorf("ArrivedBride = %d, mau 5", got.ArrivedBride)
	}
	if got.ArrivedTotal != 8 {
		t.Errorf("ArrivedTotal = %d, mau 8", got.ArrivedTotal)
	}
	// Pax satuannya ORANG, bukan undangan - sengaja lebih besar dari
	// ArrivedTotal di data uji supaya keduanya tidak bisa tertukar diam-diam.
	if got.ArrivedPax != 13 {
		t.Errorf("ArrivedPax = %d, mau 13", got.ArrivedPax)
	}
	if got.TotalGuests != 21 {
		t.Errorf("TotalGuests = %d, mau 21", got.TotalGuests)
	}
}

// Tamu yang belum pernah check-in punya checked_in_at NULL - harus jadi
// string kosong, bukan "0001-01-01T00:00:00Z" yang akan dirender jadi jam
// palsu di layar petugas.
func TestFormatCheckedInAtNull(t *testing.T) {
	if got := formatCheckedInAt(sql.NullTime{}); got != "" {
		t.Fatalf("formatCheckedInAt(NULL) = %q, mau string kosong", got)
	}
}

func TestFormatCheckedInAtValid(t *testing.T) {
	ts := time.Date(2026, 5, 16, 19, 30, 0, 0, time.FixedZone("WIB", 7*3600))
	got := formatCheckedInAt(sql.NullTime{Time: ts, Valid: true})
	if got != "2026-05-16T19:30:00+07:00" {
		t.Fatalf("formatCheckedInAt = %q, mau RFC3339 ber-offset", got)
	}
}
