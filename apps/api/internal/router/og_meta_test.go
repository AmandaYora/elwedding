package router

import (
	"strings"
	"testing"

	contentContracts "undangan-ariana-adrian/internal/modules/content/contracts"
)

// TEST REGRESI D8 (docs/plan/og-share-image-dinamis/PLAN.md).
//
// Kolom cover BISA berisi video: migration 000010_cover_to_video benar-benar
// pernah menyetel cover ke .mp4, dan isVideoUrl di frontend memang menerima
// .mp4/.webm. Kalau penjagaan ekstensi ini hilang, fallback K4 justru
// memasang URL video (atau WebP yang tidak dirender crawler WhatsApp) sebagai
// og:image - preview rusak, persis bug yang plan ini perbaiki. Jangan
// melonggarkan daftar izin di waImageExts tanpa membaca ini.
func TestIsWaCompatibleImage(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{"/uploads/images/a.png", true},
		{"/uploads/images/a.jpg", true},
		{"/uploads/images/a.jpeg", true},
		{"/uploads/images/A.JPG", true},
		{"/uploads/images/a.jpg?v=2", true},
		{"/uploads/images/a.png#frag", true},
		{"https://cdn.example.com/x/b.jpeg", true},

		{"/uploads/images/a.webp", false},
		{"/uploads/images/a.gif", false},
		{"/uploads/images/a.mp4", false},
		{"/uploads/images/a.webm", false},
		{"/uploads/images/a", false},
		{"", false},
	}
	for _, tc := range tests {
		if got := isWaCompatibleImage(tc.path); got != tc.want {
			t.Errorf("isWaCompatibleImage(%q) = %v, mau %v", tc.path, got, tc.want)
		}
	}
}

// Urutan fallback K4: gambar preview khusus -> Gambar Cover -> "" (tag statis).
func TestPickShareImage(t *testing.T) {
	tests := []struct {
		name string
		info contentContracts.ShareInfo
		want string
	}{
		{
			name: "share terisi dipakai lebih dulu",
			info: contentContracts.ShareInfo{ShareImageUrl: "/uploads/images/share.jpg", CoverImageUrl: "/uploads/images/cover.jpg"},
			want: "/uploads/images/share.jpg",
		},
		{
			name: "share kosong jatuh ke cover",
			info: contentContracts.ShareInfo{ShareImageUrl: "", CoverImageUrl: "/uploads/images/cover.jpg"},
			want: "/uploads/images/cover.jpg",
		},
		{
			// D8: cover berisi video harus DILEWATI, bukan dipasang.
			name: "cover berisi mp4 dilewati",
			info: contentContracts.ShareInfo{ShareImageUrl: "", CoverImageUrl: "/uploads/images/cover.mp4"},
			want: "",
		},
		{
			name: "share webp dilewati, jatuh ke cover jpg",
			info: contentContracts.ShareInfo{ShareImageUrl: "/uploads/images/share.webp", CoverImageUrl: "/uploads/images/cover.jpg"},
			want: "/uploads/images/cover.jpg",
		},
		{
			name: "keduanya kosong",
			info: contentContracts.ShareInfo{},
			want: "",
		},
	}
	for _, tc := range tests {
		if got := pickShareImage(tc.info); got != tc.want {
			t.Errorf("%s: pickShareImage = %q, mau %q", tc.name, got, tc.want)
		}
	}
}

// K2: judul preview memakai nama pasangan, bukan "Undangan Pernikahan".
func TestBuildOgTitle(t *testing.T) {
	tests := []struct {
		bride, groom, want string
	}{
		{"Ariana", "Adrian", "Ariana & Adrian"},
		{"Ariana", "", "Ariana"},
		{"", "Adrian", "Adrian"},
		{"", "", ""},
		{"  ", "  ", ""},
	}
	for _, tc := range tests {
		got := buildOgTitle(contentContracts.ShareInfo{BrideName: tc.bride, GroomName: tc.groom})
		if got != tc.want {
			t.Errorf("buildOgTitle(%q,%q) = %q, mau %q", tc.bride, tc.groom, got, tc.want)
		}
	}
}

func TestOgAbsoluteURL(t *testing.T) {
	tests := []struct {
		origin, path, want string
	}{
		{"https://x.test", "/uploads/a.jpg", "https://x.test/uploads/a.jpg"},
		{"https://x.test/", "/uploads/a.jpg", "https://x.test/uploads/a.jpg"},
		{"https://x.test", "uploads/a.jpg", "https://x.test/uploads/a.jpg"},
		{"https://x.test", "/", "https://x.test/"},
		// Sudah absolut - JANGAN diprefiks lagi.
		{"https://x.test", "https://cdn.test/a.jpg", "https://cdn.test/a.jpg"},
		{"https://x.test", "http://cdn.test/a.jpg", "http://cdn.test/a.jpg"},
		{"https://x.test", "", ""},
		{"", "/uploads/a.jpg", "/uploads/a.jpg"},
	}
	for _, tc := range tests {
		if got := ogAbsoluteURL(tc.origin, tc.path); got != tc.want {
			t.Errorf("ogAbsoluteURL(%q,%q) = %q, mau %q", tc.origin, tc.path, got, tc.want)
		}
	}
}

const testHTML = `<head>
<!--OG_META_START-->
    <meta property="og:title" content="Undangan Pernikahan" />
<!--OG_META_END-->
</head>`

func TestInjectOgMeta(t *testing.T) {
	t.Run("marker lengkap: isi lama diganti", func(t *testing.T) {
		out := string(injectOgMeta([]byte(testHTML), "\n    BARU\n"))
		if strings.Contains(out, "Undangan Pernikahan") {
			t.Error("isi statis lama masih ada, seharusnya diganti")
		}
		if !strings.Contains(out, "BARU") {
			t.Error("isi baru tidak tersuntik")
		}
		// Marker WAJIB tetap ada supaya injeksi berikutnya masih bekerja.
		if !strings.Contains(out, ogMarkerStart) || !strings.Contains(out, ogMarkerEnd) {
			t.Error("marker hilang setelah injeksi")
		}
		if !strings.Contains(out, "</head>") {
			t.Error("bagian HTML di luar marker ikut termakan")
		}
	})

	t.Run("marker hilang: HTML apa adanya", func(t *testing.T) {
		src := "<head><meta property=\"og:title\" content=\"x\" /></head>"
		if out := string(injectOgMeta([]byte(src), "BARU")); out != src {
			t.Errorf("tanpa marker HTML harus utuh, dapat %q", out)
		}
	})

	t.Run("hanya marker start: HTML apa adanya", func(t *testing.T) {
		src := "<head>" + ogMarkerStart + "<meta/></head>"
		if out := string(injectOgMeta([]byte(src), "BARU")); out != src {
			t.Errorf("marker end hilang, HTML harus utuh, dapat %q", out)
		}
	})

	t.Run("tags kosong: HTML apa adanya", func(t *testing.T) {
		if out := string(injectOgMeta([]byte(testHTML), "")); out != testHTML {
			t.Error("tags kosong harus mengembalikan HTML apa adanya")
		}
	})
}

func TestHasOgMarkers(t *testing.T) {
	if !hasOgMarkers([]byte(testHTML)) {
		t.Error("HTML bermarker lengkap harus true")
	}
	if hasOgMarkers([]byte("<head></head>")) {
		t.Error("HTML tanpa marker harus false")
	}
	if hasOgMarkers([]byte("<head>" + ogMarkerEnd + ogMarkerStart + "</head>")) {
		t.Error("marker terbalik harus false")
	}
}

// Nama mempelai berasal dari input admin dan bisa memuat " atau &. Tanpa
// escape, satu tanda kutip saja memutus atribut content dan merusak seluruh
// blok meta - preview jadi kosong tanpa error apa pun.
func TestBuildOgTags_EscapeNilaiTeks(t *testing.T) {
	info := contentContracts.ShareInfo{
		BrideName:        `Ari"ana`,
		GroomName:        `Adrian & Co`,
		WeddingDateLabel: `Sabtu, 1 "Januari" 2027`,
		ShareImageUrl:    "/uploads/images/share.jpg",
	}
	out := buildOgTags("https://x.test", info)

	if strings.Contains(out, `Ari"ana`) {
		t.Error(`tanda kutip mentah lolos ke atribut content`)
	}
	if !strings.Contains(out, "&#34;") {
		t.Error("tanda kutip tidak di-escape jadi &#34;")
	}
	if strings.Contains(out, "Adrian & Co") {
		t.Error("ampersand mentah lolos ke atribut content")
	}
	if !strings.Contains(out, "Adrian &amp; Co") {
		t.Error("ampersand tidak di-escape jadi &amp;")
	}
}

func TestBuildOgTags(t *testing.T) {
	t.Run("lengkap", func(t *testing.T) {
		info := contentContracts.ShareInfo{
			BrideName:        "Ariana",
			GroomName:        "Adrian",
			WeddingDateLabel: "Sabtu, 1 Januari 2027",
			ShareImageUrl:    "/uploads/images/share.jpg",
			CoverImageUrl:    "/uploads/images/cover.jpg",
		}
		out := buildOgTags("https://x.test", info)

		for _, want := range []string{
			`<meta property="og:title" content="Ariana &amp; Adrian" />`,
			`<meta property="og:image" content="https://x.test/uploads/images/share.jpg" />`,
			`<meta property="og:image:type" content="image/jpeg" />`,
			`<meta property="og:url" content="https://x.test/" />`,
			`<meta property="twitter:card" content="summary_large_image" />`,
			`<meta property="twitter:image" content="https://x.test/uploads/images/share.jpg" />`,
			"Sabtu, 1 Januari 2027",
		} {
			if !strings.Contains(out, want) {
				t.Errorf("keluaran tidak memuat %q\n---\n%s", want, out)
			}
		}
		// Cover tidak boleh ikut terpasang saat share sudah ada.
		if strings.Contains(out, "cover.jpg") {
			t.Error("cover ikut terpasang padahal share image tersedia")
		}
	})

	t.Run("png memberi og:image:type image/png", func(t *testing.T) {
		info := contentContracts.ShareInfo{BrideName: "A", GroomName: "B", ShareImageUrl: "/uploads/images/s.png"}
		if !strings.Contains(buildOgTags("https://x.test", info), `content="image/png"`) {
			t.Error("og:image:type PNG salah")
		}
	})

	t.Run("tanpa gambar layak: kosong walau nama tersedia", func(t *testing.T) {
		// Gerbangnya GAMBAR, bukan judul. Injeksi mengganti SELURUH isi
		// marker, jadi menyuntik judul saja akan menghapus og:image statis
		// dan menyisakan preview tanpa gambar apa pun - lebih buruk daripada
		// menampilkan frame template. "" berarti seluruh tag statis
		// index.html (termasuk frame-cover.png) dipakai apa adanya, yaitu
		// fallback terakhir yang disepakati (D7 & §3.2 plan; kriteria T16 #7).
		info := contentContracts.ShareInfo{
			BrideName:     "Ariana",
			GroomName:     "Adrian",
			CoverImageUrl: "/uploads/images/cover.mp4",
		}
		if got := buildOgTags("https://x.test", info); got != "" {
			t.Errorf("mau string kosong, dapat %q", got)
		}
	})

	t.Run("tanpa nama sama sekali: gambar tetap disuntik dengan judul cadangan", func(t *testing.T) {
		info := contentContracts.ShareInfo{ShareImageUrl: "/uploads/images/share.jpg"}
		out := buildOgTags("https://x.test", info)
		if !strings.Contains(out, "share.jpg") {
			t.Error("og:image tidak tersuntik")
		}
		// Blok tanpa judul apa pun akan menghapus og:title statis juga.
		if !strings.Contains(out, `content="`+ogFallbackTitle+`"`) {
			t.Errorf("judul cadangan tidak dipakai: %s", out)
		}
	})
}
