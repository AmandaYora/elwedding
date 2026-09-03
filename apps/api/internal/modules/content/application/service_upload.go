package application

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
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

// maxImageDecodedSize: batas ukuran BYTE HASIL DECODE base64 (bukan panjang
// string base64) untuk endpoint /admin/uploads/base64 - docs/plan/
// admin-content-upload-base64/PLAN.md keputusan K4.
const maxImageDecodedSize = 5 << 20 // 5 MB

var (
	ErrImageTooLarge       = errors.New("image exceeds maximum decoded size")
	ErrInvalidBase64       = errors.New("invalid base64 payload")
	ErrContentTypeMismatch = errors.New("decoded bytes do not match file extension")
)

// isImageExt: dasar filter "images only" endpoint base64 - audio (musik latar)
// tetap lewat multipart SaveUpload apa adanya (PLAN.md keputusan K2).
func isImageExt(ext string) bool {
	return categoryByExt[ext] == "images"
}

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

// SaveImageBase64 menerima image sebagai base64 lewat POST /api/v1/admin/
// uploads/base64 (PLAN.md keputusan K1: transport saja, tetap disimpan ke S3
// lewat SaveUpload yang sama dengan jalur multipart). Seluruh validasi
// (§3.1 langkah 2-6 PLAN.md) selesai SEBELUM s.storage tersentuh - lihat
// TestSaveImageBase64_* di service_upload_test.go yang membuktikan ini
// dengan storage nil.
func (s *Service) SaveImageBase64(ctx context.Context, filename, payload string) (string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	if !isImageExt(ext) {
		return "", ErrUnsupportedFileType
	}

	// Prefix data URI (data:<mime>;base64,...) dibuang bila ada - FE boleh
	// mengirim salah satu bentuk.
	b64 := payload
	if idx := strings.Index(b64, ","); idx != -1 && strings.HasPrefix(b64, "data:") {
		b64 = b64[idx+1:]
	}

	decoded, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return "", ErrInvalidBase64
	}
	if len(decoded) == 0 {
		// Payload kosong (atau hanya prefix data URI) lolos DecodeString tanpa
		// error tapi HARUS ditolak di sini - kalau tidak, langkah sniff MIME di
		// bawah menghasilkan pesan menyesatkan "MIME tidak cocok" untuk kasus
		// yang sebenarnya adalah "tidak ada data".
		return "", ErrInvalidBase64
	}

	if len(decoded) > maxImageDecodedSize {
		return "", ErrImageTooLarge
	}

	detected := http.DetectContentType(decoded)
	if detected != contentTypeByExt[ext] {
		return "", ErrContentTypeMismatch
	}

	return s.SaveUpload(ctx, filename, bytes.NewReader(decoded))
}
