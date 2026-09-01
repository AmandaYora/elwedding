package presentation

import (
	"encoding/json"
	"net/http"
	"strconv"

	"undangan-ariana-adrian/internal/modules/guest/application"
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

// --- admin: CRUD tamu (fitur #4, #6 PLAN.md) ---

func (h *Handler) ListGuests(w http.ResponseWriter, r *http.Request) {
	p := pagination.Parse(r)
	status := r.URL.Query().Get("status")
	q := r.URL.Query().Get("q")
	invitationType := r.URL.Query().Get("invitation_type")
	souvenirType := r.URL.Query().Get("souvenir_type")
	respondedOnly := r.URL.Query().Get("responded") == "true"

	guests, total, err := h.service.List(r.Context(), status, q, invitationType, souvenirType, respondedOnly, p)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OKPaginated(w, "Guests retrieved successfully", guests, pagination.Meta(p, total))
}

// GetSummary menangani GET /api/v1/admin/guests/summary - halaman
// Ringkasan (admin-ui-redesign/PLAN.md keputusan #11).
func (h *Handler) GetSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.Summary(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Guest summary retrieved successfully", summary)
}

func (h *Handler) CreateGuest(w http.ResponseWriter, r *http.Request) {
	var in application.GuestInput
	if !decodeJSON(w, r, &in) {
		return
	}
	guest, err := h.service.Create(r.Context(), in)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.Created(w, "Guest created successfully", guest)
}

func (h *Handler) UpdateGuest(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	var in application.GuestInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.Update(r.Context(), id, in); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Guest updated successfully", nil)
}

func (h *Handler) DeleteGuest(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	if err := h.service.Delete(r.Context(), id); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Guest deleted successfully", nil)
}

// --- publik: resolve token & update RSVP (PLAN.md §5.4) ---

func (h *Handler) ResolveByToken(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	session, err := h.service.ResolveByToken(r.Context(), token)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Guest resolved successfully", session)
}

func (h *Handler) UpdateRsvpStatus(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	var body struct {
		Status         string `json:"status"`
		AttendingCount int    `json:"attendingCount"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	qrPayload, err := h.service.UpdateRsvpStatus(r.Context(), token, body.Status, body.AttendingCount)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "RSVP status updated successfully", map[string]string{"qrPayload": qrPayload})
}
