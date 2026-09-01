package application

import (
	"testing"
	"time"

	"undangan-ariana-adrian/internal/modules/content/infrastructure/sqlc"
)

// Menguji keputusan #16/F18 (PLAN.md): weddingDateUnix harus epoch DETIK
// yang konsisten terlepas dari timezone server, dihitung dari kolom
// DATETIME yang sudah dalam lokasi Asia/Jakarta. Nilai 1778904000 sudah
// diverifikasi manual (lihat PLAN.md §2.3) = Sabtu, 16 Mei 2026 11:00 WIB.
func TestToContentDTO_WeddingDateUnix(t *testing.T) {
	s := &Service{}
	wd := time.Date(2026, time.May, 16, 11, 0, 0, 0, jakarta)

	dto := s.toContentDTO(sqlc.InvitationContent{WeddingDate: wd})

	const want = int64(1778904000)
	if dto.WeddingDateUnix != want {
		t.Fatalf("WeddingDateUnix = %d, want %d", dto.WeddingDateUnix, want)
	}
	if dto.WeddingDateLabel != "Saturday, 16 May 2026" {
		t.Fatalf("WeddingDateLabel = %q, want %q", dto.WeddingDateLabel, "Saturday, 16 May 2026")
	}
}

// weddingDateUnix harus SAMA walau kolomnya disimpan dalam representasi
// waktu yang secara instan identik namun location Go-nya berbeda (mis. UTC
// vs Asia/Jakarta) - epoch tidak boleh bergeser karena parsing location.
func TestToContentDTO_WeddingDateUnix_TimezoneIndependent(t *testing.T) {
	s := &Service{}
	wdJakarta := time.Date(2026, time.May, 16, 11, 0, 0, 0, jakarta)
	wdUTC := wdJakarta.UTC()

	dtoJakarta := s.toContentDTO(sqlc.InvitationContent{WeddingDate: wdJakarta})
	dtoUTC := s.toContentDTO(sqlc.InvitationContent{WeddingDate: wdUTC})

	if dtoJakarta.WeddingDateUnix != dtoUTC.WeddingDateUnix {
		t.Fatalf("epoch berbeda antar representasi timezone: jakarta=%d utc=%d",
			dtoJakarta.WeddingDateUnix, dtoUTC.WeddingDateUnix)
	}
}
