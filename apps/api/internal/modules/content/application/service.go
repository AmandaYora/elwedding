package application

import (
	"context"
	"database/sql"
	"time"

	"undangan-ariana-adrian/internal/modules/content/contracts"
	"undangan-ariana-adrian/internal/modules/content/infrastructure"
	"undangan-ariana-adrian/internal/modules/content/infrastructure/sqlc"
	"undangan-ariana-adrian/internal/shared/idate"
	"undangan-ariana-adrian/internal/shared/storage"
)

var jakarta *time.Location

func init() {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		loc = time.FixedZone("WIB", 7*3600)
	}
	jakarta = loc
}

type Service struct {
	repo    *infrastructure.Repository
	storage *storage.Client
}

func NewService(repo *infrastructure.Repository, storage *storage.Client) *Service {
	return &Service{repo: repo, storage: storage}
}

func nullStr(s sql.NullString) string {
	if s.Valid {
		return s.String
	}
	return ""
}

func toNullStr(s string) sql.NullString {
	return sql.NullString{String: s, Valid: s != ""}
}

// --- invitation_content (singleton) ---

func (s *Service) toContentDTO(row sqlc.InvitationContent) InvitationContentDTO {
	wd := row.WeddingDate.In(jakarta)
	return InvitationContentDTO{
		BrideName:        row.BrideName,
		BrideParentsText: nullStr(row.BrideParentsText),
		BrideInstagram:   row.BrideInstagram,
		BridePhotoUrl:    row.BridePhotoUrl,

		GroomName:        row.GroomName,
		GroomParentsText: nullStr(row.GroomParentsText),
		GroomInstagram:   row.GroomInstagram,
		GroomPhotoUrl:    row.GroomPhotoUrl,

		// keputusan #16 (PLAN.md): epoch DETIK, dihitung sekali di sini dari
		// kolom DATETIME (di-parse driver MySQL dalam lokasi Asia/Jakarta -
		// lihat internal/database/db.go, DSN loc=Asia%2FJakarta).
		WeddingDateUnix:  wd.Unix(),
		WeddingDateLabel: idate.FormatLong(wd),
		WeddingDateRaw:   wd.Format("2006-01-02T15:04"),
		Hashtag:          row.Hashtag,

		CoverLogoUrl:         row.CoverLogoUrl,
		CoverImageDesktopUrl: row.CoverImageDesktopUrl,
		CoverImageMobileUrl:  row.CoverImageMobileUrl,

		QuoteText: nullStr(row.QuoteText),

		ThanksTitle:       row.ThanksTitle,
		ThanksDescription: nullStr(row.ThanksDescription),

		MusicUrl: row.MusicUrl,

		VideoGalleryTitle:       row.VideoGalleryTitle,
		VideoGalleryYoutubeUrl:  row.VideoGalleryYoutubeUrl,
		VideoGalleryCaption:     row.VideoGalleryCaption,
		LiveStreamingTitle:      row.LiveStreamingTitle,
		LiveStreamingYoutubeUrl: row.LiveStreamingYoutubeUrl,

		InstagramFilterTitle:           row.InstagramFilterTitle,
		InstagramFilterCaption:         nullStr(row.InstagramFilterCaption),
		InstagramFilterPreviewPhotoUrl: row.InstagramFilterPreviewPhotoUrl,
		InstagramFilterLink:            row.InstagramFilterLink,

		WeddingGiftDescription: nullStr(row.WeddingGiftDescription),

		DresscodeTitle:       row.DresscodeTitle,
		DresscodeDescription: nullStr(row.DresscodeDescription),
		DresscodeNote:        nullStr(row.DresscodeNote),
		// Tanpa nullStr - kolomnya NOT NULL DEFAULT '' (migration 000011),
		// beda dari DresscodeDescription/Note di atas yang NULLABLE.
		DresscodeImageUrl: row.DresscodeImageUrl,
	}
}

func (s *Service) GetContent(ctx context.Context) (InvitationContentDTO, error) {
	row, err := s.repo.GetInvitationContent(ctx)
	if err != nil {
		return InvitationContentDTO{}, err
	}
	return s.toContentDTO(row), nil
}

// GetQRInfo implementasi contracts.InvitationInfoProvider (PLAN.md
// dashboard-wa-rsvp keputusan #19) - satu-satunya cara modul lain (guest)
// memperoleh nama mempelai & tanggal acara, tanpa membaca tabel
// invitation_content secara langsung. Memakai ulang GetContent, bukan query
// baru.
func (s *Service) GetQRInfo(ctx context.Context) (contracts.QRInfo, error) {
	dto, err := s.GetContent(ctx)
	if err != nil {
		return contracts.QRInfo{}, err
	}
	return contracts.QRInfo{
		BrideName:        dto.BrideName,
		GroomName:        dto.GroomName,
		WeddingDateLabel: dto.WeddingDateLabel,
	}, nil
}

func (s *Service) UpdateContent(ctx context.Context, in UpdateInvitationContentInput) error {
	weddingDate, err := time.ParseInLocation("2006-01-02T15:04", in.WeddingDate, jakarta)
	if err != nil {
		// Terima juga format lengkap dengan detik, untuk fleksibilitas klien.
		weddingDate, err = time.ParseInLocation("2006-01-02T15:04:05", in.WeddingDate, jakarta)
		if err != nil {
			// Fallback date-only (dari <input type="date">) — jam default 09:00 WIB
			weddingDate, err = time.ParseInLocation("2006-01-02", in.WeddingDate, jakarta)
			if err != nil {
				return err
			}
			// set jam 09:00 bila hanya tanggal
			weddingDate = time.Date(weddingDate.Year(), weddingDate.Month(), weddingDate.Day(), 9, 0, 0, 0, jakarta)
		}
	}

	return s.repo.UpdateInvitationContent(ctx, sqlc.UpdateInvitationContentParams{
		BrideName:                      in.BrideName,
		BrideParentsText:               toNullStr(in.BrideParentsText),
		BrideInstagram:                 in.BrideInstagram,
		BridePhotoUrl:                  in.BridePhotoUrl,
		GroomName:                      in.GroomName,
		GroomParentsText:               toNullStr(in.GroomParentsText),
		GroomInstagram:                 in.GroomInstagram,
		GroomPhotoUrl:                  in.GroomPhotoUrl,
		WeddingDate:                    weddingDate,
		Hashtag:                        in.Hashtag,
		CoverLogoUrl:                   in.CoverLogoUrl,
		CoverImageDesktopUrl:           in.CoverImageDesktopUrl,
		CoverImageMobileUrl:            in.CoverImageMobileUrl,
		QuoteText:                      toNullStr(in.QuoteText),
		ThanksTitle:                    in.ThanksTitle,
		ThanksDescription:              toNullStr(in.ThanksDescription),
		MusicUrl:                       in.MusicUrl,
		VideoGalleryTitle:              in.VideoGalleryTitle,
		VideoGalleryYoutubeUrl:         in.VideoGalleryYoutubeUrl,
		VideoGalleryCaption:            in.VideoGalleryCaption,
		LiveStreamingTitle:             in.LiveStreamingTitle,
		LiveStreamingYoutubeUrl:        in.LiveStreamingYoutubeUrl,
		InstagramFilterTitle:           in.InstagramFilterTitle,
		InstagramFilterCaption:         toNullStr(in.InstagramFilterCaption),
		InstagramFilterPreviewPhotoUrl: in.InstagramFilterPreviewPhotoUrl,
		InstagramFilterLink:            in.InstagramFilterLink,
		WeddingGiftDescription:         toNullStr(in.WeddingGiftDescription),
		DresscodeTitle:                 in.DresscodeTitle,
		DresscodeDescription:           toNullStr(in.DresscodeDescription),
		DresscodeNote:                  toNullStr(in.DresscodeNote),
		// Tanpa toNullStr - kolomnya NOT NULL. '' adalah keadaan sah
		// "belum ada gambar"; Agenda.tsx yang merender bersyarat, jadi
		// sengaja TIDAK ada validasi wajib di sini.
		DresscodeImageUrl: in.DresscodeImageUrl,
	})
}

// --- sections ---

func (s *Service) ListSectionsAdmin(ctx context.Context) ([]SectionAdminDTO, error) {
	rows, err := s.repo.ListSections(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]SectionAdminDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, SectionAdminDTO{
			Key:       row.SectionKey,
			Label:     row.Label,
			IsEnabled: row.IsEnabled,
			SortOrder: row.SortOrder,
		})
	}
	return out, nil
}

// UpdateSections menerapkan toggle enable/disable & reorder (fitur #2/#3
// PLAN.md) untuk satu batch section sekaligus, supaya urutan drag-reorder
// di admin tersimpan konsisten dalam satu request.
func (s *Service) UpdateSections(ctx context.Context, updates []SectionUpdateInput) error {
	for _, u := range updates {
		existing, err := s.repo.GetSectionByKey(ctx, u.Key)
		if err != nil {
			return err
		}
		if err := s.repo.UpdateSection(ctx, sqlc.UpdateSectionParams{
			Label:      existing.Label,
			IsEnabled:  u.IsEnabled,
			SortOrder:  u.SortOrder,
			SectionKey: u.Key,
		}); err != nil {
			return err
		}
	}
	return nil
}

// listEnabledSectionsNormalized mengambil section yang enabled, terurut
// sort_order, lalu me-normalisasi urutannya jadi 1..N berurutan (PLAN.md
// §5.2) - bukan sort_order mentah yang bisa bolong setelah ada section yang
// di-disable. Ini yang dikirim ke window.INVITATION_LAYOUTS (keputusan #6).
func (s *Service) listEnabledSectionsNormalized(ctx context.Context) ([]SectionDTO, error) {
	rows, err := s.repo.ListEnabledSections(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]SectionDTO, 0, len(rows))
	for i, row := range rows {
		out = append(out, SectionDTO{Key: row.SectionKey, Order: int32(i + 1)})
	}
	return out, nil
}

// --- agregat publik ---

// BuildPublicInvitation menyusun kontrak GET /api/v1/public/invitation
// (PLAN.md §5.2): content + section enabled (ter-normalisasi) + 5 list
// konten. 7 query kecil sekali jalan - lihat PLAN.md §3 sanity volume data.
func (s *Service) BuildPublicInvitation(ctx context.Context) (PublicInvitationDTO, error) {
	contentRow, err := s.repo.GetInvitationContent(ctx)
	if err != nil {
		return PublicInvitationDTO{}, err
	}

	sections, err := s.listEnabledSectionsNormalized(ctx)
	if err != nil {
		return PublicInvitationDTO{}, err
	}

	agendaEvents, err := s.ListAgendaEvents(ctx)
	if err != nil {
		return PublicInvitationDTO{}, err
	}
	rundownItems, err := s.ListRundownItems(ctx)
	if err != nil {
		return PublicInvitationDTO{}, err
	}
	galleryPhotos, err := s.ListGalleryPhotos(ctx)
	if err != nil {
		return PublicInvitationDTO{}, err
	}
	loveStoryChapters, err := s.ListLoveStoryChapters(ctx)
	if err != nil {
		return PublicInvitationDTO{}, err
	}
	giftBanks, err := s.ListWeddingGiftBanks(ctx)
	if err != nil {
		return PublicInvitationDTO{}, err
	}

	return PublicInvitationDTO{
		Content:           s.toContentDTO(contentRow),
		Sections:          sections,
		AgendaEvents:      agendaEvents,
		RundownItems:      rundownItems,
		GalleryPhotos:     galleryPhotos,
		LoveStoryChapters: loveStoryChapters,
		GiftBanks:         giftBanks,
	}, nil
}
