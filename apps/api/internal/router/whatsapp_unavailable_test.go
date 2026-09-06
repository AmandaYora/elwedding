package router

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"undangan-digital/internal/shared/jwtutil"
)

// main.go SENGAJA melanjutkan boot ketika whatsapp.New gagal (WA_STORE_DIR
// tidak bisa ditulis, SQLite sesinya rusak) supaya RSVP tetap berjalan tanpa
// kirim QR otomatis - lihat komentarnya di cmd/server/main.go. Yang tersisa
// saat itu adalah WhatsAppHandler NIL, dan router TETAP mendaftarkan seluruh
// route /api/v1/admin/whatsapp/* dari nilai nil tersebut.
//
// Yang dikunci di sini bukan "balas 503", melainkan bahwa jalur itu masih
// MEMBALAS SAMA SEKALI: sebelum penjaga Handler.unavailable ada, setiap
// permintaan ke menu WhatsApp panic karena nil pointer dereference, sehingga
// degradasi yang dirancang main.go berubah jadi crash per request.
func TestWhatsApp_ModulMati_BalasJSONBukanPanic(t *testing.T) {
	mux := New(Deps{JWTSecret: "x"}) // WhatsAppHandler nil, persis kondisi boot gagal
	token, err := jwtutil.Generate("x", time.Hour, 1, "admin", "admin")
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/admin/whatsapp/status"},
		{http.MethodPost, "/api/v1/admin/whatsapp/pair/start"},
		{http.MethodPost, "/api/v1/admin/whatsapp/logout"},
		{http.MethodGet, "/api/v1/admin/whatsapp/config"},
		{http.MethodPut, "/api/v1/admin/whatsapp/config"},
		{http.MethodGet, "/api/v1/admin/whatsapp/logs"},
		{http.MethodPost, "/api/v1/admin/whatsapp/logs/1/resend"},
	}

	for _, c := range cases {
		req := httptest.NewRequest(c.method, c.path, strings.NewReader("{}"))
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req) // panic di sini = regresi

		if rec.Code != http.StatusServiceUnavailable {
			t.Errorf("%s %s: status = %d, mau %d", c.method, c.path, rec.Code, http.StatusServiceUnavailable)
		}
		if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
			t.Errorf("%s %s: Content-Type = %q, mau JSON", c.method, c.path, ct)
		}
	}
}
