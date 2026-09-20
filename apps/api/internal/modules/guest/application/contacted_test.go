package application

import (
	"errors"
	"testing"

	"undangan-digital/internal/modules/guest/infrastructure/sqlc"
)

// docs/plan/reservation-reset-contacted-flag/PLAN.md.
//
// ResetRsvp & SetContacted keduanya menyentuh DB, jadi yang bisa diuji tanpa
// koneksi hanyalah kontrak error-nya. Itu bukan formalitas: kalau ErrNotFound
// dari requireGuestExists tidak lagi dipetakan ke 404, admin yang bekerja dari
// daftar basi akan menerima 500 dan mengira server rusak - padahal barisnya
// memang sudah dihapus orang lain.
func TestStatusHTTPCode_NotFoundIs404ForSubResources(t *testing.T) {
	if got := StatusHTTPCode(ErrNotFound); got != 404 {
		t.Fatalf("StatusHTTPCode(ErrNotFound) = %d, want 404", got)
	}
}

// Filter tahap undangan (docs/plan/guest-stage-filter/PLAN.md T12).
//
// parseContactedFilter adalah FUNGSI MURNI - tanpa koneksi database, pola yang
// sama dengan parseGroupIDFilter di group_test.go.

func TestParseContactedFilter(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    int64
		wantErr error
	}{
		{"kosong = tanpa filter", "", contactedFilterAny, nil},
		{"true = sudah dihubungi", "true", contactedFilterYes, nil},
		{"false = belum dihubungi", "false", contactedFilterNo, nil},
		// Keempat nilai di bawah adalah cara paling gampang filter ini rusak
		// tanpa gejala. Kalau salah satunya lolos sebagai "tanpa filter",
		// daftar berlabel "Belum diundang" akan menampilkan SELURUH tamu dan
		// admin mengirim ulang undangan ke orang yang sudah menjawab.
		{"salah ketik ditolak", "flase", contactedFilterAny, ErrInvalidContactedFilter},
		{"angka ditolak", "1", contactedFilterAny, ErrInvalidContactedFilter},
		{"beda kapital ditolak", "TRUE", contactedFilterAny, ErrInvalidContactedFilter},
		{"sinonim ditolak", "yes", contactedFilterAny, ErrInvalidContactedFilter},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseContactedFilter(tt.input)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("parseContactedFilter(%q) error = %v, mau %v", tt.input, err, tt.wantErr)
			}
			if got != tt.want {
				t.Fatalf("parseContactedFilter(%q) = %d, mau %d", tt.input, got, tt.want)
			}
		})
	}
}

// ErrInvalidContactedFilter WAJIB terdaftar di cabang 400. Error domain yang
// lupa didaftarkan jatuh ke `default` dan dibalas 500, sehingga salah ketik
// admin tampak seperti server rusak - tanpa gejala lain yang menunjukkan
// penyebabnya. Alasan yang sama dengan penjaga 404 di atas.
func TestStatusHTTPCode_InvalidContactedFilterIs400(t *testing.T) {
	if got := StatusHTTPCode(ErrInvalidContactedFilter); got != 400 {
		t.Fatalf("StatusHTTPCode(ErrInvalidContactedFilter) = %d, want 400", got)
	}
}

// contactedFilterAny HARUS 0, bukan sekadar "salah satu kode".
//
// Nilainya adalah zero value field ContactedFilter di ListGuestsFilteredParams,
// dan SearchForCheckin merakit struct itu dengan literal bernama-field tanpa
// menyebut ContactedFilter sama sekali. Begitu konstanta ini bukan 0,
// pencarian check-in petugas gate diam-diam tersaring - tamu yang sudah/belum
// dihubungi hilang dari hasil scan manual tanpa ada yang mengubah kodenya.
func TestContactedFilterAny_AdalahZeroValue(t *testing.T) {
	if contactedFilterAny != 0 {
		t.Fatalf("contactedFilterAny = %d, wajib 0 (zero value struct sqlc)", contactedFilterAny)
	}
	var zero sqlc.ListGuestsFilteredParams
	if zero.ContactedFilter != contactedFilterAny {
		t.Fatalf("zero value ContactedFilter = %d, mau %d", zero.ContactedFilter, contactedFilterAny)
	}
}
