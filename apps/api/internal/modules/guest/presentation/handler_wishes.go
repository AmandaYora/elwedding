package presentation

import (
	"net/http"
	"strconv"

	"undangan-digital/internal/shared/pagination"
	"undangan-digital/internal/shared/response"
)

// Handler ucapan tamu (docs/plan/wedding-wish/PLAN.md T11). Berkas TERPISAH
// dari handler.go, tapi method pada Handler yang sama - writeServiceError,
// decodeJSON, pagination, dan response dipakai ulang, bukan didefinisikan
// ulang di sini.

// --- publik: kirim & daftar ucapan (token tamu, bukan JWT admin) ---

func (h *Handler) SubmitWish(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	var body struct {
		Message string `json:"message"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if err := h.service.SubmitWish(r.Context(), token, body.Message); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Wish submitted successfully", nil)
}

func (h *Handler) ListPublicWishes(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	wishes, err := h.service.ListPublicWishes(r.Context(), token)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Wishes retrieved successfully", wishes)
}

// --- admin: kelola ucapan (dijaga RequireFullAdmin lewat mux admin) ---

func (h *Handler) ListWishesAdmin(w http.ResponseWriter, r *http.Request) {
	p := pagination.Parse(r)
	wishes, total, err := h.service.ListWishesAdmin(r.Context(), p)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OKPaginated(w, "Wishes retrieved successfully", wishes, pagination.Meta(p, total))
}

func (h *Handler) SetWishHidden(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	var body struct {
		Hidden bool `json:"hidden"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if err := h.service.SetWishHidden(r.Context(), id, body.Hidden); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Wish updated successfully", nil)
}

func (h *Handler) DeleteWish(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	if err := h.service.DeleteWish(r.Context(), id); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Wish deleted successfully", nil)
}
