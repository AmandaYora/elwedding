package presentation

import (
	"encoding/json"
	"net/http"
	"strconv"

	"undangan-digital/internal/modules/telegram/application"
	"undangan-digital/internal/shared/pagination"
	"undangan-digital/internal/shared/response"
)

type Handler struct {
	service *application.Service
}

func NewHandler(service *application.Service) *Handler {
	return &Handler{service: service}
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		response.BadRequest(w, "Invalid request body", nil)
		return false
	}
	return true
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch application.StatusHTTPCode(err) {
	case 404:
		response.NotFound(w, err.Error())
	case 400:
		response.BadRequest(w, err.Error(), nil)
	default:
		response.Internal(w, "")
	}
}

// unavailable adalah penjaga MODUL MATI (pola Handler.unavailable whatsapp):
// main.go SENGAJA melanjutkan boot ketika telegram.New gagal (mis. TG_API_ID
// belum diisi) supaya RSVP tetap berjalan tanpa kirim QR Telegram otomatis.
// Penerimanya boleh nil: method di bawah TIDAK mendereferensi h sebelum
// perbandingan ini selesai.
func (h *Handler) unavailable(w http.ResponseWriter) bool {
	if h != nil && h.service != nil {
		return false
	}
	response.Error(w, http.StatusServiceUnavailable,
		"Modul Telegram tidak aktif di server ini. Isi TG_API_ID/TG_API_HASH/TG_PHONE lalu jalankan ulang API.", nil)
	return true
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	response.OK(w, "Telegram status retrieved successfully", h.service.Status(r.Context()))
}

// StartLogin menangani POST /api/v1/admin/telegram/login/start - meminta
// Telegram mengirim kode OTP ke nomor HP akun userbot.
func (h *Handler) StartLogin(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	result, err := h.service.StartLogin(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Kode OTP dikirim ke nomor HP akun Telegram", result)
}

// CompleteLogin menangani POST /api/v1/admin/telegram/login/complete -
// menukar kode OTP (+ password 2FA bila dibutuhkan) jadi sesi.
func (h *Handler) CompleteLogin(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var in application.TelegramLoginCompleteInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.CompleteLogin(r.Context(), in.Code, in.Password); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Telegram tertaut", nil)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	result, err := h.service.Logout(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	// Keputusan D2 whatsapp: sesi lokal SELALU bersih pada titik ini. Bila
	// server Telegram tidak sempat dihubungi, katakan dengan jujur supaya
	// admin mencabut sesinya manual dari aplikasi Telegram.
	if result.RemoteRevoked {
		response.OK(w, "Logged out successfully", result)
		return
	}
	response.OK(w, "Koneksi lokal diputus, tetapi sesi mungkin masih terdaftar di akun. Cabut manual lewat Telegram > Pengaturan > Perangkat bila masih muncul di sana.", result)
}

func (h *Handler) GetConfig(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	cfg, err := h.service.GetConfig(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Telegram config retrieved successfully", cfg)
}

func (h *Handler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var in application.TelegramConfigDTO
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.UpdateConfig(r.Context(), in); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Telegram config updated successfully", nil)
}

func (h *Handler) ListLogs(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	p := pagination.Parse(r)
	logs, total, err := h.service.ListLogs(r.Context(), p)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OKPaginated(w, "Send logs retrieved successfully", logs, pagination.Meta(p, total))
}

func (h *Handler) ResendLog(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	if err := h.service.Resend(r.Context(), id); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Message resent successfully", nil)
}
