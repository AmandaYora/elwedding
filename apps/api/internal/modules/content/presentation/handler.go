package presentation

import (
	"encoding/json"
	"log"
	"net/http"

	"undangan-ariana-adrian/internal/modules/content/application"
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

// GetPublicInvitation menangani GET /api/v1/public/invitation - endpoint
// paling sering dipanggil (setiap tamu yang membuka undangan), lihat
// PLAN.md §3: diberi Cache-Control agar tidak membebani DB pada trafik tinggi.
func (h *Handler) GetPublicInvitation(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.BuildPublicInvitation(r.Context())
	if err != nil {
		response.Internal(w, "Failed to load invitation")
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=60")
	response.OK(w, "Invitation retrieved successfully", dto)
}

// --- invitation_content (admin, singleton) ---

func (h *Handler) GetContent(w http.ResponseWriter, r *http.Request) {
	dto, err := h.service.GetContent(r.Context())
	if err != nil {
		response.Internal(w, "Failed to load content")
		return
	}
	response.OK(w, "Content retrieved successfully", dto)
}

func (h *Handler) UpdateContent(w http.ResponseWriter, r *http.Request) {
	var in application.UpdateInvitationContentInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.UpdateContent(r.Context(), in); err != nil {
		log.Printf("update content failed: weddingDate=%q err=%v", in.WeddingDate, err)
		response.BadRequest(w, err.Error(), nil)
		return
	}
	response.OK(w, "Content updated successfully", nil)
}

// --- sections (fitur #2/#3) ---

func (h *Handler) ListSections(w http.ResponseWriter, r *http.Request) {
	sections, err := h.service.ListSectionsAdmin(r.Context())
	if err != nil {
		response.Internal(w, "Failed to load sections")
		return
	}
	response.OK(w, "Sections retrieved successfully", sections)
}

func (h *Handler) UpdateSections(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Updates []application.SectionUpdateInput `json:"updates"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}
	if err := h.service.UpdateSections(r.Context(), body.Updates); err != nil {
		response.BadRequest(w, "Failed to update sections", nil)
		return
	}
	response.OK(w, "Sections updated successfully", nil)
}

// --- upload foto/musik ---

const maxUploadSize = 10 << 20 // 10 MB

func (h *Handler) UploadPhoto(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		// MaxBytesReader error -> 413, lainnya 400; pesan spesifik untuk UX
		if err.Error() == "http: request body too large" {
			response.Error(w, http.StatusRequestEntityTooLarge, "File terlalu besar (maks 10 MB)", nil)
		} else {
			response.BadRequest(w, "File terlalu besar atau form tidak valid", nil)
		}
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		response.BadRequest(w, "Missing file field", nil)
		return
	}
	defer file.Close()

	url, err := h.service.SaveUpload(r.Context(), header.Filename, file)
	if err != nil {
		if err == application.ErrUnsupportedFileType {
			response.Error(w, http.StatusUnsupportedMediaType, "Tipe file tidak didukung", nil)
			return
		}
		log.Printf("save upload failed: file=%q err=%v", header.Filename, err)
		response.Internal(w, "Gagal menyimpan file")
		return
	}

	response.Created(w, "File uploaded successfully", map[string]string{"url": url})
}
