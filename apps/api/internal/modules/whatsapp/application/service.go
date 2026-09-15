package application

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/skip2/go-qrcode"

	"undangan-digital/internal/modules/whatsapp/contracts"
	"undangan-digital/internal/modules/whatsapp/infrastructure"
	"undangan-digital/internal/modules/whatsapp/infrastructure/sqlc"
	"undangan-digital/internal/shared/pagination"
)

var _ contracts.Sender = (*Service)(nil)

var (
	ErrPairingInProgress = errors.New("pairing already in progress")
	ErrAlreadyLoggedIn   = errors.New("whatsapp already logged in")
	ErrLogNotFound       = errors.New("send log not found")
	// ErrSendFailed membungkus alasan gagal kirim (mis. "WhatsApp belum
	// tertaut") - dipetakan ke 400 supaya admin melihat alasannya di
	// respons Resend, bukan 500 generik, walau log sudah tercatat benar.
	ErrSendFailed = errors.New("send failed")
	// ErrNotPaired dipakai Reconnect saat belum ada sesi tersimpan -
	// dipetakan ke 400 di StatusHTTPCode.
	ErrNotPaired = errors.New("whatsapp not paired")
	// ErrSocketDown penanda INTERNAL yang dipakai Logout untuk mencatat bahwa
	// jalur IQ resmi tidak sempat dicoba karena socket mati. Nilai ini TIDAK
	// PERNAH dikembalikan ke handler - ia hanya menentukan
	// LogoutResultDTO.RemoteRevoked = false - sehingga tidak perlu (dan tidak
	// boleh) masuk ke StatusHTTPCode.
	ErrSocketDown = errors.New("whatsapp socket down")
)

// Konstanta perilaku siklus hidup koneksi (whatsapp-connection-resilience
// §3.1). INVARIAN YANG WAJIB DIJAGA: stalePendingAfter >
// readyWaitTimeout + sendAttemptTimeout (kini 5 menit > 80 detik). Baris
// pending yang masih dikerjakan goroutine hidup akan disapu
// ReapStalePendingSendLogs dan DIKIRIM DUA KALI ke tamu bila invarian ini
// dilanggar - dikunci test TestResilienceTimeoutInvariant (U6).
const (
	// readyWaitTimeout menutup blip jaringan singkat secara inline; dijalankan
	// di goroutine detached milik guest, jadi tidak menahan respons RSVP tamu.
	readyWaitTimeout = 20 * time.Second
	// readyWaitPoll kadens pengecekan kesiapan selama penantian singkat.
	readyWaitPoll = 500 * time.Millisecond
	// sendAttemptTimeout batas per percobaan upload+kirim; menutup G6
	// (goroutine bocor karena upload menggantung) tanpa menyentuh modul guest.
	sendAttemptTimeout = 60 * time.Second
	// superviseInterval kadens pengawas reconnect.
	superviseInterval = 15 * time.Second
	// retryTickInterval kadens worker retry.
	retryTickInterval = 30 * time.Second
	// retryBatchSize batas eksplisit per tick supaya beban query terikat.
	retryBatchSize = 20
	// maxRetry percobaan maksimum per baris log; sesudahnya failed permanen
	// dan admin bisa Kirim Ulang manual (yang memberi jatah baru).
	maxRetry = 5
	// stalePendingAfter umur baris pending yang dianggap korban restart dan
	// dijadwalkan ulang (menutup G6).
	stalePendingAfter = 5 * time.Minute
	// bookkeepingTimeout batas tulis pembukuan status log - lihat bookkeeping().
	bookkeepingTimeout = 10 * time.Second
)

// bookkeeping melepaskan PEMBATALAN dari ctx pemanggil untuk tulisan pembukuan
// status log. Keputusan status sebuah baris WAJIB tetap tertulis walau ctx
// pemanggil sudah mati - mis. admin menutup tab saat Resend berjalan, sehingga
// r.Context() dibatalkan. Tanpa pelepasan ini tulisan DB ikut dibatalkan dan
// baris log menggantung di keadaan lamanya, sehingga janji §5.3.2 (setiap
// kegagalan mendarat di keadaan yang pasti) tidak berlaku. Deadline sendiri
// tetap dipasang supaya kegagalan DB tidak menggantung selamanya.
func bookkeeping(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(ctx), bookkeepingTimeout)
}

// retryBackoff horizon pemulihan ±4 jam (1m, 5m, 15m, 60m, 180m) - masuk akal
// untuk QR konfirmasi kehadiran. Indeks = retryCount saat penjadwalan.
var retryBackoff = []time.Duration{
	time.Minute,
	5 * time.Minute,
	15 * time.Minute,
	time.Hour,
	3 * time.Hour,
}

// Service mengimplementasikan contracts.Sender (PLAN.md dashboard-wa-rsvp
// §6.3/keputusan #8) - guest.application.Service memanggil SendQR lewat
// interface itu, tidak pernah lewat tipe konkret ini.
type Service struct {
	repo   *infrastructure.Repository
	client *infrastructure.WAClient

	mu           sync.RWMutex
	pairing      bool
	pairingQR    string
	pairingError string
	// lastConnectedAt kapan terakhir Connected; lastError alasan gangguan
	// terakhir (kosong = sehat). Keduanya diisi dari event koneksi, bukan
	// dari polling - lihat catatan §3.3 soal kenapa connected tidak di-mirror.
	lastConnectedAt time.Time
	lastError       string
	// takeover true sesudah StreamReplaced: sesi sedang dipakai perangkat
	// lain, dan reconnect otomatis justru akan saling rebut - supervise
	// lewat sampai admin menekan Sambungkan Ulang / pairing ulang / putus.
	takeover bool
	// stop membatalkan context milik supervisor & worker (dipakai test);
	// signature NewService tetap sama, main.go tidak diubah (§3.3).
	stop context.CancelFunc
}

func NewService(repo *infrastructure.Repository, client *infrastructure.WAClient) *Service {
	ctx, stop := context.WithCancel(context.Background())
	s := &Service{repo: repo, client: client, stop: stop}
	// Handler dipasang SEBELUM connect pertama supaya event boot (Connected
	// maupun LoggedOut dari sesi basi) tidak terlewat.
	client.SetEventHandler(s.handleConnNotice)
	go s.supervise(ctx)
	go s.retryWorker(ctx)
	return s
}

// Close menghentikan supervisor dan worker. Dipakai test; server produksi
// belum punya graceful shutdown (main.go), jadi tidak ada pemanggil lain.
func (s *Service) Close() {
	if s.stop != nil {
		s.stop()
	}
}

// handleConnNotice menerapkan tabel §3.2. Dipanggil dari goroutine event
// whatsmeow - hanya menyentuh state lokal + SQLite, tidak pernah memblokir
// panggilan jaringan.
func (s *Service) handleConnNotice(n infrastructure.ConnNotice) {
	switch n.Event {
	case infrastructure.ConnConnected:
		s.mu.Lock()
		s.lastConnectedAt = time.Now()
		s.lastError = ""
		s.pairing = false
		s.pairingQR = ""
		s.pairingError = ""
		s.takeover = false
		s.mu.Unlock()
	case infrastructure.ConnDisconnected:
		// Biarkan auto-reconnect bawaan whatsmeow + supervise bekerja;
		// cukup catat alasannya supaya Status jujur.
		s.mu.Lock()
		s.lastError = n.Reason
		s.mu.Unlock()
	case infrastructure.ConnLoggedOut:
		// whatsmeow SUDAH memanggil Store.Delete sendiri pada jalur ini
		// (defect laten L2) - bangun ulang client supaya pairing ulang
		// langsung bisa tanpa restart API (obat L1/L2).
		if err := s.client.ResetSession(context.Background()); err != nil {
			log.Printf("whatsapp: gagal membangun ulang client sesudah logout: %v", err)
		}
		s.mu.Lock()
		s.pairing = false
		s.pairingQR = ""
		s.pairingError = ""
		s.takeover = false
		s.lastConnectedAt = time.Time{}
		s.lastError = n.Reason
		s.mu.Unlock()
	case infrastructure.ConnStreamReplaced:
		s.mu.Lock()
		s.lastError = n.Reason
		s.takeover = true
		s.mu.Unlock()
	case infrastructure.ConnKeepAliveTimeout:
		s.mu.Lock()
		s.lastError = n.Reason
		s.mu.Unlock()
	case infrastructure.ConnKeepAliveRestored:
		s.mu.Lock()
		s.lastError = ""
		s.mu.Unlock()
	case infrastructure.ConnFailure:
		s.mu.Lock()
		s.lastError = n.Reason
		s.mu.Unlock()
	}
}

// supervise jaring pengaman di atas auto-reconnect bawaan whatsmeow: tiap
// superviseInterval, reconnect bila punya sesi, tidak sedang pairing, sesi
// tidak sedang dipakai perangkat lain, dan tidak terhubung.
func (s *Service) supervise(ctx context.Context) {
	s.reconnectIfNeeded()
	t := time.NewTicker(superviseInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.reconnectIfNeeded()
		}
	}
}

func (s *Service) reconnectIfNeeded() {
	s.mu.RLock()
	pairing := s.pairing
	takeover := s.takeover
	s.mu.RUnlock()
	if pairing || takeover {
		return
	}
	if !s.client.HasStoredSession() {
		return
	}
	if s.client.IsConnected() {
		return
	}
	// ErrAlreadyConnected sudah dinormalisasi jadi nil oleh WAClient.Connect.
	if err := s.client.Connect(); err != nil {
		log.Printf("whatsapp: reconnect otomatis gagal: %v", err)
	}
}

// retryWorker mengerjakan antrian retry (keputusan D1): tiap retryTickInterval
// ia menyapu pending basi, membaca GetConfig SEKALI per tick (bukan per
// baris), lalu mengirim maksimal retryBatchSize baris jatuh tempo SECARA
// BERURUTAN (paralel berisiko rate-limit hingga pemblokiran nomor).
func (s *Service) retryWorker(ctx context.Context) {
	s.processRetries(ctx)
	t := time.NewTicker(retryTickInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			s.processRetries(ctx)
		}
	}
}

func (s *Service) processRetries(ctx context.Context) {
	now := time.Now()
	// Baris pending yang lebih tua dari stalePendingAfter tidak mungkin masih
	// dikerjakan goroutine hidup (invarian §3.1) - korbannya restart, bukan
	// kiriman berjalan. Dijadwalkan segera (now): worker hanya mengirim saat
	// IsReady, jadi tidak ada retry yang terbuang saat koneksi masih putus.
	if err := s.repo.ReapStalePendingSendLogs(ctx, sqlc.ReapStalePendingSendLogsParams{
		NextRetryAt: sql.NullTime{Time: now, Valid: true},
		CreatedAt:   now.Add(-stalePendingAfter),
	}); err != nil {
		log.Printf("whatsapp: worker retry gagal menyapu pending basi: %v", err)
	}
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		log.Printf("whatsapp: worker retry gagal membaca config: %v", err)
		return
	}
	if !cfg.IsEnabled {
		return
	}
	if !s.client.IsReady() {
		return
	}
	rows, err := s.repo.ListRetryableSendLogs(ctx, sqlc.ListRetryableSendLogsParams{
		NextRetryAt: sql.NullTime{Time: now, Valid: true},
		Limit:       retryBatchSize,
	})
	if err != nil {
		log.Printf("whatsapp: worker retry gagal membaca antrian: %v", err)
		return
	}
	// Snapshot dari baris log - TANPA menyentuh tabel modul lain. row.RetryCount
	// inilah yang membuat backoff menaik dan maxRetry akhirnya tercapai (§5.3.1).
	for _, row := range rows {
		// Koneksi bisa putus DI TENGAH batch. Berhenti begitu itu terjadi:
		// tanpa penjaga ini setiap sisa baris (hingga retryBatchSize) akan
		// gagal dan MENGHABISKAN satu jatah retry-nya percuma, padahal
		// penyebabnya satu dan sama. Baris yang belum tersentuh tetap berada
		// di antrian dan diambil lagi pada tick berikutnya.
		if !s.client.IsReady() {
			return
		}
		if err := s.sendAndRecord(ctx, jobFromLog(row, int(row.RetryCount), false), cfg); err != nil {
			log.Printf("whatsapp: retry log %d gagal: %v", row.ID, err)
		}
	}
}

// waitUntilReady polling 500ms sampai isReady() benar atau readyWaitTimeout
// habis. Kesiapan DISUNTIKKAN sebagai closure (bukan dibaca dari s.client)
// supaya fungsinya murni dan dapat diuji tanpa koneksi (§10.1); pemanggil di
// sendAndRecord mengoper s.client.IsReady. Channel broadcast sengaja TIDAK
// dipakai: close-lalu-pakai-ulang adalah sumber bug klasik, dan 40 kali baca
// flag atomik selama 20 detik tidak berarti apa-apa secara biaya (§3.3).
func waitUntilReady(ctx context.Context, isReady func() bool) bool {
	return waitUntilReadyWithTimeout(ctx, isReady, readyWaitTimeout, readyWaitPoll)
}

// waitUntilReadyWithTimeout inti dari waitUntilReady dengan timeout yang
// disuntikkan - dipakai test supaya kasus "timeout habis" tidak menunggu 20
// detik penuh. Produksi selalu lewat waitUntilReady (readyWaitTimeout).
func waitUntilReadyWithTimeout(ctx context.Context, isReady func() bool, timeout, poll time.Duration) bool {
	if isReady() {
		return true
	}
	ticker := time.NewTicker(poll)
	defer ticker.Stop()
	deadline := time.NewTimer(timeout)
	defer deadline.Stop()
	for {
		select {
		case <-ctx.Done():
			return false
		case <-deadline.C:
			return false
		case <-ticker.C:
			if isReady() {
				return true
			}
		}
	}
}

// classifySendError true = retryable. Default SENGAJA permanen (§5.3.2):
// kesalahan menandai sesuatu permanen hanya berujung satu baris failed yang
// bisa ditekan Kirim Ulang oleh admin, sedangkan kesalahan menandai sesuatu
// retryable bisa berujung pesan ganda ke tamu.
func classifySendError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.Canceled) {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	if os.IsTimeout(err) {
		return true
	}
	// SQLITE_BUSY dari store sesi (mis. "failed to get LID for PN ...:
	// database is locked"): kontensi lock transien, dan - yang menentukan -
	// kegagalannya terjadi SEBELUM satu byte pesan pun terkirim (resolusi LID
	// mendahului enkripsi + kirim di whatsmeow), sehingga retry terbukti aman
	// dari pesan ganda. Tanpa ini, satu tabrakan lock sesaat memfinalkan
	// kiriman permanen sebagai failed.
	if infrastructure.IsDatabaseLockedError(err) {
		return true
	}
	return infrastructure.IsNotConnectedError(err)
}

// nextRetryDelay retryCount -> backoff menurut tabel §3.1. Fungsi murni agar
// dapat diuji tanpa DB; batas terminal (maxRetry) ditegakkan scheduleRetry,
// bukan di sini.
func nextRetryDelay(retryCount int) time.Duration {
	if retryCount < 0 {
		retryCount = 0
	}
	if retryCount >= len(retryBackoff) {
		return retryBackoff[len(retryBackoff)-1]
	}
	return retryBackoff[retryCount]
}

// scheduleRetry menjadwalkan percobaan ulang, atau memfinalkan failed bila
// jatah habis (retryCount+1 > maxRetry). retry_count ditulis ABSOLUT
// (retryCount+1), bukan increment relatif - lihat §5.3.1.
func (s *Service) scheduleRetry(ctx context.Context, logID uint64, retryCount int, reason string) error {
	if retryCount+1 > maxRetry {
		return s.finalizeLog(ctx, logID, false, reason)
	}
	wctx, cancel := bookkeeping(ctx)
	defer cancel()
	return s.repo.ScheduleSendLogRetry(wctx, sqlc.ScheduleSendLogRetryParams{
		ErrorMessage: sql.NullString{String: reason, Valid: true},
		RetryCount:   uint8(retryCount + 1),
		NextRetryAt:  sql.NullTime{Time: time.Now().Add(nextRetryDelay(retryCount)), Valid: true},
		ID:           logID,
	})
}

// buildStatusDTO merakit WhatsAppStatusDTO dari nilai-nilai mentah. Fungsi
// murni (seluruh masukan berupa nilai) supaya dapat diuji tanpa koneksi
// maupun DB (§10.1); Status hanya membaca state lalu menyerahkan ke sini.
func buildStatusDTO(loggedIn, connected, pairing bool, qr, pairErr string, lastConnectedAt *time.Time, lastErr string) WhatsAppStatusDTO {
	var lca string
	if lastConnectedAt != nil && !lastConnectedAt.IsZero() {
		lca = lastConnectedAt.Format(time.RFC3339)
	}
	return WhatsAppStatusDTO{
		LoggedIn:        loggedIn,
		Connected:       connected,
		Pairing:         pairing,
		PairingQR:       qr,
		PairingError:    pairErr,
		LastConnectedAt: lca,
		LastError:       lastErr,
	}
}

// --- status & pairing (§6.4) ---

func (s *Service) Status(ctx context.Context) WhatsAppStatusDTO {
	loggedIn := s.client.IsLoggedIn()
	connected := s.client.IsConnected()
	s.mu.RLock()
	defer s.mu.RUnlock()
	var lca *time.Time
	if !s.lastConnectedAt.IsZero() {
		c := s.lastConnectedAt
		lca = &c
	}
	return buildStatusDTO(loggedIn, connected, s.pairing, s.pairingQR, s.pairingError, lca, s.lastError)
}

// StartPairing memanggil GetQRChannel SEBELUM Connect (batasan whatsmeow -
// terbalik = tidak akan pernah menghasilkan QR, lihat PLAN.md §2/§6.4).
func (s *Service) StartPairing(ctx context.Context) error {
	s.mu.Lock()
	if s.pairing {
		s.mu.Unlock()
		return ErrPairingInProgress
	}
	if s.client.IsLoggedIn() {
		s.mu.Unlock()
		return ErrAlreadyLoggedIn
	}
	s.pairing = true
	s.pairingQR = ""
	s.pairingError = ""
	s.takeover = false
	s.lastError = ""
	s.mu.Unlock()

	ch, err := s.client.GetQRChannel(context.Background())
	if err != nil {
		s.mu.Lock()
		s.pairing = false
		s.mu.Unlock()
		return err
	}
	if err := s.client.Connect(); err != nil {
		s.mu.Lock()
		s.pairing = false
		s.mu.Unlock()
		return err
	}
	go s.consumeQRChannel(ch)
	return nil
}

func (s *Service) consumeQRChannel(ch <-chan infrastructure.QRChannelItem) {
	for item := range ch {
		s.mu.Lock()
		switch item.Event {
		case "code":
			s.pairingQR = item.Code
		case "success":
			s.pairing = false
			s.pairingQR = ""
			s.pairingError = ""
		default: // "timeout", "error", dan varian err-* lain
			s.pairing = false
			s.pairingQR = ""
			if item.Error != nil {
				s.pairingError = item.Error.Error()
			} else {
				s.pairingError = "Pairing gagal (" + item.Event + ")"
			}
		}
		s.mu.Unlock()
	}
}

// Logout SELALU berhasil membersihkan sesi lokal (keputusan D2): jalur IQ
// resmi dicoba dulu bila socket hidup, tetapi ResetSession dijalankan TANPA
// SYARAT apa pun hasil IQ-nya. Hanya kegagalan ResetSession yang boleh
// menjadi error yang dikembalikan - admin tidak boleh lagi terjebak (§2.3).
func (s *Service) Logout(ctx context.Context) (LogoutResultDTO, error) {
	var remoteErr error
	if s.client.IsReady() {
		remoteErr = s.client.LogoutRemote(ctx)
	} else {
		remoteErr = ErrSocketDown
	}
	if err := s.client.ResetSession(ctx); err != nil {
		return LogoutResultDTO{}, err
	}
	s.mu.Lock()
	s.pairing = false
	s.pairingQR = ""
	s.pairingError = ""
	s.takeover = false
	s.lastConnectedAt = time.Time{}
	s.lastError = ""
	s.mu.Unlock()
	return LogoutResultDTO{RemoteRevoked: remoteErr == nil}, nil
}

// Reconnect pemulihan manual oleh admin (keputusan D4): tanpa sesi tersimpan
// berarti belum pernah pairing - kembalikan ErrNotPaired (400), bukan mencoba
// connect buta yang pasti gagal.
func (s *Service) Reconnect(ctx context.Context) error {
	if !s.client.HasStoredSession() {
		return ErrNotPaired
	}
	s.client.Disconnect()
	s.mu.Lock()
	s.takeover = false
	s.lastError = ""
	s.mu.Unlock()
	return s.client.Connect()
}

// --- konfigurasi template & status aktif (keputusan #20) ---

func (s *Service) GetConfig(ctx context.Context) (WhatsAppConfigDTO, error) {
	row, err := s.repo.GetConfig(ctx)
	if err != nil {
		return WhatsAppConfigDTO{}, err
	}
	return WhatsAppConfigDTO{
		MessageTemplate:    row.MessageTemplate,
		InvitationTemplate: row.InvitationTemplate,
		IsEnabled:          row.IsEnabled,
	}, nil
}

func (s *Service) UpdateConfig(ctx context.Context, in WhatsAppConfigDTO) error {
	// Template undangan kosong adalah keadaan SAH - tidak ada validasi wajib
	// di sini; tombol Kirim Undangan yang menonaktifkan diri (T24).
	return s.repo.UpdateConfig(ctx, sqlc.UpdateWhatsAppConfigParams{
		MessageTemplate:    in.MessageTemplate,
		InvitationTemplate: in.InvitationTemplate,
		IsEnabled:          in.IsEnabled,
	})
}

// --- log kirim & kirim ulang ---

func (s *Service) ListLogs(ctx context.Context, p pagination.Params) ([]SendLogDTO, int, error) {
	total, err := s.repo.CountSendLogs(ctx)
	if err != nil {
		return nil, 0, err
	}
	rows, err := s.repo.ListSendLogs(ctx, sqlc.ListSendLogsParams{
		Limit: int32(p.Limit), Offset: int32(p.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}
	return mapLogDTOs(rows), int(total), nil
}

func mapLogDTOs(rows []sqlc.WhatsappSendLog) []SendLogDTO {
	out := make([]SendLogDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toLogDTO(r))
	}
	return out
}

func toLogDTO(r sqlc.WhatsappSendLog) SendLogDTO {
	var errMsg *string
	if r.ErrorMessage.Valid {
		v := r.ErrorMessage.String
		errMsg = &v
	}
	var sentAt *string
	if r.SentAt.Valid {
		v := r.SentAt.Time.Format("2006-01-02T15:04:05Z07:00")
		sentAt = &v
	}
	return SendLogDTO{
		ID: r.ID, GuestID: r.GuestID, GuestName: r.GuestName, Phone: r.Phone,
		AttendingCount: int(r.AttendingCount), Status: string(r.Status),
		ErrorMessage: errMsg, SentAt: sentAt,
		CreatedAt: r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// Resend memakai data denormalisasi di log (keputusan #12) - TIDAK membaca
// tabel guests maupun invitation_content milik modul lain. retryCount = 0
// DISENGAJA (§5.3.1): tindakan manual admin memberi jatah retry BARU - tanpa
// ini, baris yang sudah kehabisan jatah langsung gagal permanen lagi dan
// tombolnya terlihat rusak.
func (s *Service) Resend(ctx context.Context, logID uint64) error {
	row, err := s.repo.GetSendLogByID(ctx, logID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrLogNotFound
		}
		return err
	}
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return err
	}
	// waitInline=false: ini permintaan HTTP sinkron. Bila koneksi sedang putus,
	// baris langsung masuk antrian retry dan admin menerima jawabannya seketika
	// ("dijadwalkan ulang") alih-alih menunggu sampai 80 detik.
	return s.sendAndRecord(ctx, jobFromLog(row, 0, false), cfg)
}

// --- implementasi contracts.Sender ---

func (s *Service) SendQR(ctx context.Context, in contracts.SendQRInput) error {
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return err
	}
	logID, err := s.repo.InsertSendLog(ctx, sqlc.InsertSendLogParams{
		GuestID: in.GuestID, GuestName: in.GuestName, Phone: in.Phone, QrPayload: in.QRPayload,
		CoupleName: in.CoupleName, EventDateLabel: in.EventDateLabel, AttendingCount: uint8(in.AttendingCount),
		Status: sqlc.WhatsappSendLogsStatusPending,
	})
	if err != nil {
		return err
	}
	// waitInline=true: SATU-SATUNYA jalur yang menunggu di tempat. Pemanggilnya
	// adalah goroutine detached milik guest, jadi penantian 20 detik keputusan
	// D1 tidak menahan respons RSVP tamu sama sekali.
	return s.sendAndRecord(ctx, sendJob{
		logID:          uint64(logID),
		phone:          in.Phone,
		guestName:      in.GuestName,
		qrPayload:      in.QRPayload,
		coupleName:     in.CoupleName,
		eventDateLabel: in.EventDateLabel,
		attendingCount: in.AttendingCount,
		retryCount:     0,
		waitInline:     true,
	}, cfg)
}

// sendJob adalah satu pekerjaan kirim yang LENGKAP SENDIRI: seluruh isinya
// snapshot dari baris whatsapp_send_logs, sehingga modul ini tidak pernah
// perlu membaca tabel milik modul lain (keputusan #12/#19). Dikumpulkan dalam
// satu struct supaya menambah aturan per-jalur (waitInline) tidak menambah
// parameter posisional ke sendAndRecord.
type sendJob struct {
	logID          uint64
	phone          string
	guestName      string
	qrPayload      string
	coupleName     string
	eventDateLabel string
	attendingCount int
	// retryCount jumlah percobaan yang SUDAH tercatat pada baris log (§5.3.1).
	retryCount int
	// waitInline menentukan apakah boleh menunggu koneksi pulih di tempat.
	// True HANYA pada jalur yang tidak menahan siapa pun: SendQR berjalan di
	// goroutine detached milik guest, jadi "tunggu singkat" keputusan D1 di
	// sana gratis. Jalur HTTP sinkron (Resend) dan worker retry memakai false
	// - antrian retry sudah menjadi jaring pengamannya, sehingga menunggu di
	// sana hanya memblokir admin sampai 80 detik (berisiko 504 di reverse
	// proxy) atau mengunci worker berbatch-batch.
	waitInline bool
}

// ready memusatkan aturan menunggu itu di satu tempat, supaya sendAndRecord
// tidak perlu bercabang dan tidak ada jalur yang lupa menerapkannya.
func (j sendJob) ready(ctx context.Context, isReady func() bool) bool {
	if j.waitInline {
		return waitUntilReady(ctx, isReady)
	}
	return isReady()
}

// jobFromLog menyusun sendJob dari baris log - dipakai Resend & retryWorker.
func jobFromLog(row sqlc.WhatsappSendLog, retryCount int, waitInline bool) sendJob {
	return sendJob{
		logID:          row.ID,
		phone:          row.Phone,
		guestName:      row.GuestName,
		qrPayload:      row.QrPayload,
		coupleName:     row.CoupleName,
		eventDateLabel: row.EventDateLabel,
		attendingCount: int(row.AttendingCount),
		retryCount:     retryCount,
		waitInline:     waitInline,
	}
}

// sendAndRecord dipakai bersama oleh SendQR, Resend, dan retryWorker supaya
// ketiganya menjalankan alur kirim yang identik. retryCount WAJIB dioper
// sebagai parameter (§5.3.1): SendQR/Resend mengoper 0 (baris baru / jatah
// baru), worker mengoper row.RetryCount (backoff menaik).
//
// Klasifikasi kegagalan mengikat tabel §5.3.2: hanya gangguan koneksi yang
// masuk antrian retry; nomor kosong, pengiriman yang dinonaktifkan, sesi yang
// belum tertaut, dan error tak dikenal difinalkan permanen.
func (s *Service) sendAndRecord(ctx context.Context, job sendJob, cfg sqlc.WhatsappConfig) error {
	failPermanent := func(reason string) error {
		if logErr := s.finalizeLog(ctx, job.logID, false, reason); logErr != nil {
			return logErr
		}
		return fmt.Errorf("%w: %s", ErrSendFailed, reason)
	}
	failRetryable := func(reason string) error {
		if err := s.scheduleRetry(ctx, job.logID, job.retryCount, reason); err != nil {
			return err
		}
		return fmt.Errorf("%w: %s", ErrSendFailed, reason)
	}

	// Keputusan #20: is_enabled dicek lebih dulu - client WhatsApp TIDAK
	// dipanggil sama sekali bila dinonaktifkan.
	if !cfg.IsEnabled {
		return failPermanent("pengiriman dinonaktifkan")
	}
	normalized, ok := normalizePhone(job.phone)
	if !ok {
		return failPermanent("nomor telepon kosong")
	}
	// Gate KEJUJURAN (akar masalah §2.1): HasStoredSession permanen (butuh
	// pairing oleh admin, menunggu tidak membantu), kesiapan socket retryable.
	if !s.client.HasStoredSession() {
		return failPermanent("WhatsApp belum tertaut")
	}
	if !job.ready(ctx, s.client.IsReady) {
		return failRetryable("koneksi WhatsApp belum siap, dijadwalkan ulang")
	}
	png, err := renderQRPNG(job.qrPayload)
	if err != nil {
		return failPermanent("gagal membuat QR: " + err.Error())
	}
	attemptCtx, cancel := context.WithTimeout(ctx, sendAttemptTimeout)
	defer cancel()
	upload, err := s.client.UploadImage(attemptCtx, png)
	if err != nil {
		if classifySendError(err) {
			return failRetryable("gagal unggah gambar: " + err.Error())
		}
		return failPermanent("gagal unggah gambar: " + err.Error())
	}
	caption := applyTemplate(cfg.MessageTemplate, job.guestName, job.attendingCount, job.coupleName, job.eventDateLabel)
	if err := s.client.SendImageMessage(attemptCtx, normalized, caption, upload); err != nil {
		if classifySendError(err) {
			return failRetryable("gagal kirim pesan: " + err.Error())
		}
		return failPermanent("gagal kirim pesan: " + err.Error())
	}
	return s.finalizeLog(ctx, job.logID, true, "")
}

func (s *Service) finalizeLog(ctx context.Context, logID uint64, success bool, reason string) error {
	status := sqlc.WhatsappSendLogsStatusFailed
	var sentAt sql.NullTime
	var errMsg sql.NullString
	if success {
		status = sqlc.WhatsappSendLogsStatusSent
		sentAt = sql.NullTime{Time: time.Now(), Valid: true}
	} else {
		errMsg = sql.NullString{String: reason, Valid: true}
	}
	wctx, cancel := bookkeeping(ctx)
	defer cancel()
	return s.repo.UpdateSendLogStatus(wctx, sqlc.UpdateSendLogStatusParams{
		Status: status, ErrorMessage: errMsg, SentAt: sentAt, ID: logID,
	})
}

// --- helper murni, diuji tanpa koneksi WhatsApp/DB (service_test.go) ---

// normalizePhone menyeragamkan nomor lokal (08xx) maupun format +62 ke
// 62xxxxxxxxxx yang dipakai types.NewJID. Nomor kosong -> (_, false).
func normalizePhone(phone string) (string, bool) {
	p := strings.TrimSpace(phone)
	p = strings.ReplaceAll(p, " ", "")
	p = strings.ReplaceAll(p, "-", "")
	if p == "" {
		return "", false
	}
	switch {
	case strings.HasPrefix(p, "+62"):
		p = "62" + p[3:]
	case strings.HasPrefix(p, "0"):
		p = "62" + p[1:]
	}
	return p, true
}

func applyTemplate(tpl, guestName string, attendingCount int, coupleName, eventDateLabel string) string {
	r := strings.NewReplacer(
		"{nama}", guestName,
		"{jumlah}", strconv.Itoa(attendingCount),
		"{mempelai}", coupleName,
		"{tanggal}", eventDateLabel,
	)
	return r.Replace(tpl)
}

func renderQRPNG(payload string) ([]byte, error) {
	return qrcode.Encode(payload, qrcode.Medium, 512)
}

// StatusHTTPCode memetakan error domain ke status HTTP - dipakai presentation.
// ErrSocketDown SENGAJA tidak ada di sini: ia murni internal Logout dan tidak
// pernah dikembalikan ke handler (§5.3).
func StatusHTTPCode(err error) int {
	switch {
	case errors.Is(err, ErrLogNotFound):
		return 404
	case errors.Is(err, ErrPairingInProgress), errors.Is(err, ErrAlreadyLoggedIn), errors.Is(err, ErrSendFailed), errors.Is(err, ErrNotPaired):
		return 400
	default:
		return 500
	}
}
