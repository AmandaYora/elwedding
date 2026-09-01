package application

import "testing"

// Menguji keputusan #2 (dashboard-wa-rsvp): attendingCount di luar {1,2}
// saat status 'attending' harus ditolak; status lain mengabaikan
// attendingCount sepenuhnya (dinetralkan ke 1).
func TestResolveAttendingCount_AttendingRequiresOneOrTwo(t *testing.T) {
	cases := []struct {
		status    string
		requested int
		want      int
		wantErr   error
	}{
		{"attending", 1, 1, nil},
		{"attending", 2, 2, nil},
		{"attending", 0, 0, ErrInvalidAttendingCount},
		{"attending", 3, 0, ErrInvalidAttendingCount},
		{"attending", -1, 0, ErrInvalidAttendingCount},
		{"not_attending", 5, 1, nil},
		{"not_attending", 0, 1, nil},
		{"remind_later", 99, 1, nil},
	}
	for _, tc := range cases {
		got, err := resolveAttendingCount(tc.status, tc.requested)
		if err != tc.wantErr {
			t.Errorf("resolveAttendingCount(%q, %d) error = %v, want %v", tc.status, tc.requested, err, tc.wantErr)
			continue
		}
		if err == nil && got != tc.want {
			t.Errorf("resolveAttendingCount(%q, %d) = %d, want %d", tc.status, tc.requested, got, tc.want)
		}
	}
}

// StatusHTTPCode(ErrInvalidAttendingCount) HARUS 400, bukan 500 - kalau
// registrasi di cabang 400 StatusHTTPCode terlewat, input salah balas 500.
func TestStatusHTTPCode_InvalidAttendingCountIs400(t *testing.T) {
	if got := StatusHTTPCode(ErrInvalidAttendingCount); got != 400 {
		t.Fatalf("StatusHTTPCode(ErrInvalidAttendingCount) = %d, want 400", got)
	}
}
