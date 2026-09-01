// Package infrastructure - waclient.go adalah SATU-SATUNYA file yang boleh
// mengimpor go.mau.fi/whatsmeow secara langsung (PLAN.md dashboard-wa-rsvp
// §6.4/A8). Sisi application hanya bergantung pada method di WAClient ini,
// tidak pernah pada tipe whatsmeow secara langsung.
package infrastructure

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	// Driver Go murni tanpa CGO - whatsmeow TIDAK mendukung MySQL (terverifikasi
	// PLAN.md §2: "Only SQLite and Postgres are currently fully supported").
	_ "modernc.org/sqlite"
)

// QRChannelItem diteruskan apa adanya dari whatsmeow supaya application tidak
// perlu mengimpor package whatsmeow untuk membaca Event/Code/Error. Nilai
// Event yang mungkin (didokumentasikan qrchan.go): "code", "success",
// "timeout", "error", dan varian err-* lain - application membandingkan
// string-nya langsung, bukan lewat re-export nilai QRChannelSuccess/Timeout
// (keduanya struct QRChannelItem, bukan konstanta).
type QRChannelItem = whatsmeow.QRChannelItem

type WAClient struct {
	client *whatsmeow.Client
}

// NewWAClient membuka store sesi WhatsApp di file SQLite terpisah
// (WA_STORE_DIR, keputusan #5) - MySQL project TIDAK disentuh sama sekali.
// dialect "sqlite" dipakai untuk sql.Open DAN dbutil.ParseDialect sekaligus
// (lihat sqlstore.New) - dibuktikan cocok dengan driver modernc.org/sqlite
// (yang mendaftar sebagai "sqlite") lewat program gate PLAN.md task A5.
func NewWAClient(ctx context.Context, storeDBPath string) (*WAClient, error) {
	if err := os.MkdirAll(filepath.Dir(storeDBPath), 0o755); err != nil {
		return nil, fmt.Errorf("gagal membuat folder store WhatsApp: %w", err)
	}
	log := waLog.Stdout("WhatsApp", "INFO", true)
	container, err := sqlstore.New(ctx, "sqlite", "file:"+storeDBPath+"?_pragma=foreign_keys(1)", log)
	if err != nil {
		return nil, fmt.Errorf("gagal membuka store WhatsApp: %w", err)
	}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		return nil, fmt.Errorf("gagal memuat device WhatsApp: %w", err)
	}
	client := whatsmeow.NewClient(device, log)
	return &WAClient{client: client}, nil
}

// HasStoredSession true bila device ini pernah berhasil pairing sebelumnya.
// Dipakai service untuk memutuskan reconnect otomatis saat boot vs menunggu
// admin memulai pairing baru.
func (w *WAClient) HasStoredSession() bool {
	return w.client.Store.ID != nil
}

func (w *WAClient) IsLoggedIn() bool {
	return w.client.IsLoggedIn()
}

// GetQRChannel WAJIB dipanggil sebelum Connect() (batasan whatsmeow,
// diverifikasi qrchan.go: memanggil setelah punya session tersimpan
// mengembalikan ErrQRStoreContainsID, dipanggil setelah connect
// mengembalikan ErrQRAlreadyConnected).
func (w *WAClient) GetQRChannel(ctx context.Context) (<-chan QRChannelItem, error) {
	return w.client.GetQRChannel(ctx)
}

func (w *WAClient) Connect() error {
	return w.client.Connect()
}

func (w *WAClient) Logout(ctx context.Context) error {
	return w.client.Logout(ctx)
}

func (w *WAClient) Disconnect() {
	w.client.Disconnect()
}

// UploadImage mengunggah PNG ke server WhatsApp, langkah wajib sebelum
// SendImageMessage (signature diverifikasi upload.go).
func (w *WAClient) UploadImage(ctx context.Context, png []byte) (whatsmeow.UploadResponse, error) {
	return w.client.Upload(ctx, png, whatsmeow.MediaImage)
}

// SendImageMessage mengirim gambar hasil UploadImage sebagai pesan ke nomor
// (already-normalized, format 628xxxxxxxxxx) dengan caption dari template
// ter-substitusi.
func (w *WAClient) SendImageMessage(ctx context.Context, normalizedPhone, caption string, upload whatsmeow.UploadResponse) error {
	jid := types.NewJID(normalizedPhone, types.DefaultUserServer)
	msg := &waE2E.Message{
		ImageMessage: &waE2E.ImageMessage{
			URL:           proto.String(upload.URL),
			DirectPath:    proto.String(upload.DirectPath),
			MediaKey:      upload.MediaKey,
			Mimetype:      proto.String("image/png"),
			FileEncSHA256: upload.FileEncSHA256,
			FileSHA256:    upload.FileSHA256,
			FileLength:    proto.Uint64(upload.FileLength),
			Caption:       proto.String(caption),
		},
	}
	_, err := w.client.SendMessage(ctx, jid, msg)
	return err
}
