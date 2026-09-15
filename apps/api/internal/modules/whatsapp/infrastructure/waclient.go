// Package infrastructure - waclient.go adalah SATU-SATUNYA file yang boleh
// mengimpor go.mau.fi/whatsmeow secara langsung (PLAN.md dashboard-wa-rsvp
// §6.4/A8). Sisi application hanya bergantung pada method di WAClient ini,
// tidak pernah pada tipe whatsmeow secara langsung.
package infrastructure

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"

	// Driver Go murni tanpa CGO - whatsmeow TIDAK mendukung MySQL (terverifikasi
	// PLAN.md §2: "Only SQLite and Postgres are currently fully supported").
	// Import NAMED (bukan blank): IsDatabaseLockedError di bawah memeriksa
	// *sqlite.Error secara langsung.
	"modernc.org/sqlite"
)

// QRChannelItem diteruskan apa adanya dari whatsmeow supaya application tidak
// perlu mengimpor package whatsmeow untuk membaca Event/Code/Error. Nilai
// Event yang mungkin (didokumentasikan qrchan.go): "code", "success",
// "timeout", "error", dan varian err-* lain - application membandingkan
// string-nya langsung, bukan lewat re-export nilai QRChannelSuccess/Timeout
// (keduanya struct QRChannelItem, bukan konstanta).
type QRChannelItem = whatsmeow.QRChannelItem

// ConnEvent adalah terjemahan milik modul sendiri atas event koneksi whatsmeow
// (whatsapp-connection-resilience §3.2) - supaya aturan "hanya waclient.go
// yang impor whatsmeow" tetap utuh, application tidak pernah melihat tipe
// events.* secara langsung.
type ConnEvent int

const (
	ConnConnected ConnEvent = iota + 1
	ConnDisconnected
	ConnLoggedOut
	ConnStreamReplaced
	ConnKeepAliveTimeout
	ConnKeepAliveRestored
	ConnFailure
)

func (e ConnEvent) String() string {
	switch e {
	case ConnConnected:
		return "connected"
	case ConnDisconnected:
		return "disconnected"
	case ConnLoggedOut:
		return "logged_out"
	case ConnStreamReplaced:
		return "stream_replaced"
	case ConnKeepAliveTimeout:
		return "keepalive_timeout"
	case ConnKeepAliveRestored:
		return "keepalive_restored"
	case ConnFailure:
		return "failure"
	default:
		return "unknown"
	}
}

// ConnNotice adalah satu kejadian koneksi yang diteruskan ke application.
type ConnNotice struct {
	Event  ConnEvent
	Reason string
}

// resetSessionTimeout batas kerja ResetSession sesudah pembatalan pemanggil
// dilepas - lihat ResetSession.
const resetSessionTimeout = 10 * time.Second

// storeBusyTimeoutMS berapa lama satu operasi SQLite menunggu lock yang
// dipegang koneksi lain sebelum menyerah dengan SQLITE_BUSY. Default driver
// adalah 0 (gagal seketika) - di satu proses dengan pool koneksi tak terbatas
// (sqlstore tidak menyetel MaxOpenConns) dan mode rollback-journal, tumpang
// tindih tulis latar whatsmeow vs baca jalur kirim sudah cukup untuk
// menggagalkan kiriman yang sebenarnya sehat (insiden SQLITE_BUSY produksi:
// "failed to get LID for PN ... database is locked").
//
// 5 detik menutup kontensi realistis (commit ms-an, transaksi Delete hitungan
// detik, jitter I/O VPS shared) tanpa menggerogoti budget sendAttemptTimeout
// (60 detik): yang lewat dari sini terdegradasi jadi DeadlineExceeded, yang
// memang sudah retryable.
const storeBusyTimeoutMS = 5000

// waStoreDSN menyusun DSN SQLite untuk sqlstore. Diekstrak jadi fungsi supaya
// parameter kritisnya terkunci test (TestStoreDSNHasBusyTimeout) - hilangnya
// _busy_timeout diam-diam mengembalikan perilaku gagal-seketika.
func waStoreDSN(storeDBPath string) string {
	return "file:" + storeDBPath + "?_pragma=foreign_keys(1)&_busy_timeout=" + strconv.Itoa(storeBusyTimeoutMS)
}

// WAClient memiliki *whatsmeow.Client yang DAPAT DIGANTI (whatsapp-
// connection-resilience pilar 1). Penggantian dibutuhkan karena
// store.Device.Delete menandai device Deleted dan mengganti store-nya dengan
// NoopStore - client yang sama mati permanen sesudahnya (defect laten L1/L2).
// container karenanya disimpan, supaya device baru bisa dibuat lewat
// Container.GetFirstDevice (yang otomatis membuat NewDevice saat store
// kosong) lalu dibungkus client baru lewat buildClient.
type WAClient struct {
	mu       sync.RWMutex
	client   *whatsmeow.Client
	gen      uint64
	onNotice func(ConnNotice)

	container *sqlstore.Container
	logger    waLog.Logger
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
	logger := waLog.Stdout("WhatsApp", "INFO", true)
	container, err := sqlstore.New(ctx, "sqlite", waStoreDSN(storeDBPath), logger)
	if err != nil {
		return nil, fmt.Errorf("gagal membuka store WhatsApp: %w", err)
	}
	w := &WAClient{container: container, logger: logger}
	w.mu.Lock()
	defer w.mu.Unlock()
	if err := w.buildClientLocked(ctx); err != nil {
		return nil, err
	}
	return w, nil
}

// buildClientLocked membuat *whatsmeow.Client baru dari device pertama di
// store dan mendaftarkan handler event bergenerasi. Pemanggil WAJIB memegang
// w.mu tulis - dipakai NewWAClient dan ResetSession.
func (w *WAClient) buildClientLocked(ctx context.Context) error {
	device, err := w.container.GetFirstDevice(ctx)
	if err != nil {
		return fmt.Errorf("gagal memuat device WhatsApp: %w", err)
	}
	client := whatsmeow.NewClient(device, w.logger)
	// Keduanya true supaya putus jaringan pulih sendiri: EnableAutoReconnect
	// mengizinkan reconnect, InitialAutoReconnect mengizinkan connect pertama
	// me-retry (menutup G2 - boot container sebelum jaringan/DNS siap).
	client.EnableAutoReconnect = true
	client.InitialAutoReconnect = true
	w.client = client
	w.gen++
	myGen := w.gen
	client.AddEventHandler(func(evt any) {
		w.dispatch(myGen, evt)
	})
	return nil
}

// dispatch meneruskan event ke handler milik Service, membuang notice dari
// generasi client yang sudah usang (ResetSession mengganti client sementara
// handler milik client lama masih bisa menyala - tanpa penjaga generasi,
// event Disconnected dari client lama bisa membatalkan state client baru).
func (w *WAClient) dispatch(gen uint64, evt any) {
	w.mu.RLock()
	if gen != w.gen {
		w.mu.RUnlock()
		return
	}
	fn := w.onNotice
	w.mu.RUnlock()
	if fn == nil {
		return
	}
	if notice, ok := translateEvent(evt); ok {
		fn(notice)
	}
}

// translateEvent memetakan event whatsmeow ke ConnNotice (§3.2). Event di luar
// tabel (Message, Receipt, HistorySync, dsb.) dikembalikan ok=false supaya
// Service tidak kebanjiran kejadian yang tidak berhubungan dengan koneksi.
func translateEvent(evt any) (ConnNotice, bool) {
	switch e := evt.(type) {
	case *events.Connected, *events.PairSuccess:
		return ConnNotice{Event: ConnConnected}, true
	case *events.Disconnected:
		return ConnNotice{Event: ConnDisconnected, Reason: "koneksi WhatsApp terputus"}, true
	case *events.LoggedOut:
		// OnConnect=false = stream:error dari server (mis. 401 device_removed
		// saat admin menghapus perangkat dari HP); Reason hanya bermakna
		// bila OnConnect=true, jadi jangan ditempel membabi buta.
		reason := "perangkat dilepas dari HP"
		if e.OnConnect {
			reason = "perangkat keluar dari sesi WhatsApp (" + e.Reason.String() + ")"
		}
		return ConnNotice{Event: ConnLoggedOut, Reason: reason}, true
	case *events.StreamReplaced:
		return ConnNotice{Event: ConnStreamReplaced, Reason: "sesi diambil alih perangkat lain"}, true
	case *events.KeepAliveTimeout:
		return ConnNotice{Event: ConnKeepAliveTimeout, Reason: fmt.Sprintf("keepalive timeout (%d)", e.ErrorCount)}, true
	case *events.KeepAliveRestored:
		return ConnNotice{Event: ConnKeepAliveRestored}, true
	case *events.ConnectFailure:
		return ConnNotice{Event: ConnFailure, Reason: "gagal koneksi: " + e.Message}, true
	case *events.StreamError:
		return ConnNotice{Event: ConnFailure, Reason: "stream error: " + e.Code}, true
	case *events.ClientOutdated:
		return ConnNotice{Event: ConnFailure, Reason: "versi client kedaluwarsa"}, true
	case *events.TemporaryBan:
		return ConnNotice{Event: ConnFailure, Reason: e.String()}, true
	default:
		return ConnNotice{}, false
	}
}

// IsNotConnectedError melaporkan apakah err (yang bisa terbungkus berlapis,
// mis. "failed to refresh media connections: ... websocket not connected")
// berakar pada whatsmeow.ErrNotConnected. Dipakai application untuk
// klasifikasi retry TANPA mengimpor whatsmeow secara langsung.
func IsNotConnectedError(err error) bool {
	return errors.Is(err, whatsmeow.ErrNotConnected)
}

// sqliteBusyCode adalah SQLITE_BUSY - lock SQLite dipegang koneksi lain.
// Didefinisikan di sini (bukan mengimpor paket C sqlite3 yang berat) karena
// kode hasil SQLite stabil antar versi.
const sqliteBusyCode = 5

// IsDatabaseLockedError melaporkan apakah err berakar pada SQLITE_BUSY dari
// store sesi (wa.db): "failed to get LID for PN ...: database is locked".
// Dipakai application untuk klasifikasi retry, berdampingan dengan
// IsNotConnectedError di atas.
//
// Deteksi SENGAJA via errors.As ke *sqlite.Error + kode, BUKAN match substring
// "database is locked": teks pesan milik library C dan rapuh terhadap
// locale/versi, sedangkan kode hasilnya kontrak stabil. *sqlite.Error tidak
// bisa difabrikasi di test (field unexported) - test memakai kontensi SQLite
// sungguhan (wabusy_test.go).
func IsDatabaseLockedError(err error) bool {
	var sqliteErr *sqlite.Error
	return errors.As(err, &sqliteErr) && sqliteErr.Code() == sqliteBusyCode
}

// SetEventHandler dipasang Service SEBELUM connect pertama dan dipakai ulang
// oleh setiap client hasil rebuild - handler didaftarkan per client di
// buildClientLocked, sedangkan fungsi penerimanya disimpan di sini.
func (w *WAClient) SetEventHandler(fn func(ConnNotice)) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.onNotice = fn
}

// HasStoredSession true bila device ini pernah berhasil pairing sebelumnya.
// Dipakai service untuk memutuskan reconnect otomatis saat boot vs menunggu
// admin memulai pairing baru.
func (w *WAClient) HasStoredSession() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.client.Store.ID != nil
}

func (w *WAClient) IsLoggedIn() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.client.IsLoggedIn()
}

func (w *WAClient) IsConnected() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.client.IsConnected()
}

// IsReady true hanya bila sesi ada DAN socket hidup. Inilah gate yang jujur
// untuk pengiriman - IsLoggedIn saja berbohong sesudah putus jaringan biasa
// (akar masalah §2.1: flag itu hanya di-set false oleh handleStreamError).
func (w *WAClient) IsReady() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.client.IsLoggedIn() && w.client.IsConnected()
}

// GetQRChannel WAJIB dipanggil sebelum Connect() (batasan whatsmeow,
// diverifikasi qrchan.go: memanggil setelah punya session tersimpan
// mengembalikan ErrQRStoreContainsID, dipanggil setelah connect
// mengembalikan ErrQRAlreadyConnected).
func (w *WAClient) GetQRChannel(ctx context.Context) (<-chan QRChannelItem, error) {
	w.mu.RLock()
	client := w.client
	w.mu.RUnlock()
	return client.GetQRChannel(ctx)
}

func (w *WAClient) Connect() error {
	w.mu.RLock()
	client := w.client
	w.mu.RUnlock()
	// ErrAlreadyConnected dihitung SUKSES (sudah dalam keadaan yang diinginkan)
	// sekaligus dinormalisasi di sini: application tidak boleh mengimpor
	// whatsmeow untuk memeriksanya sendiri.
	if err := client.Connect(); err != nil && !errors.Is(err, whatsmeow.ErrAlreadyConnected) {
		return err
	}
	return nil
}

// LogoutRemote adalah jalur IQ resmi (remove-companion-device) ke server
// WhatsApp. GAGAL bila socket mati - pemanggil (Service.Logout) wajib tetap
// melanjutkan ke ResetSession (keputusan D2), bukan mengembalikan error ini
// ke admin.
func (w *WAClient) LogoutRemote(ctx context.Context) error {
	w.mu.RLock()
	client := w.client
	w.mu.RUnlock()
	return client.Logout(ctx)
}

// sessionAlreadyGone melaporkan apakah err dari Store.Delete sebenarnya berarti
// "tidak ada sesi untuk dihapus" - yaitu hasil akhir yang justru DIINGINKAN
// ResetSession, bukan sebuah kegagalan. Ada dua bentuk, dan keduanya wajib
// dimaafkan:
//
//   - store.ErrDeviceDeleted: whatsmeow sudah memanggil Store.Delete sendiri
//     (jalur L2, perangkat dilepas dari HP lewat stream error 401).
//   - sqlstore.ErrDeviceIDMustBeSet: device belum pernah pairing sehingga
//     JID-nya nil dan Container.DeleteDevice menolak lebih dulu. Inilah
//     keadaan client tepat SESUDAH logout sukses maupun sesudah rebuild pada
//     jalur L2 - tanpa pengecualian ini, logout kedua (atau klik dari UI yang
//     masih basi dalam jendela polling) mengembalikan 500 dan memunculkan
//     lagi "Gagal memutus WhatsApp.", persis defect yang diperbaiki §2.3.
func sessionAlreadyGone(err error) bool {
	return errors.Is(err, store.ErrDeviceDeleted) || errors.Is(err, sqlstore.ErrDeviceIDMustBeSet)
}

// ResetSession membersihkan sesi lokal dan membangun ulang client, TANPA
// syarat hasil IQ ke server. Ini obat untuk L1 (client mati permanen sesudah
// Delete) dan L2 (whatsmeow memanggil Store.Delete sendiri saat perangkat
// dilepas dari HP): client baru dibungkus dari device baru yang dibuat
// GetFirstDevice, sehingga pairing ulang langsung bisa tanpa restart API.
func (w *WAClient) ResetSession(ctx context.Context) error {
	// Pembatalan pemanggil sengaja DILEPAS. Membersihkan sesi wajib tuntas:
	// bila admin menutup tab di tengah Logout, menghentikan pekerjaan ini di
	// tengah jalan justru meninggalkan client teracuni (L1) dan mengunci admin
	// - keadaan yang persis ingin dihindari keputusan D2. Deadline sendiri
	// tetap dipasang supaya kegagalan store tidak menggantung selamanya.
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), resetSessionTimeout)
	defer cancel()

	w.mu.Lock()
	defer w.mu.Unlock()
	old := w.client
	old.Disconnect()

	delErr := old.Store.Delete(ctx)
	if sessionAlreadyGone(delErr) {
		delErr = nil
	} else if delErr != nil {
		delErr = fmt.Errorf("gagal menghapus sesi WhatsApp: %w", delErr)
	}
	// Client lama SELALU dibuang, bahkan ketika Delete gagal. Store.Delete yang
	// gagal separuh jalan meninggalkan client teracuni (L1), dan menahan client
	// itu justru mengunci admin - keadaan yang persis ingin dihindari keputusan
	// D2. Kedua error digabung supaya tidak ada yang hilang senyap.
	return errors.Join(delErr, w.buildClientLocked(ctx))
}

func (w *WAClient) Disconnect() {
	w.mu.RLock()
	client := w.client
	w.mu.RUnlock()
	client.Disconnect()
}

// UploadImage mengunggah PNG ke server WhatsApp, langkah wajib sebelum
// SendImageMessage (signature diverifikasi upload.go).
func (w *WAClient) UploadImage(ctx context.Context, png []byte) (whatsmeow.UploadResponse, error) {
	w.mu.RLock()
	client := w.client
	w.mu.RUnlock()
	return client.Upload(ctx, png, whatsmeow.MediaImage)
}

// SendImageMessage mengirim gambar hasil UploadImage sebagai pesan ke nomor
// (already-normalized, format 628xxxxxxxxxx) dengan caption dari template
// ter-substitusi.
func (w *WAClient) SendImageMessage(ctx context.Context, normalizedPhone, caption string, upload whatsmeow.UploadResponse) error {
	w.mu.RLock()
	client := w.client
	w.mu.RUnlock()
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
	_, err := client.SendMessage(ctx, jid, msg)
	return err
}
