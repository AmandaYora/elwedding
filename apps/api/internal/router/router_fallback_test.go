package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
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

	handler := spaFallback(dir)

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

	handler := spaFallback(dir)
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

	handler := spaFallback(dir)
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
	handler := spaFallback("") // PUBLIC_DIR="" - kondisi dev sungguhan

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
	handler := spaFallback("")

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

	handler := spaFallback(dir)

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

func mustWriteFile(t *testing.T, path, content string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("write %s: %v", path, err)
	}
}
