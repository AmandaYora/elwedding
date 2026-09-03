package presentation

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"undangan-ariana-adrian/internal/modules/content/application"
)

// newTestHandler: service tanpa repo/storage sungguhan - kedua test di sini
// gagal di decodeJSONLimited SEBELUM Service.SaveImageBase64 pernah dipanggil,
// jadi repo/storage nil aman (docs/plan/admin-content-upload-base64/PLAN.md §6.1).
func newTestHandler() *Handler {
	return NewHandler(application.NewService(nil, nil))
}

func TestUploadImageBase64_BodyLebihDariLimit_413(t *testing.T) {
	h := newTestHandler()

	oversized := bytes.Repeat([]byte("a"), 9<<20) // 9 MB > maxBase64BodySize (8 MB)
	body := `{"filename":"foto.png","data":"` + string(oversized) + `"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/uploads/base64", strings.NewReader(body))
	w := httptest.NewRecorder()

	h.UploadImageBase64(w, req)

	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, ekspektasi 413", w.Code)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("Content-Type = %q, ekspektasi application/json", ct)
	}
}

func TestUploadImageBase64_JsonRusak_400(t *testing.T) {
	h := newTestHandler()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/admin/uploads/base64", strings.NewReader("{"))
	w := httptest.NewRecorder()

	h.UploadImageBase64(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, ekspektasi 400", w.Code)
	}
}
