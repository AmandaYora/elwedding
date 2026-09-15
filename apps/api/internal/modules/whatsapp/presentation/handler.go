package presentation

import (
	"encoding/json"
	"net/http"
	"strconv"

	"undangan-digital/internal/modules/whatsapp/application"
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

// unavailable adalah penjaga MODUL MATI (bukan sekadar cek defensif).
//
// main.go SENGAJA melanjutkan boot ketika whatsapp.New gagal - misalnya
// WA_STORE_DIR tidak bisa ditulis atau berkas SQLite sesinya rusak - supaya
// RSVP tetap berjalan tanpa kirim QR otomatis. Yang dikembalikannya saat itu
// adalah handler NIL, dan router tetap mendaftarkan seluruh route
// /api/v1/admin/whatsapp/* dari nilai nil tersebut (mendaftarkan method value
// dari pointer nil sah di Go; yang panic adalah saat dipanggil). Tanpa
// penjaga ini, admin yang membuka menu WhatsApp menerima koneksi terputus
// karena nil pointer dereference, bukan pesan yang bisa dibaca - degradasi
// yang dirancang main.go justru berubah jadi crash per request.
//
// Penerimanya boleh nil: method di bawah TIDAK mendereferensi h sebelum
// perbandingan ini selesai.
func (h *Handler) unavailable(w http.ResponseWriter) bool {
	if h != nil && h.service != nil {
		return false
	}
	response.Error(w, http.StatusServiceUnavailable,
		"Modul WhatsApp tidak aktif di server ini. Periksa WA_STORE_DIR lalu jalankan ulang API.", nil)
	return true
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	response.OK(w, "WhatsApp status retrieved successfully", h.service.Status(r.Context()))
}

func (h *Handler) StartPairing(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	if err := h.service.StartPairing(r.Context()); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Pairing started successfully", nil)
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
	// Keputusan D2: sesi lokal SELALU bersih pada titik ini. Bila server
	// WhatsApp tidak sempat dihubungi (socket mati), katakan dengan jujur
	// supaya admin menghapus perangkat manual di HP-nya.
	if result.RemoteRevoked {
		response.OK(w, "Logged out successfully", result)
		return
	}
	response.OK(w, "Koneksi lokal diputus, tetapi perangkat mungkin masih terdaftar di HP. Hapus manual lewat WhatsApp > Perangkat Tertaut bila masih muncul di sana.", result)
}

// Reconnect pemulihan manual oleh admin (keputusan D4) - muncul sebagai
// tombol "Sambungkan Ulang" saat tertaut tetapi terputus.
func (h *Handler) Reconnect(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	if err := h.service.Reconnect(r.Context()); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Reconnected successfully", nil)
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
	response.OK(w, "WhatsApp config retrieved successfully", cfg)
}

func (h *Handler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	if h.unavailable(w) {
		return
	}
	var in application.WhatsAppConfigDTO
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.UpdateConfig(r.Context(), in); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "WhatsApp config updated successfully", nil)
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
