package application

import (
	"bytes"
	"context"
	"encoding/base64"
	"strings"
	"testing"
)

func TestCategoryAndContentTypeByExt_CoversAllAllowedExtensions(t *testing.T) {
	for ext := range allowedUploadExt {
		if _, ok := categoryByExt[ext]; !ok {
			t.Errorf("categoryByExt tidak punya entri untuk %q", ext)
		}
		if _, ok := contentTypeByExt[ext]; !ok {
			t.Errorf("contentTypeByExt tidak punya entri untuk %q", ext)
		}
	}
	for ext, category := range categoryByExt {
		if category != "images" && category != "audio" {
			t.Errorf("categoryByExt[%q] = %q, ekspektasi images atau audio", ext, category)
		}
	}
}

func TestSaveUpload_UnsupportedExtension_RejectedBeforeTouchingStorage(t *testing.T) {
	svc := &Service{storage: nil} // storage nil sengaja - kalau kode sampai memanggilnya, test panic (bukti regresi urutan validasi)

	_, err := svc.SaveUpload(context.Background(), "malware.exe", strings.NewReader("data"))
	if err != ErrUnsupportedFileType {
		t.Fatalf("error = %v, ekspektasi ErrUnsupportedFileType", err)
	}
}

// Header magic bytes minimal yang dikenali http.DetectContentType - dibuktikan
// dengan menjalankan DetectContentType atas byte ini pada toolchain Go proyek
// (docs/plan/admin-content-upload-base64/PLAN.md §3.1 langkah 5).
func pngBytes() []byte {
	return append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 32)...)
}

func jpegBytes() []byte {
	return append([]byte{0xFF, 0xD8, 0xFF}, make([]byte, 32)...)
}

func TestSaveImageBase64_EkstensiAudioDitolak(t *testing.T) {
	svc := &Service{storage: nil} // storage nil - kalau tersentuh, test panic

	_, err := svc.SaveImageBase64(context.Background(), "musik.mp3", base64.StdEncoding.EncodeToString(pngBytes()))
	if err != ErrUnsupportedFileType {
		t.Fatalf("error = %v, ekspektasi ErrUnsupportedFileType", err)
	}
}

func TestSaveImageBase64_EkstensiTidakDikenalDitolak(t *testing.T) {
	svc := &Service{storage: nil}

	_, err := svc.SaveImageBase64(context.Background(), "malware.exe", base64.StdEncoding.EncodeToString(pngBytes()))
	if err != ErrUnsupportedFileType {
		t.Fatalf("error = %v, ekspektasi ErrUnsupportedFileType", err)
	}
}

func TestSaveImageBase64_Base64RusakDitolak(t *testing.T) {
	svc := &Service{storage: nil}

	_, err := svc.SaveImageBase64(context.Background(), "foto.png", "!!! bukan base64 !!!")
	if err != ErrInvalidBase64 {
		t.Fatalf("error = %v, ekspektasi ErrInvalidBase64", err)
	}
}

func TestSaveImageBase64_PayloadKosongDitolak(t *testing.T) {
	svc := &Service{storage: nil}

	cases := []string{"", "data:image/png;base64,"}
	for _, payload := range cases {
		_, err := svc.SaveImageBase64(context.Background(), "foto.png", payload)
		if err != ErrInvalidBase64 {
			t.Errorf("payload %q: error = %v, ekspektasi ErrInvalidBase64", payload, err)
		}
	}
}

// TestSaveImageBase64_PrefixDataUriDibuang membuktikan prefix data URI benar-
// benar dibuang sebelum decode: filename .png dikirim dengan payload berisi
// byte JPEG (bukan PNG). Kalau prefix TIDAK dibuang, base64.DecodeString akan
// gagal lebih dulu pada karakter "data:image/png;base64," dan menghasilkan
// ErrInvalidBase64 - bukan ErrContentTypeMismatch seperti yang diharapkan di
// sini. Sengaja dipilih payload yang berhenti di langkah sniff (bukan PNG
// valid) supaya storage yang nil tidak pernah tersentuh.
func TestSaveImageBase64_PrefixDataUriDibuang(t *testing.T) {
	svc := &Service{storage: nil}

	payload := "data:image/png;base64," + base64.StdEncoding.EncodeToString(jpegBytes())
	_, err := svc.SaveImageBase64(context.Background(), "foto.png", payload)
	if err != ErrContentTypeMismatch {
		t.Fatalf("error = %v, ekspektasi ErrContentTypeMismatch (bukan ErrInvalidBase64 - itu berarti prefix tidak dibuang)", err)
	}
}

func TestSaveImageBase64_LebihDari5MBDitolak(t *testing.T) {
	svc := &Service{storage: nil}

	oversized := bytes.Repeat([]byte{0x00}, maxImageDecodedSize+1)
	_, err := svc.SaveImageBase64(context.Background(), "foto.png", base64.StdEncoding.EncodeToString(oversized))
	if err != ErrImageTooLarge {
		t.Fatalf("error = %v, ekspektasi ErrImageTooLarge", err)
	}
}

func TestSaveImageBase64_MimeTidakCocokEkstensiDitolak(t *testing.T) {
	svc := &Service{storage: nil}

	_, err := svc.SaveImageBase64(context.Background(), "foto.jpg", base64.StdEncoding.EncodeToString(pngBytes()))
	if err != ErrContentTypeMismatch {
		t.Fatalf("error = %v, ekspektasi ErrContentTypeMismatch", err)
	}
}

func TestIsImageExt_HanyaKategoriImages(t *testing.T) {
	for ext, category := range categoryByExt {
		want := category == "images"
		if got := isImageExt(ext); got != want {
			t.Errorf("isImageExt(%q) = %v, want %v", ext, got, want)
		}
	}
}

func TestBuildKey_PrefixDanKategoriBenar(t *testing.T) {
	cases := []struct {
		category, filename, want string
	}{
		{"images", "123-abc.jpg", "elwedding/upload/images/123-abc.jpg"},
		{"audio", "456-def.mp3", "elwedding/upload/audio/456-def.mp3"},
	}
	for _, c := range cases {
		got := buildKey(c.category, c.filename)
		if got != c.want {
			t.Errorf("buildKey(%q, %q) = %q, want %q", c.category, c.filename, got, c.want)
		}
	}
}
