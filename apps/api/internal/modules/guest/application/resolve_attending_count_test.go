package application

import "testing"

// Menguji docs/plan/guest-pax-quota/PLAN.md T11/D4, yang MENGGANTIKAN keputusan
// #2 dashboard-wa-rsvp (cap mati 1-2).
//
// Yang berubah: batas atasnya kini `quota` milik tamu, bukan angka 2 untuk
// semua orang. Kasus ("attending", 3, 2) tetap ditolak - tamu umum berjatah 2
// memang tidak boleh 3 - tapi ("attending", 6, 6) kini SAH, dan itulah bug
// yang diperbaiki: undangan "paman + istri + 4 anak" dulu tercatat 2 orang.
func TestResolveAttendingCount_BatasAtasnyaQuotaTamu(t *testing.T) {
	cases := []struct {
		name      string
		status    string
		requested int
		quota     int
		want      int
		wantErr   error
	}{
		// Tamu umum berjatah 2 - perilaku lama HARUS utuh.
		{"umum pilih 1", "attending", 1, 2, 1, nil},
		{"umum pilih 2", "attending", 2, 2, 2, nil},
		{"umum pilih 3 ditolak", "attending", 3, 2, 0, ErrInvalidAttendingCount},

		// Keluarga berjatah lebih besar - inti fitur ini.
		{"keluarga pakai penuh", "attending", 6, 6, 6, nil},
		{"keluarga pakai sebagian", "attending", 5, 6, 5, nil},
		{"keluarga lebihi jatah", "attending", 7, 6, 0, ErrInvalidAttendingCount},

		// Jatah 1 (mis. Bulek Sri) - satu-satunya angka yang sah adalah 1.
		{"jatah satu", "attending", 1, 1, 1, nil},
		{"jatah satu dilampaui", "attending", 2, 1, 0, ErrInvalidAttendingCount},

		// Angka tidak masuk akal ditolak berapa pun jatahnya.
		{"nol ditolak", "attending", 0, 4, 0, ErrInvalidAttendingCount},
		{"negatif ditolak", "attending", -1, 4, 0, ErrInvalidAttendingCount},

		// Status selain 'attending' mengabaikan requested DAN quota
		// sepenuhnya, dinetralkan ke 1 (default kolom). Angkanya tidak pernah
		// ikut dihitung pax manapun.
		{"tidak hadir dinetralkan", "not_attending", 99, 2, 1, nil},
		{"ingatkan nanti dinetralkan", "remind_later", 99, 6, 1, nil},
		{"tidak hadir abaikan nol", "not_attending", 0, 2, 1, nil},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := resolveAttendingCount(tc.status, tc.requested, tc.quota)
			if err != tc.wantErr {
				t.Fatalf("resolveAttendingCount(%q, %d, %d) error = %v, want %v",
					tc.status, tc.requested, tc.quota, err, tc.wantErr)
			}
			if err == nil && got != tc.want {
				t.Fatalf("resolveAttendingCount(%q, %d, %d) = %d, want %d",
					tc.status, tc.requested, tc.quota, got, tc.want)
			}
		})
	}
}

// StatusHTTPCode(ErrInvalidAttendingCount) HARUS 400, bukan 500 - kalau
// registrasi di cabang 400 StatusHTTPCode terlewat, input salah balas 500.
func TestStatusHTTPCode_InvalidAttendingCountIs400(t *testing.T) {
	if got := StatusHTTPCode(ErrInvalidAttendingCount); got != 400 {
		t.Fatalf("StatusHTTPCode(ErrInvalidAttendingCount) = %d, want 400", got)
	}
}
