package router

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	contentContracts "undangan-ariana-adrian/internal/modules/content/contracts"
)

// Menguji keputusan #17/F17/F20 (PLAN.md): SPA fallback HANYA untuk GET.
// Non-GET ke path yang tidak dikenal harus SELALU JSON 404, tidak pernah
// HTML index.html/admin.html - supaya request POST dari bundle legacy
// (fn_rsvp_init, wedding_gift_form) yang mem-POST ke URL halaman sendiri
// tidak pernah menerima balasan yang bisa memicu $(...).html(res) atau
// window.location.reload() di sisi tamu.
func TestSpaFallback_NonGetAlwaysJSON404(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), "<html>undangan</html>")
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")

	handler := spaFallback(dir, nil)

	for _, method := range []string{http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch} {
		req := httptest.NewRequest(method, "/", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s /: expected 404, got %d", method, rec.Code)
		}
		ct := rec.Header().Get("Content-Type")
		if ct != "application/json" {
			t.Fatalf("%s /: expected Content-Type application/json, got %q (body: %s)", method, ct, rec.Body.String())
		}
	}
}

func TestSpaFallback_GetRootServesIndexHtml(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), "<html>undangan</html>")
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")

	handler := spaFallback(dir, nil)
	req := httptest.NewRequest(http.MethodGet, "/some/spa/route", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || rec.Body.String() != "<html>undangan</html>" {
		t.Fatalf("expected index.html body, got status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestSpaFallback_GetAdminServesAdminHtml(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), "<html>undangan</html>")
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")

	handler := spaFallback(dir, nil)
	req := httptest.NewRequest(http.MethodGet, "/admin/guests", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK || rec.Body.String() != "<html>admin</html>" {
		t.Fatalf("expected admin.html body, got status=%d body=%s", rec.Code, rec.Body.String())
	}
}

// Bug nyata yang ditemukan lewat verifikasi manual (bukan cuma teoretis):
// draf awal `router.New` hanya mendaftarkan handler "/" ketika
// `PublicDir != ""`. Di dev (PUBLIC_DIR kosong, frontend disajikan Vite),
// itu berarti TIDAK ADA handler "/" sama sekali -> permintaan non-GET ke
// path tak dikenal jatuh ke 404 bawaan `http.ServeMux` (`text/plain`),
// bukan JSON - persis yang seharusnya dicegah keputusan #17. Test ini
// menguji `spaFallback` langsung dengan publicDir KOSONG (mensimulasikan
// kondisi dev), bukan lewat `router.New`, supaya tidak butuh dependency
// modul lain untuk mem-build `Deps`.
func TestSpaFallback_EmptyPublicDir_NonGetStillJSON404(t *testing.T) {
	handler := spaFallback("", nil) // PUBLIC_DIR="" - kondisi dev sungguhan

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("POST / (publicDir kosong): expected 404, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("POST / (publicDir kosong): expected Content-Type application/json, got %q (body: %s)", ct, rec.Body.String())
	}
}

func TestSpaFallback_EmptyPublicDir_GetAlsoJSON404(t *testing.T) {
	handler := spaFallback("", nil)

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("GET / (publicDir kosong): expected 404, got %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("GET / (publicDir kosong): expected Content-Type application/json, got %q", ct)
	}
}

// Bug nyata di production (2026-09-02, ditemukan lewat laporan user "versi
// lama belum hilang di browser"): index.html/admin.html dikirim tanpa
// Cache-Control sama sekali, jadi browser boleh menyajikan snapshot lama
// tanpa pernah menghubungi server - padahal entry HTML ini mereferensikan
// nama bundle ber-hash yang berganti total tiap deploy (Dockerfile meng-copy
// ulang dist/, bukan incremental). Tanpa header ini, deploy baru tidak
// pernah terlihat tamu sampai mereka hard-refresh manual.
func TestSpaFallback_EntryHtml_TidakBolehDicacheTanpaRevalidasi(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), "<html>undangan</html>")
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")

	handler := spaFallback(dir, nil)

	for _, path := range []string{"/", "/admin", "/admin/guests"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		cc := rec.Header().Get("Cache-Control")
		if !strings.Contains(cc, "no-cache") {
			t.Errorf("GET %s: Cache-Control = %q, harus mengandung no-cache (entry HTML tidak boleh di-cache tanpa revalidasi)", path, cc)
		}
	}
}

func TestStatic_BundleViteHashed_Immutable(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), "<html>undangan</html>")
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")
	if err := os.MkdirAll(filepath.Join(dir, "assets"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	mustWriteFile(t, filepath.Join(dir, "assets", "index-abc123.js"), "console.log(1)")
	mustWriteFile(t, filepath.Join(dir, "assets", "index-abc123.css"), "body{}")

	handler := spaFallback(dir, nil)

	for _, path := range []string{"/assets/index-abc123.js", "/assets/index-abc123.css"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s: expected 200, got %d", path, rec.Code)
		}
		cc := rec.Header().Get("Cache-Control")
		if !strings.Contains(cc, "immutable") {
			t.Errorf("GET %s: Cache-Control = %q, harus mengandung immutable", path, cc)
		}
		if !strings.Contains(cc, "max-age=31536000") {
			t.Errorf("GET %s: Cache-Control = %q, harus mengandung max-age=31536000", path, cc)
		}
	}
}

func TestStatic_AsetTemplate_MaxAge30Hari_TanpaImmutable(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), "<html>undangan</html>")
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")
	if err := os.MkdirAll(filepath.Join(dir, "media", "template", "arsya"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	mustWriteFile(t, filepath.Join(dir, "media", "template", "arsya", "Orn-31.webp"), "fake-webp")
	if err := os.MkdirAll(filepath.Join(dir, "vendor", "aos", "dist"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	mustWriteFile(t, filepath.Join(dir, "vendor", "aos", "dist", "aos.js"), "fake-js")
	if err := os.MkdirAll(filepath.Join(dir, "assets", "css"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	mustWriteFile(t, filepath.Join(dir, "assets", "css", "00f3b7dc.css"), "body{}")

	handler := spaFallback(dir, nil)

	cases := []string{
		"/media/template/arsya/Orn-31.webp",
		"/vendor/aos/dist/aos.js",
		"/assets/css/00f3b7dc.css",
	}
	for _, path := range cases {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("GET %s: expected 200, got %d", path, rec.Code)
		}
		cc := rec.Header().Get("Cache-Control")
		if !strings.Contains(cc, "max-age=2592000") {
			t.Errorf("GET %s: Cache-Control = %q, harus mengandung max-age=2592000", path, cc)
		}
		if strings.Contains(cc, "immutable") {
			t.Errorf("GET %s: Cache-Control = %q, tidak boleh mengandung immutable", path, cc)
		}
	}
}

func TestRobotsTxt_BukanHTML(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), "<html>undangan</html>")
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")
	mustWriteFile(t, filepath.Join(dir, "robots.txt"), "User-agent: *\nAllow: /\n")

	handler := spaFallback(dir, nil)
	req := httptest.NewRequest(http.MethodGet, "/robots.txt", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GET /robots.txt: expected 200, got %d", rec.Code)
	}
	ct := rec.Header().Get("Content-Type")
	if strings.Contains(ct, "text/html") {
		t.Errorf("GET /robots.txt: Content-Type = %q, tidak boleh text/html", ct)
	}
	if strings.HasPrefix(strings.TrimSpace(rec.Body.String()), "<!doctype") {
		t.Errorf("GET /robots.txt body diawali <!doctype, seharusnya robots.txt asli")
	}
}

func TestEntryHTML_TetapNoCache(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), "<html>undangan</html>")
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")

	handler := spaFallback(dir, nil)

	for _, path := range []string{"/", "/admin"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		cc := rec.Header().Get("Cache-Control")
		if !strings.Contains(cc, "no-cache") {
			t.Errorf("GET %s: Cache-Control = %q, harus mengandung no-cache", path, cc)
		}
		if !strings.Contains(cc, "must-revalidate") {
			t.Errorf("GET %s: Cache-Control = %q, harus mengandung must-revalidate", path, cc)
		}
	}
}

func mustWriteFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("mkdir %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}

// --- injeksi meta Open Graph (docs/plan/og-share-image-dinamis/PLAN.md T7) ---

// stubShareInfoProvider memenuhi contentContracts.InvitationInfoProvider tanpa
// DB. GetQRInfo tidak dipakai jalur spaFallback, jadi cukup dikembalikan
// kosong - yang diuji di sini hanya jalur GetShareInfo.
type stubShareInfoProvider struct {
	info contentContracts.ShareInfo
	err  error
}

func (s stubShareInfoProvider) GetQRInfo(context.Context) (contentContracts.QRInfo, error) {
	return contentContracts.QRInfo{}, nil
}

func (s stubShareInfoProvider) GetShareInfo(context.Context) (contentContracts.ShareInfo, error) {
	return s.info, s.err
}

const indexWithMarkers = `<html><head>
<!--OG_META_START-->
    <meta property="og:title" content="Undangan Pernikahan" />
    <meta property="og:image" content="https://elwedding.elcodelabs.com/media/template/arsya/frame-cover.png" />
<!--OG_META_END-->
</head><body>undangan</body></html>`

func TestSpaFallback_InjeksiOgMetaDariProvider(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), indexWithMarkers)
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")

	provider := stubShareInfoProvider{info: contentContracts.ShareInfo{
		BrideName:        "Ariana",
		GroomName:        "Adrian",
		WeddingDateLabel: "Sabtu, 1 Januari 2027",
		ShareImageUrl:    "/uploads/images/share.jpg",
		CoverImageUrl:    "/uploads/images/cover.jpg",
	}}

	handler := spaFallback(dir, provider)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Host = "elwedding.elcodelabs.com"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau 200", rec.Code)
	}
	body := rec.Body.String()

	// og:image WAJIB absolut dan berskema https (D5) - crawler WhatsApp
	// tidak menyelesaikan path relatif.
	if !strings.Contains(body, `content="https://elwedding.elcodelabs.com/uploads/images/share.jpg"`) {
		t.Errorf("og:image hasil pilihan tidak tersuntik\n%s", body)
	}
	// K2: judul memakai nama pasangan, bukan string generik statis.
	if !strings.Contains(body, "Adrian &amp; Ariana") {
		t.Errorf("og:title nama pasangan tidak tersuntik\n%s", body)
	}
	if strings.Contains(body, "frame-cover.png") {
		t.Error("nilai statis frame-cover.png masih tersaji, seharusnya tertimpa")
	}
	// Isi halaman di luar marker tidak boleh ikut termakan.
	if !strings.Contains(body, "<body>undangan</body>") {
		t.Error("badan HTML rusak setelah injeksi")
	}
	if ct := rec.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/html") {
		t.Errorf("Content-Type = %q, mau text/html", ct)
	}
	// Header entry HTML yang sudah ada WAJIB tetap berlaku di jalur injeksi.
	if cc := rec.Header().Get("Cache-Control"); !strings.Contains(cc, "no-cache") {
		t.Errorf("Cache-Control = %q, harus tetap no-cache", cc)
	}
	// Validator berbasis mtime berkas TIDAK boleh dipasang - isinya kini
	// bergantung DB, bukan berkas, jadi ETag/Last-Modified akan menyajikan
	// preview basi setelah admin mengganti gambar.
	if v := rec.Header().Get("Last-Modified"); v != "" {
		t.Errorf("Last-Modified = %q, harus kosong pada HTML hasil injeksi", v)
	}
	if v := rec.Header().Get("ETag"); v != "" {
		t.Errorf("ETag = %q, harus kosong pada HTML hasil injeksi", v)
	}
}

// Jalur gagal: DB mati -> HTML statis disajikan apa adanya, BUKAN 500.
// Halaman undangan tidak boleh mati hanya karena preview tidak bisa
// dipersonalisasi.
func TestSpaFallback_ProviderErrorSajikanHtmlStatis(t *testing.T) {
	dir := t.TempDir()
	mustWriteFile(t, filepath.Join(dir, "index.html"), indexWithMarkers)
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")

	handler := spaFallback(dir, stubShareInfoProvider{err: errors.New("db mati")})
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Host = "elwedding.elcodelabs.com"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau 200 (statis), bukan error", rec.Code)
	}
	if rec.Body.String() != indexWithMarkers {
		t.Errorf("body harus identik dengan berkas statis, dapat:\n%s", rec.Body.String())
	}
}

// admin.html TIDAK PERNAH di-inject, walaupun provider tersedia - dasbor tidak
// pernah dibagikan sebagai link preview.
func TestSpaFallback_AdminHtmlTidakPernahDiinject(t *testing.T) {
	dir := t.TempDir()
	adminHTML := "<html><head>" + `<!--OG_META_START--><!--OG_META_END-->` + "</head>admin</html>"
	mustWriteFile(t, filepath.Join(dir, "index.html"), indexWithMarkers)
	mustWriteFile(t, filepath.Join(dir, "admin.html"), adminHTML)

	provider := stubShareInfoProvider{info: contentContracts.ShareInfo{
		BrideName: "Ariana", GroomName: "Adrian", ShareImageUrl: "/uploads/images/share.jpg",
	}}
	handler := spaFallback(dir, provider)
	req := httptest.NewRequest(http.MethodGet, "/admin/guests", nil)
	req.Host = "elwedding.elcodelabs.com"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Body.String() != adminHTML {
		t.Errorf("admin.html ikut di-inject:\n%s", rec.Body.String())
	}
}

// index.html TANPA marker -> disajikan apa adanya. Ini yang melindungi build
// lama / berkas pihak ketiga dari HTML yang rusak setengah jalan.
func TestSpaFallback_TanpaMarkerSajikanStatis(t *testing.T) {
	dir := t.TempDir()
	plain := "<html><head><meta property=\"og:title\" content=\"statis\" /></head></html>"
	mustWriteFile(t, filepath.Join(dir, "index.html"), plain)
	mustWriteFile(t, filepath.Join(dir, "admin.html"), "<html>admin</html>")

	provider := stubShareInfoProvider{info: contentContracts.ShareInfo{
		BrideName: "Ariana", GroomName: "Adrian", ShareImageUrl: "/uploads/images/share.jpg",
	}}
	handler := spaFallback(dir, provider)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Host = "elwedding.elcodelabs.com"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Body.String() != plain {
		t.Errorf("HTML tanpa marker harus utuh, dapat:\n%s", rec.Body.String())
	}
}
