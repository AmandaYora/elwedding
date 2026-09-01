package application

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/skip2/go-qrcode"

	"undangan-ariana-adrian/internal/modules/whatsapp/contracts"
	"undangan-ariana-adrian/internal/modules/whatsapp/infrastructure"
	"undangan-ariana-adrian/internal/modules/whatsapp/infrastructure/sqlc"
	"undangan-ariana-adrian/internal/shared/pagination"
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
)

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
}

func NewService(repo *infrastructure.Repository, client *infrastructure.WAClient) *Service {
	s := &Service{repo: repo, client: client}
	// Reconnect otomatis saat boot bila sesi sudah pernah tertaut sebelumnya
	// - dijalankan di goroutine terpisah supaya boot API tidak menunggu
	// koneksi WhatsApp (yang bisa lambat/gagal karena jaringan).
	if client.HasStoredSession() {
		go func() {
			if err := client.Connect(); err != nil {
				log.Printf("whatsapp: gagal reconnect otomatis: %v", err)
			}
		}()
	}
	return s
}

// --- status & pairing (§6.4) ---

func (s *Service) Status(ctx context.Context) WhatsAppStatusDTO {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return WhatsAppStatusDTO{
		LoggedIn:     s.client.IsLoggedIn(),
		Pairing:      s.pairing,
		PairingQR:    s.pairingQR,
		PairingError: s.pairingError,
	}
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

func (s *Service) Logout(ctx context.Context) error {
	return s.client.Logout(ctx)
}

// --- konfigurasi template & status aktif (keputusan #20) ---

func (s *Service) GetConfig(ctx context.Context) (WhatsAppConfigDTO, error) {
	row, err := s.repo.GetConfig(ctx)
	if err != nil {
		return WhatsAppConfigDTO{}, err
	}
	return WhatsAppConfigDTO{MessageTemplate: row.MessageTemplate, IsEnabled: row.IsEnabled}, nil
}

func (s *Service) UpdateConfig(ctx context.Context, in WhatsAppConfigDTO) error {
	return s.repo.UpdateConfig(ctx, sqlc.UpdateWhatsAppConfigParams{
		MessageTemplate: in.MessageTemplate,
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
// tabel guests maupun invitation_content milik modul lain.
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
	return s.sendAndRecord(ctx, row.ID, row.Phone, row.GuestName, row.QrPayload, row.CoupleName, row.EventDateLabel, int(row.AttendingCount), cfg)
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
	return s.sendAndRecord(ctx, uint64(logID), in.Phone, in.GuestName, in.QRPayload, in.CoupleName, in.EventDateLabel, in.AttendingCount, cfg)
}

// sendAndRecord dipakai bersama oleh SendQR & Resend supaya keduanya
// menjalankan alur kirim yang identik (PLAN.md §9.4 catatan Resend).
func (s *Service) sendAndRecord(ctx context.Context, logID uint64, phone, guestName, qrPayload, coupleName, eventDateLabel string, attendingCount int, cfg sqlc.WhatsappConfig) error {
	fail := func(reason string) error {
		if logErr := s.finalizeLog(ctx, logID, false, reason); logErr != nil {
			return logErr
		}
		return fmt.Errorf("%w: %s", ErrSendFailed, reason)
	}

	// Keputusan #20: is_enabled dicek lebih dulu - client WhatsApp TIDAK
	// dipanggil sama sekali bila dinonaktifkan.
	if !cfg.IsEnabled {
		return fail("pengiriman dinonaktifkan")
	}
	normalized, ok := normalizePhone(phone)
	if !ok {
		return fail("nomor telepon kosong")
	}
	if !s.client.IsLoggedIn() {
		return fail("WhatsApp belum tertaut")
	}
	png, err := renderQRPNG(qrPayload)
	if err != nil {
		return fail("gagal membuat QR: " + err.Error())
	}
	upload, err := s.client.UploadImage(ctx, png)
	if err != nil {
		return fail("gagal unggah gambar: " + err.Error())
	}
	caption := applyTemplate(cfg.MessageTemplate, guestName, attendingCount, coupleName, eventDateLabel)
	if err := s.client.SendImageMessage(ctx, normalized, caption, upload); err != nil {
		return fail("gagal kirim pesan: " + err.Error())
	}
	return s.finalizeLog(ctx, logID, true, "")
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
	return s.repo.UpdateSendLogStatus(ctx, sqlc.UpdateSendLogStatusParams{
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
func StatusHTTPCode(err error) int {
	switch {
	case errors.Is(err, ErrLogNotFound):
		return 404
	case errors.Is(err, ErrPairingInProgress), errors.Is(err, ErrAlreadyLoggedIn), errors.Is(err, ErrSendFailed):
		return 400
	default:
		return 500
	}
}
