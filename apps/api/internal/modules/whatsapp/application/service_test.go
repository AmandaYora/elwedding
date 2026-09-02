package application

import "testing"

// Menguji normalisasi nomor lokal (08xx) & format +62 ke 62xxxxxxxxxx yang
// dipakai types.NewJID (dashboard-wa-rsvp §9.3/E2).
func TestNormalizePhone(t *testing.T) {
	cases := []struct {
		in     string
		want   string
		wantOK bool
	}{
		{"08123456789", "628123456789", true},
		{"+628123456789", "628123456789", true},
		{"628123456789", "628123456789", true},
		{"0812-3456-789", "628123456789", true},
		{" 08123456789 ", "628123456789", true},
		{"", "", false},
		{"   ", "", false},
	}
	for _, tc := range cases {
		got, ok := normalizePhone(tc.in)
		if ok != tc.wantOK {
			t.Errorf("normalizePhone(%q) ok = %v, want %v", tc.in, ok, tc.wantOK)
			continue
		}
		if ok && got != tc.want {
			t.Errorf("normalizePhone(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// Menguji substitusi placeholder template pesan (dashboard-wa-rsvp §6.2).
func TestApplyTemplate(t *testing.T) {
	tpl := "Halo {nama}! Kehadiran {jumlah} orang di pernikahan {mempelai} pada {tanggal}."
	got := applyTemplate(tpl, "Budi", 2, "Siti & Budi", "Minggu, 12 Oktober 2026")
	want := "Halo Budi! Kehadiran 2 orang di pernikahan Siti & Budi pada Minggu, 12 Oktober 2026."
	if got != want {
		t.Fatalf("applyTemplate() = %q, want %q", got, want)
	}
}

func TestApplyTemplate_MissingPlaceholdersLeftUntouched(t *testing.T) {
	got := applyTemplate("Pesan statis tanpa placeholder.", "Budi", 1, "A & B", "1 Jan 2026")
	want := "Pesan statis tanpa placeholder."
	if got != want {
		t.Fatalf("applyTemplate() = %q, want %q", got, want)
	}
}
