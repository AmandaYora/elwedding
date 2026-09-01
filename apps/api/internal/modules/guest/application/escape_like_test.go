package application

import "testing"

// Menguji keputusan #10 (admin-ui-redesign/PLAN.md): tanpa escaping,
// pencarian "%" mentah mengembalikan seluruh tabel - dibuktikan lewat
// MySQL sungguhan di PLAN.md §1.3 ("Bukti runtime"). Test ini menjaga
// perilaku escapeLike itu tidak regresi. Sejak guest-fields-admin-layout
// keputusan #13, service.List memakai HASIL escapeLike yang SAMA untuk
// mencocokkan name, phone, DAN email sekaligus (satu parameter sqlc.narg
// dipakai di tiga klausa OR LIKE) - jadi menjaga fungsi ini tetap benar
// otomatis ikut melindungi pencarian email.
func TestEscapeLike(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"budi", "%budi%"},
		{"50%", `%50\%%`},
		{"a_b", `%a\_b%`},
		{`back\slash`, `%back\\slash%`},
		{"", "%%"},
	}
	for _, tc := range cases {
		got := escapeLike(tc.in)
		if got != tc.want {
			t.Errorf("escapeLike(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}
