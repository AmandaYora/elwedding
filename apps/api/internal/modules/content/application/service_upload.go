package application

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var allowedUploadExt = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".webp": true, ".gif": true,
	".mp3": true, ".wav": true, ".ogg": true,
}

var ErrUnsupportedFileType = errors.New("unsupported file type")

// SaveUpload menyimpan file yang diunggah admin ke UploadsDir (keputusan #12
// PLAN.md - dipisah dari PublicDir supaya tidak tertimpa build ulang SPA),
// dan mengembalikan URL publiknya (disajikan lewat static route /uploads/*
// di router - task #10 PLAN.md).
func (s *Service) SaveUpload(originalFilename string, r io.Reader) (string, error) {
	ext := strings.ToLower(filepath.Ext(originalFilename))
	if !allowedUploadExt[ext] {
		return "", ErrUnsupportedFileType
	}

	if err := os.MkdirAll(s.uploadsDir, 0o755); err != nil {
		return "", err
	}

	randBytes := make([]byte, 8)
	if _, err := rand.Read(randBytes); err != nil {
		return "", err
	}
	filename := fmt.Sprintf("%d-%s%s", time.Now().UnixNano(), hex.EncodeToString(randBytes), ext)
	fullPath := filepath.Join(s.uploadsDir, filename)

	out, err := os.Create(fullPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	if _, err := io.Copy(out, r); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}
