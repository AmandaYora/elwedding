package presentation

import (
	"net/http"
	"strconv"

	"undangan-digital/internal/modules/guest/application"
	"undangan-digital/internal/shared/pagination"
	"undangan-digital/internal/shared/response"
)

// --- admin: CRUD group tamu (docs/plan/guest-groups/PLAN.md T8) ---
//
// Keempatnya didaftarkan di mux `admin` di router.go, yang seluruhnya dijaga
// RequireFullAdmin - akun petugas gate MELIHAT group di hasil scan tapi tidak
// mengelolanya (D10). JANGAN memindahkannya ke mux root seperti checkin/*.
//
// decodeJSON, writeServiceError, pagination.Parse/Meta dan response.* dipakai
// ulang apa adanya dari handler.go - tidak ada mekanisme baru di sini.

// ListGroups menangani GET /api/v1/admin/groups. BERPAGINASI, jadi memakai
// response.OKPaginated + meta (api-standard.md).
func (h *Handler) ListGroups(w http.ResponseWriter, r *http.Request) {
	p := pagination.Parse(r)
	groups, total, err := h.service.ListGroups(r.Context(), p)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.OKPaginated(w, "Guest groups retrieved successfully", groups, pagination.Meta(p, total))
}

func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	var in application.GuestGroupInput
	if !decodeJSON(w, r, &in) {
		return
	}
	group, err := h.service.CreateGroup(r.Context(), in)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	response.Created(w, "Guest group created successfully", group)
}

func (h *Handler) UpdateGroup(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	var in application.GuestGroupInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.UpdateGroup(r.Context(), id, in); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Guest group updated successfully", nil)
}

// DeleteGroup membalas 400 dengan pesan yang MENYEBUT JUMLAH TAMU bila group
// masih dipakai (K4) - pesannya datang dari canDeleteGroup di service dan
// diteruskan apa adanya lewat writeServiceError, tidak ditulis ulang di sini
// maupun di frontend.
func (h *Handler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	if err := h.service.DeleteGroup(r.Context(), id); err != nil {
		writeServiceError(w, err)
		return
	}
	response.OK(w, "Guest group deleted successfully", nil)
}
