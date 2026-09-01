package presentation

import (
	"encoding/json"
	"net/http"
	"strconv"

	"undangan-ariana-adrian/internal/modules/whatsapp/application"
	"undangan-ariana-adrian/internal/shared/pagination"
	"undangan-ariana-adrian/internal/shared/response"
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

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	response.OK(w, "WhatsApp status retrieved successfully", h.service.Status(r.Context()))
}

func (h *Handler) StartPairing(w http.ResponseWriter, r *http.Request) {
	if err := h.service.StartPairing(r.Context()); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Pairing started successfully", nil)
}

func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Logout(r.Context()); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Logged out successfully", nil)
}

func (h *Handler) GetConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := h.service.GetConfig(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "WhatsApp config retrieved successfully", cfg)
}

func (h *Handler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
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
	p := pagination.Parse(r)
	logs, total, err := h.service.ListLogs(r.Context(), p)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OKPaginated(w, "Send logs retrieved successfully", logs, pagination.Meta(p, total))
}

func (h *Handler) ResendLog(w http.ResponseWriter, r *http.Request) {
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
