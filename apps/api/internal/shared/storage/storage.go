// Package storage membungkus object storage S3-compatible (IDCloudHost -
// lihat docs/plan/content-uploads-object-storage/PLAN.md). Pemanggil cukup
// bicara dalam key & byte, tidak perlu tahu ini disokong S3.
package storage

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// ErrNotFound dikembalikan Open kalau objeknya tidak ada. Pemanggil memetakan
// ini ke 404 TANPA perlu tahu ini S3 (paket ini satu-satunya yang boleh tahu).
var ErrNotFound = errors.New("object not found")

type Client struct {
	client *minio.Client
	bucket string
}

type Config struct {
	Endpoint  string
	Bucket    string
	AccessKey string
	SecretKey string
	UseSSL    bool
}

func New(cfg Config) (*Client, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""),
		Secure: cfg.UseSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("create s3 client: %w", err)
	}
	return &Client{client: client, bucket: cfg.Bucket}, nil
}

// Save mengunggah data ke key, mengembalikan key yang sama saat sukses.
func (c *Client) Save(ctx context.Context, key string, data []byte, contentType string) (string, error) {
	_, err := c.client.PutObject(ctx, c.bucket, key, bytes.NewReader(data), int64(len(data)),
		minio.PutObjectOptions{ContentType: contentType},
	)
	if err != nil {
		return "", fmt.Errorf("upload object %q: %w", key, err)
	}
	return key, nil
}

// Open men-stream objek balik. Dikembalikan sebagai io.ReadSeekCloser (BUKAN
// io.ReadCloser) supaya pemanggil bisa memakai http.ServeContent, yang
// memberi dukungan HTTP Range/206 Partial Content secara otomatis - PENTING
// untuk musik latar yang diputar lewat elemen <audio> native (lihat
// PLAN.md §2/§3#8). *minio.Object sudah mengimplementasikan io.Seeker
// secara native, jadi ini tidak menambah biaya apa pun.
func (c *Client) Open(ctx context.Context, key string) (io.ReadSeekCloser, error) {
	obj, err := c.client.GetObject(ctx, c.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("open object %q: %w", key, err)
	}

	// GetObject minio-go bersifat LAZY: request jaringan baru terjadi saat
	// Read/Seek/Stat pertama, jadi objek yang tidak ada TIDAK ketahuan di
	// baris atas (err == nil). Kalau dibiarkan, error-nya baru meledak di
	// dalam http.ServeContent dan keluar sebagai 500 "seeker can't seek",
	// bukan 404 - terbukti lewat internal/router/uploads_test.go
	// (TestUploads_ObjekTidakAda_404JSON).
	// Materialisasikan di sini dengan Seek yang MEMANG dibutuhkan
	// http.ServeContent untuk menentukan ukuran, jadi tidak ada round-trip
	// tambahan; hasilnya di-cache objek minio dan dipakai ulang oleh
	// ServeContent.
	if _, err := obj.Seek(0, io.SeekEnd); err != nil {
		_ = obj.Close()
		if isNotFound(err) {
			return nil, fmt.Errorf("open object %q: %w", key, ErrNotFound)
		}
		return nil, fmt.Errorf("open object %q: %w", key, err)
	}
	if _, err := obj.Seek(0, io.SeekStart); err != nil {
		_ = obj.Close()
		return nil, fmt.Errorf("rewind object %q: %w", key, err)
	}
	return obj, nil
}

func isNotFound(err error) bool {
	var resp minio.ErrorResponse
	if errors.As(err, &resp) {
		return resp.Code == minio.NoSuchKey || resp.StatusCode == http.StatusNotFound
	}
	return false
}
