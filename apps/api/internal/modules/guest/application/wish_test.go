package application

import (
	"errors"
	"strings"
	"testing"
)

// Tes ucapan tamu (docs/plan/wedding-wish/PLAN.md T22). Seluruhnya menguji
// FUNGSI MURNI - tanpa koneksi database, pola group_test.go di direktori ini.

// U1: normalisasi & validasi pesan.
func TestNormalizeWishMessage(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr error
	}{
		{"spasi di ujung dipangkas", "  Selamat ya!  ", "Selamat ya!", nil},
		{"string kosong ditolak", "", "", ErrWishEmpty},
		{"hanya spasi ditolak", "   ", "", ErrWishEmpty},
		{"tab & newline saja ditolak", "\t\n ", "", ErrWishEmpty},
		{"tepat 500 karakter diterima", strings.Repeat("a", 500), strings.Repeat("a", 500), nil},
		{"501 karakter ditolak", strings.Repeat("a", 501), "", ErrWishTooLong},
		{"pesan wajar diterima", "Selamat untuk kedua mempelai!", "Selamat untuk kedua mempelai!", nil},
		// Pesan ter-trim yang muat DI KOLOM tetap diterima walau string
		// mentahnya lebih panjang - yang disimpan memang versi ter-trim.
		{"spasi di ujung tidak ikut dihitung", "  " + strings.Repeat("a", 500) + "  ", strings.Repeat("a", 500), nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeWishMessage(tt.input)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("normalizeWishMessage(%q) err = %v, mau %v", tt.input, err, tt.wantErr)
			}
			if err == nil && got != tt.want {
				t.Fatalf("normalizeWishMessage(%q) = %q, mau %q", tt.input, got, tt.want)
			}
		})
	}
}

// Panjang dihitung per RUNE, bukan per byte: VARCHAR(500) MySQL menghitung
// karakter, jadi 500 emoji (2000 byte) masih muat di kolomnya.
func TestNormalizeWishMessage_HitungRuneBukanByte(t *testing.T) {
	if _, err := normalizeWishMessage(strings.Repeat("é", 500)); err != nil {
		t.Fatalf("500 rune beraksen seharusnya diterima, dapat %v", err)
	}
	if _, err := normalizeWishMessage(strings.Repeat("é", 501)); !errors.Is(err, ErrWishTooLong) {
		t.Fatalf("501 rune seharusnya ErrWishTooLong, dapat %v", err)
	}
}

// U2: pemetaan error ucapan ke status HTTP. Konflik "sudah pernah" mengikuti
// ErrGroupNameTaken (400), BUKAN 409 - hanya server yang tahu duluan lewat
// UNIQUE, dan tamu harus membaca pesannya, bukan menebak arti status.
func TestStatusHTTPCode_Wishes(t *testing.T) {
	tests := []struct {
		err  error
		want int
	}{
		{ErrWishNotFound, 404},
		{ErrWishAlreadySubmitted, 400},
		{ErrWishEmpty, 400},
		{ErrWishTooLong, 400},
	}
	for _, tt := range tests {
		if got := StatusHTTPCode(tt.err); got != tt.want {
			t.Errorf("StatusHTTPCode(%v) = %d, mau %d", tt.err, got, tt.want)
		}
	}
}

// U3: batas slider mengunci keputusan D7 (30 terbaru) agar tidak berubah
// diam-diam - batas ini juga menentukan beban query publik yang terbuka.
func TestPublicWishLimit(t *testing.T) {
	if publicWishLimit != 30 {
		t.Errorf("publicWishLimit = %d, mau 30 (keputusan D7)", publicWishLimit)
	}
	if maxWishLength != 500 {
		t.Errorf("maxWishLength = %d, mau 500 (sama dengan VARCHAR(500))", maxWishLength)
	}
}
