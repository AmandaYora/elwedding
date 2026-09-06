package router

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"undangan-digital/internal/shared/storage"
)

// fakeS3 meniru endpoint S3: melayani GetBucketLocation, lalu GET/HEAD objek
// lewat http.ServeContent (otomatis benar untuk Range & Content-Length).
// present=nil berarti objek tidak ada -> balas 404 NoSuchKey ala S3.
func fakeS3(t *testing.T, present []byte) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.URL.Query()["location"]; ok {
			w.Header().Set("Content-Type", "application/xml")
			_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/">us-east-1</LocationConstraint>`))
			return
		}
		if present == nil {
			w.Header().Set("Content-Type", "application/xml")
			w.WriteHeader(http.StatusNotFound)
			_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>`))
			return
		}
		// modtime WAJIB nyata: minio-go menolak respons tanpa Last-Modified
		// yang bisa di-parse (S3 asli selalu mengirimnya).
		http.ServeContent(w, r, "obj.bin", time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC), bytes.NewReader(present))
	}))
}

func newTestMux(t *testing.T, srv *httptest.Server, publicDir string) http.Handler {
	t.Helper()
	u, err := url.Parse(srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	client, err := storage.New(storage.Config{
		Endpoint: u.Host, Bucket: "elcodelabs",
		AccessKey: "k", SecretKey: "s", UseSSL: false,
	})
	if err != nil {
		t.Fatal(err)
	}
	return New(Deps{JWTSecret: "x", PublicDir: publicDir, Storage: client})
}

func TestUploads_ObjectAda_200DenganContentType(t *testing.T) {
	srv := fakeS3(t, []byte("HALO-DUNIA"))
	defer srv.Close()
	mux := newTestMux(t, srv, "")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/uploads/images/123-abc.jpg", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200 (body: %s)", rec.Code, rec.Body.String())
	}
	if ct := rec.Header().Get("Content-Type"); ct != "image/jpeg" {
		t.Errorf("Content-Type = %q, want image/jpeg", ct)
	}
	if rec.Body.String() != "HALO-DUNIA" {
		t.Errorf("body = %q", rec.Body.String())
	}
}

// Inti klaim §3#8 PLAN.md: musik butuh Range. Ini membuktikannya empiris.
func TestUploads_RangeRequest_206(t *testing.T) {
	srv := fakeS3(t, []byte("HALO-DUNIA"))
	defer srv.Close()
	mux := newTestMux(t, srv, "")

	req := httptest.NewRequest("GET", "/uploads/audio/123-abc.mp3", nil)
	req.Header.Set("Range", "bytes=0-3")
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusPartialContent {
		t.Fatalf("status = %d, want 206 (body: %s)", rec.Code, rec.Body.String())
	}
	if got := rec.Body.String(); got != "HALO" {
		t.Errorf("body = %q, want HALO", got)
	}
	if cr := rec.Header().Get("Content-Range"); cr == "" {
		t.Error("Content-Range kosong")
	}
}

func TestUploads_ObjekTidakAda_404JSON(t *testing.T) {
	srv := fakeS3(t, nil) // NoSuchKey
	defer srv.Close()
	mux := newTestMux(t, srv, "")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/uploads/images/hilang.jpg", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404 (body: %q)", rec.Code, strings.TrimSpace(rec.Body.String()))
	}
}

// URL skema LAMA (1 segmen, tanpa kategori) - 3 file legacy di produksi
// bentuknya begini. Harus 404 JSON, BUKAN index.html 200.
func TestUploads_UrlLamaSatuSegmen_404BukanHTML(t *testing.T) {
	srv := fakeS3(t, []byte("x"))
	defer srv.Close()

	pub := t.TempDir()
	if err := os.WriteFile(filepath.Join(pub, "index.html"), []byte("<html>SPA</html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	mux := newTestMux(t, srv, pub)

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/uploads/1788289587481942658-7f0082ccbc413687.jpeg", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404; body = %q", rec.Code, strings.TrimSpace(rec.Body.String()))
	}
	if strings.Contains(rec.Body.String(), "<html>") {
		t.Errorf("balasan HTML untuk URL gambar: %q", rec.Body.String())
	}
}

func TestUploads_KategoriTidakValid_404(t *testing.T) {
	srv := fakeS3(t, []byte("x"))
	defer srv.Close()
	mux := newTestMux(t, srv, "")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/uploads/videos/x.mp4", nil))

	if rec.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", rec.Code)
	}
}

// Membuktikan klaim di komentar storage.Open & PLAN.md §3#8: Seek eager di
// Open TIDAK menambah round-trip, karena http.ServeContent memakai ulang info
// objek yang sudah di-cache minio-go.
func TestUploads_JumlahRoundTripKeS3(t *testing.T) {
	var mu sync.Mutex
	var reqs []string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.URL.Query()["location"]; ok {
			_, _ = w.Write([]byte(`<?xml version="1.0" encoding="UTF-8"?><LocationConstraint xmlns="http://s3.amazonaws.com/doc/2006-03-01/">us-east-1</LocationConstraint>`))
			return
		}
		mu.Lock()
		reqs = append(reqs, r.Method+" "+r.URL.Path)
		mu.Unlock()
		http.ServeContent(w, r, "obj.bin", time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC), bytes.NewReader([]byte("HALO-DUNIA")))
	}))
	defer srv.Close()

	mux := newTestMux(t, srv, "")

	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, httptest.NewRequest("GET", "/uploads/images/123-abc.jpg", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}

	mu.Lock()
	defer mu.Unlock()
	t.Logf("request ke S3 untuk 1 file: %v", reqs)
	if len(reqs) > 2 {
		t.Errorf("round-trip ke S3 = %d (%v), ekspektasi <= 2 (HEAD metadata + GET isi)", len(reqs), reqs)
	}
}
