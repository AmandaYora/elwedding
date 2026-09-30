package application

import (
	"errors"
	"testing"
	"time"
)

// Helper murni modul telegram: normalizeUsername, nextRetryDelay, dan
// applyTemplate diuji tanpa koneksi Telegram/DB - pola yang sama dengan
// service_test.go milik modul whatsapp.

func TestNormalizeUsername(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
		ok    bool
	}{
		{"kanonis lolos", "dimas_pras", "dimas_pras", true},
		{"@ dibuang", "@dimas_pras", "dimas_pras", true},
		{"kosong = lewati", "", "", false},
		{"hanya @ = lewati", "@", "", false},
		{"terlalu pendek", "abcd", "", false},
		{"karakter ilegal", "dimas.pras", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := normalizeUsername(tt.input)
			if ok != tt.ok || got != tt.want {
				t.Fatalf("normalizeUsername(%q) = (%q, %v), want (%q, %v)", tt.input, got, ok, tt.want, tt.ok)
			}
		})
	}
}

// nextRetryDelay MENGIKAT tabel backoff ±4 jam milik whatsapp
// (whatsapp-connection-resilience §3.1): menaik, dan mentok di 3 jam.
func TestNextRetryDelay(t *testing.T) {
	if got := nextRetryDelay(0); got != time.Minute {
		t.Fatalf("nextRetryDelay(0) = %v, want 1m", got)
	}
	if got := nextRetryDelay(4); got != 3*time.Hour {
		t.Fatalf("nextRetryDelay(4) = %v, want 3h", got)
	}
	// Melebihi tabel = mentok, bukan panic/index-out-of-range.
	if got := nextRetryDelay(99); got != 3*time.Hour {
		t.Fatalf("nextRetryDelay(99) = %v, want 3h", got)
	}
	if got := nextRetryDelay(-1); got != time.Minute {
		t.Fatalf("nextRetryDelay(-1) = %v, want 1m", got)
	}
}

func TestApplyTemplate(t *testing.T) {
	got := applyTemplate("Halo {nama} ({jumlah} orang) di {mempelai} pada {tanggal}!", "Budi", 2, "Ariana & Adrian", "14 Februari 2027")
	want := "Halo Budi (2 orang) di Ariana & Adrian pada 14 Februari 2027!"
	if got != want {
		t.Fatalf("applyTemplate = %q, want %q", got, want)
	}
}

// Cermin TestApplyInvitationTemplate whatsapp: kamus undangan TANPA {jumlah}.
func TestApplyInvitationTemplate(t *testing.T) {
	got := applyInvitationTemplate("Halo {nama}, undang {mempelai} {tanggal}: {link} ({jumlah})", "Budi", "A & B", "1 Jan 2026", "https://x/?guest=t")
	want := "Halo Budi, undang A & B 1 Jan 2026: https://x/?guest=t ({jumlah})"
	if got != want {
		t.Fatalf("applyInvitationTemplate = %q, want %q", got, want)
	}
}

func TestStatusHTTPCode_Mapping(t *testing.T) {
	cases := []struct {
		err  error
		want int
	}{
		{ErrLogNotFound, 404},
		{ErrSendFailed, 400},
		{ErrNotPaired, 400},
		{ErrAlreadyLoggedIn, 400},
		{ErrCodeInvalid, 400},
		{ErrPasswordNeeded, 400},
		{ErrNoLoginPending, 400},
		{errors.New("tak dikenal"), 500},
	}
	for _, c := range cases {
		if got := StatusHTTPCode(c.err); got != c.want {
			t.Fatalf("StatusHTTPCode(%v) = %d, want %d", c.err, got, c.want)
		}
	}
}
