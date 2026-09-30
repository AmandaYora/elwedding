package application

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/skip2/go-qrcode"

	"undangan-digital/internal/modules/telegram/contracts"
	"undangan-digital/internal/modules/telegram/infrastructure"
	"undangan-digital/internal/modules/telegram/infrastructure/sqlc"
	"undangan-digital/internal/shared/pagination"
)

var _ contracts.Sender = (*Service)(nil)

var (
	ErrLogNotFound = errors.New("send log not found")
	// ErrSendFailed membungkus alasan gagal kirim - dipetakan ke 400 supaya
	// admin melihat alasannya di respons Resend, bukan 500 generik, walau log
	// sudah tercatat benar (pola ErrSendFailed whatsapp).
	ErrSendFailed = errors.New("send failed")
	// ErrNotPaired dipakai saat belum ada sesi sah - dipetakan ke 400.
	ErrNotPaired = errors.New("telegram belum tertaut")
	// ErrAlreadyLoggedIn dipakai StartLogin saat sesi sudah sah.
	ErrAlreadyLoggedIn = errors.New("telegram sudah tertaut")
	// ErrCodeInvalid dipakai CompleteLogin saat kode OTP salah/kedaluwarsa.
	ErrCodeInvalid = errors.New("kode OTP salah atau kedaluwarsa")
	// ErrPasswordNeeded dipakai CompleteLogin saat akun ber-2FA tetapi
	// password belum dikirim - BUKAN kegagalan: dashboard memakai ini untuk
	// menampilkan field password.
	ErrPasswordNeeded = errors.New("akun memakai verifikasi 2 langkah, kirim password")
	// ErrNoLoginPending dipakai CompleteLogin tanpa StartLogin lebih dulu
	// (mis. sesudah API restart - hash kode hanya di memori).
	ErrNoLoginPending = errors.New("belum ada permintaan login, mulai dari login/start dulu")
)

// Perilaku antrian retry - SAMA dengan modul whatsapp
// (whatsapp-connection-resilience §3.1): horizon ±4 jam (1m, 5m, 15m, 60m,
// 180m), maksimal 5 percobaan, sapu pending basi 5 menit.
const (
	sendAttemptTimeout = 60 * time.Second
	retryTickInterval  = 30 * time.Second
	retryBatchSize     = 20
	maxRetry           = 5
	stalePendingAfter  = 5 * time.Minute
	// bookkeepingTimeout batas tulis pembukuan status log - lihat bookkeeping().
	bookkeepingTimeout = 10 * time.Second
	// statusTimeout batas pemeriksaan auth di endpoint Status: admin
	// mem-polling tiap ~15 detik, jadi pemeriksaan tidak boleh menggantung
	// lebih lama dari itu.
	statusTimeout = 25 * time.Second
)

// bookkeeping melepaskan PEMBATALAN dari ctx pemanggil untuk tulisan pembukuan
// status log (pola bookkeeping whatsapp): keputusan status sebuah baris WAJIB
// tetap tertulis walau ctx pemanggil sudah mati.
func bookkeeping(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(ctx), bookkeepingTimeout)
}

// retryBackoff horizon pemulihan ±4 jam - masuk akal untuk QR konfirmasi
// kehadiran. Indeks = retryCount saat penjadwalan.
var retryBackoff = []time.Duration{
	time.Minute,
	5 * time.Minute,
	15 * time.Minute,
	time.Hour,
	3 * time.Hour,
}

// Service mengimplementasikan contracts.Sender - guest.application.Service
// memanggil SendQR lewat interface itu, tidak pernah lewat tipe konkret ini.
type Service struct {
	repo   *infrastructure.Repository
	client *infrastructure.TGClient

	mu sync.RWMutex
	// loginPending + loginHash adalah kode OTP yang sedang menunggu
	// dilengkapi (CompleteLogin). Hash-nya HANYA di memori: restart API
	// menghapusnya dan admin mengulang dari login/start (lihat
	// ErrNoLoginPending) - sesi SAH sendiri aman di file dan tidak
	// terpengaruh restart.
	loginPending bool
	loginHash    string
	loginError   string
	// lastConnectedAt kapan terakhir operasi berhasil; lastError alasan
	// gangguan terakhir (kosong = sehat).
	lastConnectedAt time.Time
	lastError       string

	stop context.CancelFunc
}

func NewService(repo *infrastructure.Repository, client *infrastructure.TGClient) *Service {
	ctx, stop := context.WithCancel(context.Background())
	s := &Service{repo: repo, client: client, stop: stop}
	go s.retryWorker(ctx)
	return s
}

// Close menghentikan worker. Dipakai test; server produksi belum punya
// graceful shutdown (main.go), jadi tidak ada pemanggil lain.
func (s *Service) Close() {
	if s.stop != nil {
		s.stop()
	}
}

// --- status & login (pengganti pairing QR milik whatsapp) ---

func (s *Service) Status(ctx context.Context) TelegramStatusDTO {
	s.mu.RLock()
	pending, loginErr := s.loginPending, s.loginError
	lastErr := s.lastError
	var lca string
	if !s.lastConnectedAt.IsZero() {
		lca = s.lastConnectedAt.Format(time.RFC3339)
	}
	s.mu.RUnlock()

	// Tanpa file sesi, tidak ada yang perlu diperiksa ke jaringan - jawab
	// seketika supaya polling dashboard murah.
	if !s.client.HasStoredSession() {
		return TelegramStatusDTO{LoggedIn: false, LoginPending: pending, LoginError: loginErr, LastError: lastErr}
	}
	ctx, cancel := context.WithTimeout(ctx, statusTimeout)
	defer cancel()
	authorized, err := s.client.CheckAuth(ctx)
	s.mu.Lock()
	defer s.mu.Unlock()
	if err != nil {
		s.lastError = err.Error()
		return TelegramStatusDTO{
			LoggedIn: false, LoginPending: pending, LoginError: loginErr,
			LastConnectedAt: lca, LastError: s.lastError,
		}
	}
	if !authorized {
		// File ada tetapi sesi ditolak server (dicabut dari HP / kedaluwarsa):
		// laporkan belum tertaut + alasannya, supaya admin menekan login ulang
		// alih-alih mengira jaringan yang putus.
		s.lastError = "sesi ditolak server, login ulang"
		return TelegramStatusDTO{
			LoggedIn: false, LoginPending: pending, LoginError: loginErr,
			LastConnectedAt: lca, LastError: s.lastError,
		}
	}
	s.lastConnectedAt = time.Now()
	s.lastError = ""
	return TelegramStatusDTO{
		LoggedIn: true, Connected: true, LoginPending: pending, LoginError: loginErr,
		LastConnectedAt: s.lastConnectedAt.Format(time.RFC3339),
	}
}

// StartLogin meminta Telegram mengirim kode OTP ke nomor HP akun userbot.
// Mengirim ulang kode (StartLogin dua kali) adalah keadaan SAH - Telegram
// menginvalidasi hash lama dan CompleteLogin memakai yang terbaru.
func (s *Service) StartLogin(ctx context.Context) (TelegramLoginStartDTO, error) {
	if s.client.HasStoredSession() {
		if authorized, err := s.client.CheckAuth(ctx); err == nil && authorized {
			return TelegramLoginStartDTO{}, ErrAlreadyLoggedIn
		}
	}
	hash, err := s.client.SendCode(ctx)
	if err != nil {
		if errors.Is(err, infrastructure.ErrAlreadyAuthorized) {
			return TelegramLoginStartDTO{}, ErrAlreadyLoggedIn
		}
		s.mu.Lock()
		s.loginPending, s.loginHash, s.loginError = false, "", err.Error()
		s.mu.Unlock()
		return TelegramLoginStartDTO{}, fmt.Errorf("%w: %v", ErrSendFailed, err)
	}
	s.mu.Lock()
	s.loginPending, s.loginHash, s.loginError = true, hash, ""
	s.mu.Unlock()
	return TelegramLoginStartDTO{Phone: s.client.Phone()}, nil
}

// CompleteLogin menukar kode OTP (+ password 2FA bila dibutuhkan) jadi sesi.
// Hash kode diambil dari memori StartLogin - TIDAK PERNAH dari klien, supaya
// browser tidak bisa memalsukan sesi dengan hash karangan.
func (s *Service) CompleteLogin(ctx context.Context, code, password string) error {
	s.mu.RLock()
	pending, hash := s.loginPending, s.loginHash
	s.mu.RUnlock()
	if !pending || hash == "" {
		return ErrNoLoginPending
	}
	if strings.TrimSpace(code) == "" {
		return ErrCodeInvalid
	}
	err := s.client.CompleteLogin(ctx, strings.TrimSpace(code), hash, password)
	if err == nil {
		s.mu.Lock()
		s.loginPending, s.loginHash, s.loginError = false, "", ""
		s.lastConnectedAt, s.lastError = time.Now(), ""
		s.mu.Unlock()
		return nil
	}
	if errors.Is(err, infrastructure.ErrPasswordNeeded) {
		return ErrPasswordNeeded
	}
	if errors.Is(err, infrastructure.ErrCodeInvalid) {
		s.mu.Lock()
		// Hash tetap berlaku untuk percobaan ulang dengan kode yang benar -
		// yang salah hanya kodenya, bukan hash-nya.
		s.loginError = err.Error()
		s.mu.Unlock()
		return ErrCodeInvalid
	}
	s.mu.Lock()
	s.loginError = err.Error()
	s.mu.Unlock()
	return fmt.Errorf("%w: %v", ErrSendFailed, err)
}

// LogoutResultDTO - hasil POST /api/v1/admin/telegram/logout (pola
// LogoutResultDTO whatsapp). RemoteRevoked false berarti sesi lokal sudah
// bersih tetapi server tidak sempat dihubungi - admin perlu mencabut sesi
// manual dari aplikasi Telegram (Pengaturan > Perangkat).
type LogoutResultDTO struct {
	RemoteRevoked bool `json:"remoteRevoked"`
}

// Logout SELALU berhasil membersihkan sesi lokal (keputusan D2 whatsapp):
// RPC AuthLogOut dicoba dulu, tetapi DeleteSession dijalankan TANPA SYARAT
// apa pun hasil RPC-nya.
func (s *Service) Logout(ctx context.Context) (LogoutResultDTO, error) {
	remoteErr := s.client.Logout(ctx)
	if err := s.client.DeleteSession(); err != nil {
		return LogoutResultDTO{}, err
	}
	s.mu.Lock()
	s.loginPending, s.loginHash, s.loginError = false, "", ""
	s.lastConnectedAt, s.lastError = time.Time{}, ""
	s.mu.Unlock()
	return LogoutResultDTO{RemoteRevoked: remoteErr == nil}, nil
}

// --- konfigurasi template & status aktif ---

func (s *Service) GetConfig(ctx context.Context) (TelegramConfigDTO, error) {
	row, err := s.repo.GetConfig(ctx)
	if err != nil {
		return TelegramConfigDTO{}, err
	}
	return TelegramConfigDTO{
		MessageTemplate: row.MessageTemplate,
		InvitationTemplate: row.InvitationTemplate,
		IsEnabled:       row.IsEnabled,
	}, nil
}

func (s *Service) UpdateConfig(ctx context.Context, in TelegramConfigDTO) error {
	return s.repo.UpdateConfig(ctx, sqlc.UpdateTelegramConfigParams{
		MessageTemplate: in.MessageTemplate,
		InvitationTemplate: in.InvitationTemplate,
		IsEnabled:       in.IsEnabled,
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

func mapLogDTOs(rows []sqlc.TelegramSendLog) []SendLogDTO {
	out := make([]SendLogDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toLogDTO(r))
	}
	return out
}

func toLogDTO(r sqlc.TelegramSendLog) SendLogDTO {
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
		ID: r.ID, GuestID: r.GuestID, GuestName: r.GuestName, TelegramUsername: r.TelegramUsername,
		AttendingCount: int(r.AttendingCount), Status: string(r.Status),
		ErrorMessage: errMsg, SentAt: sentAt,
		CreatedAt: r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// Resend memakai data denormalisasi di log - TIDAK membaca tabel guests
// maupun invitation_content milik modul lain. retryCount = 0 DISENGAJA:
// tindakan manual admin memberi jatah retry BARU (whatsapp §5.3.1).
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
	return s.sendAndRecord(ctx, jobFromLog(row, 0), cfg)
}

// --- implementasi contracts.Sender ---

func (s *Service) SendQR(ctx context.Context, in contracts.SendTGInput) error {
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return err
	}
	logID, err := s.repo.InsertSendLog(ctx, sqlc.InsertSendLogParams{
		GuestID: in.GuestID, GuestName: in.GuestName, TelegramUsername: in.TelegramUsername, QrPayload: in.QRPayload,
		CoupleName: in.CoupleName, EventDateLabel: in.EventDateLabel, AttendingCount: uint8(in.AttendingCount),
		Status: sqlc.TelegramSendLogsStatusPending,
	})
	if err != nil {
		return err
	}
	return s.sendAndRecord(ctx, sendJob{
		logID:          uint64(logID),
		username:       in.TelegramUsername,
		guestName:      in.GuestName,
		qrPayload:      in.QRPayload,
		coupleName:     in.CoupleName,
		eventDateLabel: in.EventDateLabel,
		attendingCount: in.AttendingCount,
		retryCount:     0,
	}, cfg)
}

// --- undangan manual per tamu (tombol kirim di menu Tamu) ---

// Undangan manual adalah pesan TEKS dari invitation_template - BUKAN foto QR.
// Jalur ini SENGAJA tidak memakai sendAndRecord: tidak ada baris send_logs
// yang ditulis (undangan bukan QR), tidak ada antrean retry (admin menekan
// Kirim ulang bila gagal), dan is_enabled TIDAK digerbangi (sakelar itu hanya
// milik QR otomatis; pengiriman manual adalah tindakan admin yang eksplisit).
// Kegagalan koneksi dibalas langsung supaya tampil di modal, bukan
// dijadwalkan diam-diam.
func (s *Service) PreviewInvitation(ctx context.Context, in contracts.PreviewInvitationInput) (string, error) {
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(cfg.InvitationTemplate) == "" {
		return "", fmt.Errorf("%w: Template Pesan Undangan belum diisi di menu Telegram", ErrSendFailed)
	}
	return applyInvitationTemplate(cfg.InvitationTemplate, in.GuestName, in.CoupleName, in.EventDateLabel, in.Link), nil
}

func (s *Service) SendInvitation(ctx context.Context, in contracts.SendInvitationInput) error {
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		return err
	}
	if strings.TrimSpace(cfg.InvitationTemplate) == "" {
		return fmt.Errorf("%w: Template Pesan Undangan belum diisi di menu Telegram", ErrSendFailed)
	}
	username, ok := normalizeUsername(in.TelegramUsername)
	if !ok {
		return fmt.Errorf("%w: username Telegram kosong", ErrSendFailed)
	}
	// Gate yang sama dengan sendAndRecord, tetapi gagal di sini bersifat
	// final (tanpa scheduleRetry): admin melihat hasilnya seketika di modal
	// dan memutuskan sendiri kapan menekan Kirim lagi.
	if !s.client.HasStoredSession() {
		return fmt.Errorf("%w: Telegram belum tertaut", ErrSendFailed)
	}
	text := applyInvitationTemplate(cfg.InvitationTemplate, in.GuestName, in.CoupleName, in.EventDateLabel, in.Link)
	attemptCtx, cancel := context.WithTimeout(ctx, sendAttemptTimeout)
	defer cancel()
	if err := s.client.SendText(attemptCtx, username, text); err != nil {
		if after, ok := infrastructure.IsFloodWaitError(err); ok {
			s.noteDisturbance("dibatasi Telegram (flood wait)")
			return fmt.Errorf("%w: dibatasi Telegram, coba lagi dalam %s", ErrSendFailed, after.Round(time.Second))
		}
		if errors.Is(err, infrastructure.ErrNotAuthorized) {
			return fmt.Errorf("%w: sesi Telegram ditolak server, login ulang di menu Telegram", ErrSendFailed)
		}
		if errors.Is(err, infrastructure.ErrRecipientNotFound) {
			return fmt.Errorf("%w: username Telegram tidak ditemukan", ErrSendFailed)
		}
		return fmt.Errorf("%w: gagal kirim pesan: %s", ErrSendFailed, err.Error())
	}
	s.mu.Lock()
	s.lastConnectedAt, s.lastError = time.Now(), ""
	s.mu.Unlock()
	return nil
}

// sendJob adalah satu pekerjaan kirim yang LENGKAP SENDIRI: seluruh isinya
// snapshot dari baris telegram_send_logs, sehingga modul ini tidak pernah
// perlu membaca tabel milik modul lain (pola sendJob whatsapp).
type sendJob struct {
	logID          uint64
	username       string
	guestName      string
	qrPayload      string
	coupleName     string
	eventDateLabel string
	attendingCount int
	// retryCount jumlah percobaan yang SUDAH tercatat pada baris log.
	retryCount int
}

// jobFromLog menyusun sendJob dari baris log - dipakai Resend & retryWorker.
func jobFromLog(row sqlc.TelegramSendLog, retryCount int) sendJob {
	return sendJob{
		logID:          row.ID,
		username:       row.TelegramUsername,
		guestName:      row.GuestName,
		qrPayload:      row.QrPayload,
		coupleName:     row.CoupleName,
		eventDateLabel: row.EventDateLabel,
		attendingCount: int(row.AttendingCount),
		retryCount:     retryCount,
	}
}

// sendAndRecord dipakai bersama oleh SendQR, Resend, dan retryWorker supaya
// ketiganya menjalankan alur kirim yang identik.
//
// Klasifikasi kegagalan mengikat tabel §5.3.2 whatsapp-connection-resilience:
// hanya gangguan koneksi/pacing yang masuk antrian retry; username kosong,
// pengiriman yang dinonaktifkan, sesi yang belum tertaut, username tak dikenal,
// dan error tak dikenal difinalkan permanen.
func (s *Service) sendAndRecord(ctx context.Context, job sendJob, cfg sqlc.TelegramConfig) error {
	failPermanent := func(reason string) error {
		if logErr := s.finalizeLog(ctx, job.logID, false, reason); logErr != nil {
			return logErr
		}
		return fmt.Errorf("%w: %s", ErrSendFailed, reason)
	}
	failRetryable := func(reason string, after time.Duration) error {
		if err := s.scheduleRetry(ctx, job.logID, job.retryCount, reason, after); err != nil {
			return err
		}
		return fmt.Errorf("%w: %s", ErrSendFailed, reason)
	}

	if !cfg.IsEnabled {
		return failPermanent("pengiriman dinonaktifkan")
	}
	username, ok := normalizeUsername(job.username)
	if !ok {
		return failPermanent("username Telegram kosong")
	}
	// Gate KEJUJURAN (akar masalah §2.1 whatsapp): tanpa file sesi berarti
	// belum pernah login - permanen, menunggu tidak membantu. Dengan file
	// sesi, kegagalan otorisasi di dalam SendPhoto berarti sesi dicabut
	// (juga permanen: hanya login ulang admin yang memulihkan).
	if !s.client.HasStoredSession() {
		return failPermanent("Telegram belum tertaut")
	}
	png, err := renderQRPNG(job.qrPayload)
	if err != nil {
		return failPermanent("gagal membuat QR: " + err.Error())
	}
	attemptCtx, cancel := context.WithTimeout(ctx, sendAttemptTimeout)
	defer cancel()
	caption := applyTemplate(cfg.MessageTemplate, job.guestName, job.attendingCount, job.coupleName, job.eventDateLabel)
	if err := s.client.SendPhoto(attemptCtx, username, png, caption); err != nil {
		if after, ok := infrastructure.IsFloodWaitError(err); ok {
			// FloodWait MEMAKSA jeda minimal dari server: hormati angkanya
			// bila melebihi backoff tabel, supaya retry berikutnya tidak
			// langsung kena pacing lagi.
			delay := nextRetryDelay(job.retryCount)
			if after > delay {
				delay = after
			}
			s.noteDisturbance("dibatasi Telegram (flood wait)")
			return failRetryable("dibatasi Telegram, dijadwalkan ulang: "+err.Error(), delay)
		}
		if classifySendError(err) {
			s.noteDisturbance(err.Error())
			return failRetryable("gagal kirim, dijadwalkan ulang: "+err.Error(), nextRetryDelay(job.retryCount))
		}
		return failPermanent("gagal kirim: " + err.Error())
	}
	s.mu.Lock()
	s.lastConnectedAt, s.lastError = time.Now(), ""
	s.mu.Unlock()
	return s.finalizeLog(ctx, job.logID, true, "")
}

// noteDisturbance mencatat gangguan terakhir untuk dashboard tanpa
// mengacaukan lastConnectedAt.
func (s *Service) noteDisturbance(reason string) {
	s.mu.Lock()
	s.lastError = reason
	s.mu.Unlock()
}

// classifySendError true = retryable. Default SENGAJA permanen
// (whatsapp §5.3.2): salah menandai permanen hanya berujung satu baris failed
// yang bisa dikirim ulang manual, sedangkan salah menandai retryable bisa
// berujung pesan ganda ke tamu.
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
	return false
}

// nextRetryDelay retryCount -> backoff menurut tabel. Fungsi murni agar
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

// scheduleRetry menjadwalkan percobaan ulang dengan jeda eksplisit, atau
// memfinalkan failed bila jatah habis (retryCount+1 > maxRetry). retry_count
// ditulis ABSOLUT (retryCount+1), bukan increment relatif (whatsapp §5.3.1).
func (s *Service) scheduleRetry(ctx context.Context, logID uint64, retryCount int, reason string, after time.Duration) error {
	if retryCount+1 > maxRetry {
		return s.finalizeLog(ctx, logID, false, reason)
	}
	wctx, cancel := bookkeeping(ctx)
	defer cancel()
	return s.repo.ScheduleSendLogRetry(wctx, sqlc.ScheduleSendLogRetryParams{
		ErrorMessage: sql.NullString{String: reason, Valid: true},
		RetryCount:   uint8(retryCount + 1),
		NextRetryAt:  sql.NullTime{Time: time.Now().Add(after), Valid: true},
		ID:           logID,
	})
}

func (s *Service) finalizeLog(ctx context.Context, logID uint64, success bool, reason string) error {
	status := sqlc.TelegramSendLogsStatusFailed
	var sentAt sql.NullTime
	var errMsg sql.NullString
	if success {
		status = sqlc.TelegramSendLogsStatusSent
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

// retryWorker mengerjakan antrian retry: tiap retryTickInterval ia menyapu
// pending basi, membaca GetConfig SEKALI per tick (bukan per baris), lalu
// mengirim maksimal retryBatchSize baris jatuh tempo SECARA BERURUTAN
// (paralel berisiko pacing hingga FloodWait - justru yang ingin dihindari
// modul ini).
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
	if err := s.repo.ReapStalePendingSendLogs(ctx, sqlc.ReapStalePendingSendLogsParams{
		NextRetryAt: sql.NullTime{Time: now, Valid: true},
		CreatedAt:   now.Add(-stalePendingAfter),
	}); err != nil {
		log.Printf("telegram: worker retry gagal menyapu pending basi: %v", err)
	}
	cfg, err := s.repo.GetConfig(ctx)
	if err != nil {
		log.Printf("telegram: worker retry gagal membaca config: %v", err)
		return
	}
	if !cfg.IsEnabled {
		return
	}
	if !s.client.HasStoredSession() {
		return
	}
	rows, err := s.repo.ListRetryableSendLogs(ctx, sqlc.ListRetryableSendLogsParams{
		NextRetryAt: sql.NullTime{Time: now, Valid: true},
		Limit:       retryBatchSize,
	})
	if err != nil {
		log.Printf("telegram: worker retry gagal membaca antrian: %v", err)
		return
	}
	for _, row := range rows {
		if !s.client.HasStoredSession() {
			return
		}
		if err := s.sendAndRecord(ctx, jobFromLog(row, int(row.RetryCount)), cfg); err != nil {
			log.Printf("telegram: retry log %d gagal: %v", row.ID, err)
		}
	}
}

// --- helper murni, diuji tanpa koneksi Telegram/DB ---

// telegramUsernameRe KEMBAR dengan aturan di guest (service.go
// telegramUsernameRe): browser/backend guest tidak bisa memanggil konstanta
// Go modul ini, dan modul ini tidak boleh mengimpor internal modul guest -
// jadi aturannya diketik ulang di sini. Mengubah salah satu saja membuat
// validasi form dan pengiriman tidak sepakat tentang username yang sah.
var telegramUsernameRe = regexp.MustCompile(`^[a-z0-9_]{5,32}$`)

// normalizeUsername memvalidasi ulang username dari snapshot log. Beda dari
// normalizeTelegramUsername milik guest (yang melembutkan input admin):
// yang di sini hanya penjaga terakhir - snapshot SEHARUSNYA sudah kanonis,
// dan yang tidak lolos berarti data rusak.
func normalizeUsername(s string) (string, bool) {
	u := strings.ToLower(strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(s), "@")))
	if u == "" {
		return "", false
	}
	if !telegramUsernameRe.MatchString(u) {
		return "", false
	}
	return u, true
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

// applyInvitationTemplate me-render invitation_template. Placeholder TANPA
// {jumlah} (K5 og-share-image-dinamis): saat undangan dikirim tamu belum
// RSVP, jadi angka hadir selalu menyesatkan. Placeholder tak dikenal dibiarkan
// utuh supaya admin melihat kesalahannya di preview.
func applyInvitationTemplate(tpl, guestName, coupleName, eventDateLabel, link string) string {
	r := strings.NewReplacer(
		"{nama}", guestName,
		"{mempelai}", coupleName,
		"{tanggal}", eventDateLabel,
		"{link}", link,
	)
	return r.Replace(tpl)
}

func renderQRPNG(payload string) ([]byte, error) {
	return qrcode.Encode(payload, qrcode.Medium, 512)
}

// StatusHTTPCode memetakan error domain ke status HTTP - dipakai presentation.
func StatusHTTPCode(err error) int {
	switch {
	case errors.Is(err, ErrLogNotFound):
		return 404
	case errors.Is(err, ErrSendFailed), errors.Is(err, ErrNotPaired),
		errors.Is(err, ErrAlreadyLoggedIn), errors.Is(err, ErrCodeInvalid),
		errors.Is(err, ErrPasswordNeeded), errors.Is(err, ErrNoLoginPending):
		return 400
	default:
		return 500
	}
}
