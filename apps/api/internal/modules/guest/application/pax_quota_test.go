package application

import (
	"errors"
	"strings"
	"testing"
)

// docs/plan/guest-pax-quota/PLAN.md T6/D3 - batas jatah kursi 1..20.
func TestValidatePaxQuota(t *testing.T) {
	cases := []struct {
		name    string
		quota   int
		wantErr bool
	}{
		{"batas bawah", 1, false},
		{"default kolom", 2, false},
		{"keluarga", 6, false},
		{"batas atas", 20, false},
		{"nol berarti tidak dikirim klien", 0, true},
		{"negatif", -1, true},
		{"lewat batas atas", 21, true},
		{"salah ketik 20 jadi 200", 200, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := validatePaxQuota(tc.quota)
			if tc.wantErr && !errors.Is(err, ErrInvalidPaxQuota) {
				t.Fatalf("validatePaxQuota(%d) = %v, want ErrInvalidPaxQuota", tc.quota, err)
			}
			if !tc.wantErr && err != nil {
				t.Fatalf("validatePaxQuota(%d) = %v, want nil", tc.quota, err)
			}
		})
	}
}

// canLowerPaxQuota - penjaga D10. Menurunkan jatah di bawah jumlah yang SUDAH
// dijanjikan tamu menghasilkan baris yang tidak koheren, jadi ditolak.
func TestCanLowerPaxQuota(t *testing.T) {
	cases := []struct {
		name           string
		status         string
		attendingCount int
		newQuota       int
		wantErr        bool
	}{
		{"turun di bawah konfirmasi ditolak", "attending", 6, 4, true},
		{"sama dengan konfirmasi boleh", "attending", 6, 6, false},
		{"naik di atas konfirmasi boleh", "attending", 6, 8, false},
		// Tamu yang belum/tidak menjawab belum menjanjikan apa pun, jadi
		// jatahnya bebas diturunkan sampai batas minimum.
		{"pending bebas diturunkan", "pending", 6, 1, false},
		{"remind_later bebas diturunkan", "remind_later", 6, 1, false},
		{"not_attending bebas diturunkan", "not_attending", 6, 1, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			err := canLowerPaxQuota(tc.status, tc.attendingCount, tc.newQuota)
			if !tc.wantErr {
				if err != nil {
					t.Fatalf("canLowerPaxQuota(%q, %d, %d) = %v, want nil",
						tc.status, tc.attendingCount, tc.newQuota, err)
				}
				return
			}
			if !errors.Is(err, ErrPaxQuotaBelowConfirmed) {
				t.Fatalf("canLowerPaxQuota(%q, %d, %d) = %v, want ErrPaxQuotaBelowConfirmed",
					tc.status, tc.attendingCount, tc.newQuota, err)
			}
			// Angkanya WAJIB ikut di pesan (D10): admin ditolak sambil diberi
			// tahu angka yang harus ia hadapi, bukan sekadar "gagal". Pola yang
			// sama dengan canDeleteGroup ("masih dipakai N tamu").
			if !strings.Contains(err.Error(), "6") {
				t.Fatalf("pesan %q tidak menyebut jumlah konfirmasi (6)", err.Error())
			}
		})
	}
}

// Dua-duanya diuji: error domain yang lupa didaftarkan di StatusHTTPCode jatuh
// ke `default` dan dibalas 500, sehingga salah ketik admin tampak seperti
// server rusak - tanpa gejala lain yang menunjukkan penyebabnya.
func TestStatusHTTPCode_PaxQuotaErrorsAre400(t *testing.T) {
	if got := StatusHTTPCode(ErrInvalidPaxQuota); got != 400 {
		t.Errorf("StatusHTTPCode(ErrInvalidPaxQuota) = %d, want 400", got)
	}
	if got := StatusHTTPCode(ErrPaxQuotaBelowConfirmed); got != 400 {
		t.Errorf("StatusHTTPCode(ErrPaxQuotaBelowConfirmed) = %d, want 400", got)
	}
	// Error yang DIBUNGKUS canLowerPaxQuota harus tetap 400 - kalau
	// StatusHTTPCode memakai perbandingan == alih-alih errors.Is, cabang ini
	// yang menangkapnya.
	wrapped := canLowerPaxQuota("attending", 6, 4)
	if got := StatusHTTPCode(wrapped); got != 400 {
		t.Errorf("StatusHTTPCode(error terbungkus) = %d, want 400", got)
	}
}
