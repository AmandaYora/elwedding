package authmw

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"undangan-digital/internal/shared/jwtutil"
)

const testSecret = "test-secret"

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("lolos"))
	})
}

func doRequest(t *testing.T, mw func(http.Handler) http.Handler, authHeader string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/admin/guests", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	rec := httptest.NewRecorder()
	mw(okHandler()).ServeHTTP(rec, req)
	return rec
}

func bearerFor(t *testing.T, role string) string {
	t.Helper()
	token, err := jwtutil.Generate(testSecret, time.Hour, 1, "someone", role)
	if err != nil {
		t.Fatalf("gagal menerbitkan token: %v", err)
	}
	return "Bearer " + token
}

// docs/plan/scan-checkin-gate/PLAN.md T11: RequireFullAdmin adalah penegakan
// akses yang SEBENARNYA - penyaringan menu di frontend murni kosmetik. Tes
// ini yang membuktikannya, bukan tampilan.

func TestRequireFullAdmin_PeranScannerDitolak403(t *testing.T) {
	rec := doRequest(t, RequireFullAdmin(testSecret), bearerFor(t, RoleScanner))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, mau %d", rec.Code, http.StatusForbidden)
	}
}

func TestRequireFullAdmin_PeranAdminDiteruskan(t *testing.T) {
	rec := doRequest(t, RequireFullAdmin(testSecret), bearerFor(t, "admin"))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau %d", rec.Code, http.StatusOK)
	}
}

// Mengunci D8: token LAMA yang tersimpan di localStorage admin tidak punya
// klaim `role`. Kalau peran kosong dianggap petugas, admin yang sedang login
// langsung kehilangan seluruh menu tanpa sebab yang terlihat.
func TestRequireFullAdmin_PeranKosongDiperlakukanAdminPenuh(t *testing.T) {
	rec := doRequest(t, RequireFullAdmin(testSecret), bearerFor(t, ""))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau %d (peran kosong = admin penuh, D8)", rec.Code, http.StatusOK)
	}
}

func TestRequireFullAdmin_TanpaTokenTetap401(t *testing.T) {
	rec := doRequest(t, RequireFullAdmin(testSecret), "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, mau %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestRequireFullAdmin_TokenTidakSah401(t *testing.T) {
	rec := doRequest(t, RequireFullAdmin(testSecret), "Bearer bukan-jwt")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, mau %d", rec.Code, http.StatusUnauthorized)
	}
}

// RequireAdmin sendiri TIDAK diubah (D7): petugas tetap lolos di sana -
// itulah yang membuat route /admin/checkin/* bisa dibuka akun petugas.
func TestRequireAdmin_PeranScannerTetapLolos(t *testing.T) {
	rec := doRequest(t, RequireAdmin(testSecret), bearerFor(t, RoleScanner))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, mau %d", rec.Code, http.StatusOK)
	}
}
