package application

import (
	"errors"
	"testing"
)

// Username Telegram tamu (migration 000022, kolom username_telegram).
//
// normalizeTelegramUsername adalah FUNGSI MURNI - tanpa koneksi database,
// pola yang sama dengan parseContactedFilter di contacted_test.go.
func TestNormalizeTelegramUsername(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    string
		wantErr error
	}{
		{"kosong = tidak punya Telegram", "", "", nil},
		{"@ di depan dibuang", "@dimas_pras", "dimas_pras", nil},
		{"spasi dirapikan", "  Dimas_Pras  ", "dimas_pras", nil},
		{"huruf besar direndahkan", "ArianaAdrian_26", "arianaadrian_26", nil},
		{"minimal 5 karakter", "abcde", "abcde", nil},
		{"maksimal 32 karakter", "abcdefghijklmnopqrstuvwxyz123456", "abcdefghijklmnopqrstuvwxyz123456", nil},
		{"terlalu pendek ditolak", "abcd", "", ErrInvalidTelegramUsername},
		{"terlalu panjang ditolak", "abcdefghijklmnopqrstuvwxyz1234567", "", ErrInvalidTelegramUsername},
		{"spasi di tengah ditolak", "dimas pras", "", ErrInvalidTelegramUsername},
		{"titik ditolak", "dimas.pras", "", ErrInvalidTelegramUsername},
		{"tanda hubung ditolak", "dimas-pras", "", ErrInvalidTelegramUsername},
		{"hanya @ ditolak sebagai kosong", "@", "", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeTelegramUsername(tt.input)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("normalizeTelegramUsername(%q) err = %v, want %v", tt.input, err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("normalizeTelegramUsername(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestStatusHTTPCode_TelegramUsernameInvalidIs400(t *testing.T) {
	if got := StatusHTTPCode(ErrInvalidTelegramUsername); got != 400 {
		t.Fatalf("StatusHTTPCode(ErrInvalidTelegramUsername) = %d, want 400", got)
	}
}
