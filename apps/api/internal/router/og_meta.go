// Meta Open Graph dinamis untuk halaman undangan tamu - docs/plan/
// og-share-image-dinamis/PLAN.md T5.
//
// Seluruh berkas ini MURNI: tidak ada HTTP, tidak ada DB, tidak ada I/O.
// Pemisahan itu disengaja supaya aturan yang paling mudah salah (ekstensi
// mana yang boleh jadi og:image, urutan fallback gambar, escaping nama
// mempelai) bisa dites langsung tanpa menyalakan server maupun database -
// lihat og_meta_test.go. Penyambungannya ke request ada di router.go.
package router

import (
	"html"
	"path"
	"strings"

	contentContracts "undangan-ariana-adrian/internal/modules/content/contracts"
)

// Marker yang membungkus blok <meta> statis di apps/web/index.html. Injeksi
// mengganti ISI di antara keduanya, bukan mencari-ganti nilai atribut (D7) -
// dengan begitu tag statisnya tetap utuh sebagai fallback yang sah dan
// mekanismenya tidak rapuh terhadap perubahan urutan/spasi HTML.
const (
	ogMarkerStart = "<!--OG_META_START-->"
	ogMarkerEnd   = "<!--OG_META_END-->"
)

// Ekstensi yang PASTI dirender crawler WhatsApp/Facebook sebagai gambar
// preview. Sengaja daftar-izin, bukan daftar-tolak: kolom cover boleh berisi
// .mp4/.webm (migration 000010) dan .webp - ketiganya membuat preview rusak.
var waImageExts = map[string]bool{".png": true, ".jpg": true, ".jpeg": true}

// ogAbsoluteURL menggabungkan origin dengan path relatif. URL yang SUDAH
// absolut dikembalikan apa adanya - gambar bisa saja disajikan dari host lain
// (mis. object storage) dan tidak boleh diprefiks dua kali.
func ogAbsoluteURL(origin, p string) string {
	if p == "" {
		return ""
	}
	lower := strings.ToLower(p)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return p
	}
	if origin == "" {
		return p
	}
	return strings.TrimSuffix(origin, "/") + "/" + strings.TrimPrefix(p, "/")
}

// isWaCompatibleImage: penjaga D8. Query/fragment dibuang dulu supaya
// "/uploads/images/a.jpg?v=2" tetap terbaca sebagai JPG.
func isWaCompatibleImage(p string) bool {
	if p == "" {
		return false
	}
	if i := strings.IndexAny(p, "?#"); i != -1 {
		p = p[:i]
	}
	return waImageExts[strings.ToLower(path.Ext(p))]
}

// pickShareImage menerapkan urutan fallback K4: gambar preview khusus, lalu
// Gambar Cover, lalu "" yang berarti "biarkan tag statis index.html dipakai".
// Keduanya disaring isWaCompatibleImage - cover yang berisi video atau WebP
// dilewati, bukan dipasang dan merusak preview.
func pickShareImage(info contentContracts.ShareInfo) string {
	if isWaCompatibleImage(info.ShareImageUrl) {
		return info.ShareImageUrl
	}
	if isWaCompatibleImage(info.CoverImageUrl) {
		return info.CoverImageUrl
	}
	return ""
}

// buildOgTitle: realisasi K2 - judul preview memakai nama pasangan, bukan
// string generik "Undangan Pernikahan".
func buildOgTitle(info contentContracts.ShareInfo) string {
	bride := strings.TrimSpace(info.BrideName)
	groom := strings.TrimSpace(info.GroomName)
	switch {
	case bride != "" && groom != "":
		return bride + " & " + groom
	case bride != "":
		return bride
	default:
		return groom
	}
}

// buildOgDescription memakai tanggal acara bila ada, supaya preview membawa
// informasi yang benar-benar berbeda per undangan. Tanpa tanggal, jatuh ke
// kalimat undangan biasa - bukan string kosong, karena og:description yang
// kosong membuat WhatsApp menampilkan potongan teks acak dari halaman.
func buildOgDescription(info contentContracts.ShareInfo) string {
	if label := strings.TrimSpace(info.WeddingDateLabel); label != "" {
		return "Dengan hormat kami mengundang Anda ke pernikahan kami pada " + label + "."
	}
	return "Dengan hormat kami mengundang Anda ke acara pernikahan kami."
}

// ogImageType memetakan ekstensi ke nilai og:image:type. Dipanggil hanya
// untuk path yang sudah lolos isWaCompatibleImage.
func ogImageType(p string) string {
	if i := strings.IndexAny(p, "?#"); i != -1 {
		p = p[:i]
	}
	if strings.ToLower(path.Ext(p)) == ".png" {
		return "image/png"
	}
	return "image/jpeg"
}

// ogTag merangkai satu <meta property> dengan nilai yang SUDAH di-escape.
// Nama mempelai berasal dari input admin dan bisa memuat " atau & - tanpa
// escape, satu tanda kutip saja sudah cukup merusak seluruh blok meta.
func ogTag(property, content string) string {
	return `    <meta property="` + property + `" content="` + html.EscapeString(content) + `" />` + "\n"
}

// Judul cadangan bila kedua nama mempelai kosong. Sengaja SAMA dengan nilai
// statis di index.html: blok hasil injeksi menggantikan seluruh isi marker,
// jadi tanpa ini preview bisa keluar bergambar tapi tanpa judul sama sekali.
const ogFallbackTitle = "Undangan Pernikahan"

// buildOgTags menyusun blok pengganti isi marker. Mengembalikan "" bila tidak
// ada GAMBAR yang layak - artinya seluruh tag statis index.html dipakai apa
// adanya, termasuk frame-cover.png sebagai fallback terakhir (D7 & §3.2 plan).
//
// Gerbangnya sengaja gambar, bukan judul: injeksi mengganti SELURUH isi
// marker, jadi menyuntik judul saja akan MENGHAPUS og:image statis dan
// menyisakan preview tanpa gambar apa pun - lebih buruk daripada menampilkan
// frame template. Inilah yang terjadi saat kolom cover berisi .mp4 (D8).
func buildOgTags(origin string, info contentContracts.ShareInfo) string {
	image := ogAbsoluteURL(origin, pickShareImage(info))
	if image == "" {
		return ""
	}

	title := buildOgTitle(info)
	if title == "" {
		title = ogFallbackTitle
	}
	description := buildOgDescription(info)
	pageURL := ogAbsoluteURL(origin, "/")

	var b strings.Builder
	b.WriteString("\n")
	b.WriteString(ogTag("og:type", "website"))
	b.WriteString(ogTag("og:site_name", title))
	if pageURL != "" {
		b.WriteString(ogTag("og:url", pageURL))
	}
	b.WriteString(ogTag("og:title", title))
	b.WriteString(ogTag("og:description", description))
	b.WriteString(ogTag("og:image", image))
	b.WriteString(ogTag("og:image:type", ogImageType(image)))
	b.WriteString(ogTag("og:locale", "in_ID"))

	// twitter:* dipasang sepadan supaya preview di platform yang membacanya
	// tidak jatuh ke nilai statis yang sudah tidak cocok lagi dengan og:*.
	b.WriteString(ogTag("twitter:card", "summary_large_image"))
	if pageURL != "" {
		b.WriteString(ogTag("twitter:url", pageURL))
	}
	b.WriteString(ogTag("twitter:title", title))
	b.WriteString(ogTag("twitter:description", description))
	b.WriteString(ogTag("twitter:image", image))
	b.WriteString("    ")
	return b.String()
}

// hasOgMarkers: apakah HTML ini punya sepasang marker yang bisa diisi. Dipakai
// pemanggil untuk memutuskan "inject" vs "sajikan statis" secara eksplisit,
// alih-alih menebaknya dari hasil injectOgMeta.
func hasOgMarkers(htmlBytes []byte) bool {
	s := string(htmlBytes)
	start := strings.Index(s, ogMarkerStart)
	if start == -1 {
		return false
	}
	return strings.Contains(s[start:], ogMarkerEnd)
}

// injectOgMeta mengganti isi di antara kedua marker. Bila salah satu marker
// tidak ada, urutannya terbalik, atau tags kosong - HTML dikembalikan APA
// ADANYA. Halaman undangan tidak boleh rusak hanya karena preview tidak bisa
// dipersonalisasi.
func injectOgMeta(htmlBytes []byte, tags string) []byte {
	if tags == "" {
		return htmlBytes
	}
	s := string(htmlBytes)
	start := strings.Index(s, ogMarkerStart)
	if start == -1 {
		return htmlBytes
	}
	end := strings.Index(s[start:], ogMarkerEnd)
	if end == -1 {
		return htmlBytes
	}
	end += start

	return []byte(s[:start+len(ogMarkerStart)] + tags + s[end:])
}
