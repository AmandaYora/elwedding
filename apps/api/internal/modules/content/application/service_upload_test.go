package application

import (
	"context"
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
