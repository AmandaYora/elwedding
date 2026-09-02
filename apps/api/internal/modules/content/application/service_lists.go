package application

import (
	"context"
	"errors"
	"strings"

	"undangan-ariana-adrian/internal/modules/content/infrastructure/sqlc"
)

func requireNonEmpty(v, field string) error {
	if strings.TrimSpace(v) == "" {
		return errors.New(field + " wajib diisi")
	}
	return nil
}

// --- agenda_events ---

func (s *Service) ListAgendaEvents(ctx context.Context) ([]AgendaEventDTO, error) {
	rows, err := s.repo.ListAgendaEvents(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]AgendaEventDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, AgendaEventDTO{
			ID: r.ID, EventLabel: r.EventLabel, TimeLabel: r.TimeLabel,
			VenueName: r.VenueName, VenueAddress: nullStr(r.VenueAddress),
			City: r.City, MapsUrl: r.MapsUrl, SortOrder: r.SortOrder,
		})
	}
	return out, nil
}

func (s *Service) CreateAgendaEvent(ctx context.Context, in AgendaEventInput) (int64, error) {
	if err := requireNonEmpty(in.EventLabel, "eventLabel"); err != nil {
		return 0, err
	}
	if err := requireNonEmpty(in.VenueName, "venueName"); err != nil {
		return 0, err
	}
	rows, err := s.repo.ListAgendaEvents(ctx)
	if err != nil {
		return 0, err
	}
	next := int32(1)
	for _, r := range rows {
		if r.SortOrder >= next {
			next = r.SortOrder + 1
		}
	}
	return s.repo.CreateAgendaEvent(ctx, sqlc.CreateAgendaEventParams{
		EventLabel: in.EventLabel, TimeLabel: in.TimeLabel, VenueName: in.VenueName,
		VenueAddress: toNullStr(in.VenueAddress), City: in.City, MapsUrl: in.MapsUrl, SortOrder: next,
	})
}

func (s *Service) UpdateAgendaEvent(ctx context.Context, id uint64, in AgendaEventInput) error {
	if err := requireNonEmpty(in.EventLabel, "eventLabel"); err != nil {
		return err
	}
	if err := requireNonEmpty(in.VenueName, "venueName"); err != nil {
		return err
	}
	return s.repo.UpdateAgendaEvent(ctx, sqlc.UpdateAgendaEventParams{
		EventLabel: in.EventLabel, TimeLabel: in.TimeLabel, VenueName: in.VenueName,
		VenueAddress: toNullStr(in.VenueAddress), City: in.City, MapsUrl: in.MapsUrl, SortOrder: in.SortOrder, ID: id,
	})
}

func (s *Service) DeleteAgendaEvent(ctx context.Context, id uint64) error {
	return s.repo.DeleteAgendaEvent(ctx, id)
}

// --- rundown_items ---

func (s *Service) ListRundownItems(ctx context.Context) ([]RundownItemDTO, error) {
	rows, err := s.repo.ListRundownItems(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]RundownItemDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, RundownItemDTO{
			ID: r.ID, GroupLabel: r.GroupLabel, TimeLabel: r.TimeLabel,
			ActivityText: r.ActivityText, SortOrder: r.SortOrder,
		})
	}
	return out, nil
}

func (s *Service) CreateRundownItem(ctx context.Context, in RundownItemInput) (int64, error) {
	if err := requireNonEmpty(in.ActivityText, "activityText"); err != nil {
		return 0, err
	}
	rows, err := s.repo.ListRundownItems(ctx)
	if err != nil {
		return 0, err
	}
	next := int32(1)
	for _, r := range rows {
		if r.SortOrder >= next {
			next = r.SortOrder + 1
		}
	}
	return s.repo.CreateRundownItem(ctx, sqlc.CreateRundownItemParams{
		GroupLabel: in.GroupLabel, TimeLabel: in.TimeLabel, ActivityText: in.ActivityText, SortOrder: next,
	})
}

func (s *Service) UpdateRundownItem(ctx context.Context, id uint64, in RundownItemInput) error {
	if err := requireNonEmpty(in.ActivityText, "activityText"); err != nil {
		return err
	}
	return s.repo.UpdateRundownItem(ctx, sqlc.UpdateRundownItemParams{
		GroupLabel: in.GroupLabel, TimeLabel: in.TimeLabel, ActivityText: in.ActivityText, SortOrder: in.SortOrder, ID: id,
	})
}

func (s *Service) DeleteRundownItem(ctx context.Context, id uint64) error {
	return s.repo.DeleteRundownItem(ctx, id)
}

// --- gallery_photos ---

func (s *Service) ListGalleryPhotos(ctx context.Context) ([]GalleryPhotoDTO, error) {
	rows, err := s.repo.ListGalleryPhotos(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]GalleryPhotoDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, GalleryPhotoDTO{ID: r.ID, PhotoUrl: r.PhotoUrl, ThumbUrl: r.ThumbUrl, SortOrder: r.SortOrder})
	}
	return out, nil
}

func (s *Service) CreateGalleryPhoto(ctx context.Context, in GalleryPhotoInput) (int64, error) {
	if err := requireNonEmpty(in.PhotoUrl, "photoUrl"); err != nil {
		return 0, err
	}
	if err := requireNonEmpty(in.ThumbUrl, "thumbUrl"); err != nil {
		return 0, err
	}
	rows, err := s.repo.ListGalleryPhotos(ctx)
	if err != nil {
		return 0, err
	}
	next := int32(1)
	for _, r := range rows {
		if r.SortOrder >= next {
			next = r.SortOrder + 1
		}
	}
	return s.repo.CreateGalleryPhoto(ctx, sqlc.CreateGalleryPhotoParams{
		PhotoUrl: in.PhotoUrl, ThumbUrl: in.ThumbUrl, SortOrder: next,
	})
}

func (s *Service) UpdateGalleryPhoto(ctx context.Context, id uint64, in GalleryPhotoInput) error {
	if err := requireNonEmpty(in.PhotoUrl, "photoUrl"); err != nil {
		return err
	}
	if err := requireNonEmpty(in.ThumbUrl, "thumbUrl"); err != nil {
		return err
	}
	return s.repo.UpdateGalleryPhoto(ctx, sqlc.UpdateGalleryPhotoParams{
		PhotoUrl: in.PhotoUrl, ThumbUrl: in.ThumbUrl, SortOrder: in.SortOrder, ID: id,
	})
}

func (s *Service) DeleteGalleryPhoto(ctx context.Context, id uint64) error {
	return s.repo.DeleteGalleryPhoto(ctx, id)
}

// --- love_story_chapters ---

func (s *Service) ListLoveStoryChapters(ctx context.Context) ([]LoveStoryChapterDTO, error) {
	rows, err := s.repo.ListLoveStoryChapters(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]LoveStoryChapterDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, LoveStoryChapterDTO{
			ID: r.ID, PhotoUrl: r.PhotoUrl, Title: r.Title, Caption: nullStr(r.Caption), SortOrder: r.SortOrder,
		})
	}
	return out, nil
}

func (s *Service) CreateLoveStoryChapter(ctx context.Context, in LoveStoryChapterInput) (int64, error) {
	if err := requireNonEmpty(in.Title, "title"); err != nil {
		return 0, err
	}
	if err := requireNonEmpty(in.PhotoUrl, "photoUrl"); err != nil {
		return 0, err
	}
	rows, err := s.repo.ListLoveStoryChapters(ctx)
	if err != nil {
		return 0, err
	}
	next := int32(1)
	for _, r := range rows {
		if r.SortOrder >= next {
			next = r.SortOrder + 1
		}
	}
	return s.repo.CreateLoveStoryChapter(ctx, sqlc.CreateLoveStoryChapterParams{
		PhotoUrl: in.PhotoUrl, Title: in.Title, Caption: toNullStr(in.Caption), SortOrder: next,
	})
}

func (s *Service) UpdateLoveStoryChapter(ctx context.Context, id uint64, in LoveStoryChapterInput) error {
	if err := requireNonEmpty(in.Title, "title"); err != nil {
		return err
	}
	if err := requireNonEmpty(in.PhotoUrl, "photoUrl"); err != nil {
		return err
	}
	return s.repo.UpdateLoveStoryChapter(ctx, sqlc.UpdateLoveStoryChapterParams{
		PhotoUrl: in.PhotoUrl, Title: in.Title, Caption: toNullStr(in.Caption), SortOrder: in.SortOrder, ID: id,
	})
}

func (s *Service) DeleteLoveStoryChapter(ctx context.Context, id uint64) error {
	return s.repo.DeleteLoveStoryChapter(ctx, id)
}

// --- wedding_gift_banks ---

func (s *Service) ListWeddingGiftBanks(ctx context.Context) ([]WeddingGiftBankDTO, error) {
	rows, err := s.repo.ListWeddingGiftBanks(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]WeddingGiftBankDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, WeddingGiftBankDTO{
			ID: r.ID, BankName: r.BankName, AccountNumber: r.AccountNumber, AccountName: r.AccountName, SortOrder: r.SortOrder,
		})
	}
	return out, nil
}

func (s *Service) CreateWeddingGiftBank(ctx context.Context, in WeddingGiftBankInput) (int64, error) {
	if err := requireNonEmpty(in.BankName, "bankName"); err != nil {
		return 0, err
	}
	if err := requireNonEmpty(in.AccountNumber, "accountNumber"); err != nil {
		return 0, err
	}
	if err := requireNonEmpty(in.AccountName, "accountName"); err != nil {
		return 0, err
	}
	rows, err := s.repo.ListWeddingGiftBanks(ctx)
	if err != nil {
		return 0, err
	}
	next := int32(1)
	for _, r := range rows {
		if r.SortOrder >= next {
			next = r.SortOrder + 1
		}
	}
	return s.repo.CreateWeddingGiftBank(ctx, sqlc.CreateWeddingGiftBankParams{
		BankName: in.BankName, AccountNumber: in.AccountNumber, AccountName: in.AccountName, SortOrder: next,
	})
}

func (s *Service) UpdateWeddingGiftBank(ctx context.Context, id uint64, in WeddingGiftBankInput) error {
	if err := requireNonEmpty(in.BankName, "bankName"); err != nil {
		return err
	}
	if err := requireNonEmpty(in.AccountNumber, "accountNumber"); err != nil {
		return err
	}
	if err := requireNonEmpty(in.AccountName, "accountName"); err != nil {
		return err
	}
	return s.repo.UpdateWeddingGiftBank(ctx, sqlc.UpdateWeddingGiftBankParams{
		BankName: in.BankName, AccountNumber: in.AccountNumber, AccountName: in.AccountName, SortOrder: in.SortOrder, ID: id,
	})
}

func (s *Service) DeleteWeddingGiftBank(ctx context.Context, id uint64) error {
	return s.repo.DeleteWeddingGiftBank(ctx, id)
}
