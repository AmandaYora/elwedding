package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"
)

var allowedUploadExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
	".mp3": true, ".wav": true, ".ogg": true,
}

// categoryByExt & contentTypeByExt: 7 key PERSIS SAMA dengan allowedUploadExt
// (docs/plan/content-uploads-object-storage/PLAN.md keputusan §3#3/§3#5).
// contentTypeByExt ditulis eksplisit (bukan mime.TypeByExtension bawaan Go)
// karena image Alpine produksi tidak menjamin /etc/mime.types terpasang
// untuk tipe audio - bergantung pada mime database sistem bisa diam-diam
// salah/kosong khusus di container, meski benar di mesin dev.
var categoryByExt = map[string]string{
	".jpg": "images", ".jpeg": "images", ".png": "images", ".webp": "images", ".gif": "images",
	".mp3": "audio", ".wav": "audio", ".ogg": "audio",
}

var contentTypeByExt = map[string]string{
	".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
	".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
}

var ErrUnsupportedFileType = errors.New("unsupported file type")

// buildKey membangun key S3 dengan prefix nama aplikasi (bucket dipakai
// bersama aplikasi lain - PLAN.md keputusan §1/§3#3). Fungsi murni, sengaja
// dipisah dari SaveUpload supaya bisa dites tanpa storage sungguhan.
func buildKey(category, filename string) string {
	return fmt.Sprintf("elwedding/upload/%s/%s", category, filename)
}

// SaveUpload menyimpan file yang diunggah admin ke object storage S3
// (docs/plan/content-uploads-object-storage/PLAN.md - menggantikan disk
// lokal/UploadsDir), dan mengembalikan URL publiknya (disajikan lewat route
// dinamis /uploads/{category}/{filename} di router - lihat router.go).
func (s *Service) SaveUpload(ctx context.Context, originalFilename string, r io.Reader) (string, error) {
	ext := strings.ToLower(filepath.Ext(originalFilename))
	if !allowedUploadExt[ext] {
		return "", ErrUnsupportedFileType
	}

	data, err := io.ReadAll(r)
	if err != nil {
		return "", err
	}

	randBytes := make([]byte, 8)
	if _, err := rand.Read(randBytes); err != nil {
		return "", err
	}
	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixNano(), hex.EncodeToString(randBytes), ext)
	category := categoryByExt[ext]
	key := buildKey(category, filename)

	if _, err := s.storage.Save(ctx, key, data, contentTypeByExt[ext]); err != nil {
		return "", err
	}

	return "/uploads/" + category + "/" + filename, nil
}
