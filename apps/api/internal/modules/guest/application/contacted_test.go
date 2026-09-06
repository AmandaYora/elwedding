package application

import "testing"

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
