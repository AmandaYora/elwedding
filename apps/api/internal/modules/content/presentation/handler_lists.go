package presentation

import (
	"net/http"
	"strconv"

	"undangan-ariana-adrian/internal/modules/content/application"
	"undangan-ariana-adrian/internal/shared/response"
)

func pathID(r *http.Request) (uint64, bool) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	return id, err == nil
}

// --- agenda_events ---

func (h *Handler) ListAgendaEvents(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListAgendaEvents(r.Context())
	if err != nil {
		response.Internal(w, "Failed to load agenda events")
		return
	}
	response.OK(w, "Agenda events retrieved successfully", list)
}

func (h *Handler) CreateAgendaEvent(w http.ResponseWriter, r *http.Request) {
	var in application.AgendaEventInput
	if !decodeJSON(w, r, &in) {
		return
	}
	id, err := h.service.CreateAgendaEvent(r.Context(), in)
	if err != nil {
		response.BadRequest(w, "Failed to create agenda event", nil)
		return
	}
	response.Created(w, "Agenda event created successfully", map[string]int64{"id": id})
}

func (h *Handler) UpdateAgendaEvent(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	var in application.AgendaEventInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.UpdateAgendaEvent(r.Context(), id, in); err != nil {
		response.BadRequest(w, "Failed to update agenda event", nil)
		return
	}
	response.OK(w, "Agenda event updated successfully", nil)
}

func (h *Handler) DeleteAgendaEvent(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	if err := h.service.DeleteAgendaEvent(r.Context(), id); err != nil {
		response.Internal(w, "Failed to delete agenda event")
		return
	}
	response.OK(w, "Agenda event deleted successfully", nil)
}

// --- rundown_items ---

func (h *Handler) ListRundownItems(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListRundownItems(r.Context())
	if err != nil {
		response.Internal(w, "Failed to load rundown items")
		return
	}
	response.OK(w, "Rundown items retrieved successfully", list)
}

func (h *Handler) CreateRundownItem(w http.ResponseWriter, r *http.Request) {
	var in application.RundownItemInput
	if !decodeJSON(w, r, &in) {
		return
	}
	id, err := h.service.CreateRundownItem(r.Context(), in)
	if err != nil {
		response.BadRequest(w, "Failed to create rundown item", nil)
		return
	}
	response.Created(w, "Rundown item created successfully", map[string]int64{"id": id})
}

func (h *Handler) UpdateRundownItem(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	var in application.RundownItemInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.UpdateRundownItem(r.Context(), id, in); err != nil {
		response.BadRequest(w, "Failed to update rundown item", nil)
		return
	}
	response.OK(w, "Rundown item updated successfully", nil)
}

func (h *Handler) DeleteRundownItem(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	if err := h.service.DeleteRundownItem(r.Context(), id); err != nil {
		response.Internal(w, "Failed to delete rundown item")
		return
	}
	response.OK(w, "Rundown item deleted successfully", nil)
}

// --- gallery_photos ---

func (h *Handler) ListGalleryPhotos(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListGalleryPhotos(r.Context())
	if err != nil {
		response.Internal(w, "Failed to load gallery photos")
		return
	}
	response.OK(w, "Gallery photos retrieved successfully", list)
}

func (h *Handler) CreateGalleryPhoto(w http.ResponseWriter, r *http.Request) {
	var in application.GalleryPhotoInput
	if !decodeJSON(w, r, &in) {
		return
	}
	id, err := h.service.CreateGalleryPhoto(r.Context(), in)
	if err != nil {
		response.BadRequest(w, "Failed to create gallery photo", nil)
		return
	}
	response.Created(w, "Gallery photo created successfully", map[string]int64{"id": id})
}

func (h *Handler) UpdateGalleryPhoto(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	var in application.GalleryPhotoInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.UpdateGalleryPhoto(r.Context(), id, in); err != nil {
		response.BadRequest(w, "Failed to update gallery photo", nil)
		return
	}
	response.OK(w, "Gallery photo updated successfully", nil)
}

func (h *Handler) DeleteGalleryPhoto(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	if err := h.service.DeleteGalleryPhoto(r.Context(), id); err != nil {
		response.Internal(w, "Failed to delete gallery photo")
		return
	}
	response.OK(w, "Gallery photo deleted successfully", nil)
}

// --- love_story_chapters ---

func (h *Handler) ListLoveStoryChapters(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListLoveStoryChapters(r.Context())
	if err != nil {
		response.Internal(w, "Failed to load love story chapters")
		return
	}
	response.OK(w, "Love story chapters retrieved successfully", list)
}

func (h *Handler) CreateLoveStoryChapter(w http.ResponseWriter, r *http.Request) {
	var in application.LoveStoryChapterInput
	if !decodeJSON(w, r, &in) {
		return
	}
	id, err := h.service.CreateLoveStoryChapter(r.Context(), in)
	if err != nil {
		response.BadRequest(w, "Failed to create love story chapter", nil)
		return
	}
	response.Created(w, "Love story chapter created successfully", map[string]int64{"id": id})
}

func (h *Handler) UpdateLoveStoryChapter(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	var in application.LoveStoryChapterInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.UpdateLoveStoryChapter(r.Context(), id, in); err != nil {
		response.BadRequest(w, "Failed to update love story chapter", nil)
		return
	}
	response.OK(w, "Love story chapter updated successfully", nil)
}

func (h *Handler) DeleteLoveStoryChapter(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	if err := h.service.DeleteLoveStoryChapter(r.Context(), id); err != nil {
		response.Internal(w, "Failed to delete love story chapter")
		return
	}
	response.OK(w, "Love story chapter deleted successfully", nil)
}

// --- wedding_gift_banks ---

func (h *Handler) ListWeddingGiftBanks(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListWeddingGiftBanks(r.Context())
	if err != nil {
		response.Internal(w, "Failed to load gift banks")
		return
	}
	response.OK(w, "Gift banks retrieved successfully", list)
}

func (h *Handler) CreateWeddingGiftBank(w http.ResponseWriter, r *http.Request) {
	var in application.WeddingGiftBankInput
	if !decodeJSON(w, r, &in) {
		return
	}
	id, err := h.service.CreateWeddingGiftBank(r.Context(), in)
	if err != nil {
		response.BadRequest(w, "Failed to create gift bank", nil)
		return
	}
	response.Created(w, "Gift bank created successfully", map[string]int64{"id": id})
}

func (h *Handler) UpdateWeddingGiftBank(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	var in application.WeddingGiftBankInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if err := h.service.UpdateWeddingGiftBank(r.Context(), id, in); err != nil {
		response.BadRequest(w, "Failed to update gift bank", nil)
		return
	}
	response.OK(w, "Gift bank updated successfully", nil)
}

func (h *Handler) DeleteWeddingGiftBank(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		response.BadRequest(w, "Invalid id", nil)
		return
	}
	if err := h.service.DeleteWeddingGiftBank(r.Context(), id); err != nil {
		response.Internal(w, "Failed to delete gift bank")
		return
	}
	response.OK(w, "Gift bank deleted successfully", nil)
}
