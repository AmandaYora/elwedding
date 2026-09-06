package infrastructure

import (
	"context"
	"database/sql"

	"undangan-digital/internal/modules/content/infrastructure/sqlc"
)

// db disimpan BERDAMPINGAN dengan q - bukan menggantikannya. Seluruh method
// lain tetap lewat q (satu pernyataan, tanpa transaksi); hanya
// ApplySectionUpdates di bawah yang butuh membuka transaksi sendiri, dan
// BeginTx hanya ada di *sql.DB, tidak di antarmuka sqlc.DBTX.
type Repository struct {
	db *sql.DB
	q  *sqlc.Queries
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db, q: sqlc.New(db)}
}

// --- invitation_content (singleton) ---

func (r *Repository) GetInvitationContent(ctx context.Context) (sqlc.InvitationContent, error) {
	return r.q.GetInvitationContent(ctx)
}

func (r *Repository) UpdateInvitationContent(ctx context.Context, arg sqlc.UpdateInvitationContentParams) error {
	return r.q.UpdateInvitationContent(ctx, arg)
}

// --- agenda_events ---

func (r *Repository) ListAgendaEvents(ctx context.Context) ([]sqlc.AgendaEvent, error) {
	return r.q.ListAgendaEvents(ctx)
}
func (r *Repository) GetAgendaEvent(ctx context.Context, id uint64) (sqlc.AgendaEvent, error) {
	return r.q.GetAgendaEvent(ctx, id)
}
func (r *Repository) CreateAgendaEvent(ctx context.Context, arg sqlc.CreateAgendaEventParams) (int64, error) {
	return r.q.CreateAgendaEvent(ctx, arg)
}
func (r *Repository) UpdateAgendaEvent(ctx context.Context, arg sqlc.UpdateAgendaEventParams) error {
	return r.q.UpdateAgendaEvent(ctx, arg)
}
func (r *Repository) DeleteAgendaEvent(ctx context.Context, id uint64) error {
	return r.q.DeleteAgendaEvent(ctx, id)
}

// --- rundown_items ---

func (r *Repository) ListRundownItems(ctx context.Context) ([]sqlc.RundownItem, error) {
	return r.q.ListRundownItems(ctx)
}
func (r *Repository) GetRundownItem(ctx context.Context, id uint64) (sqlc.RundownItem, error) {
	return r.q.GetRundownItem(ctx, id)
}
func (r *Repository) CreateRundownItem(ctx context.Context, arg sqlc.CreateRundownItemParams) (int64, error) {
	return r.q.CreateRundownItem(ctx, arg)
}
func (r *Repository) UpdateRundownItem(ctx context.Context, arg sqlc.UpdateRundownItemParams) error {
	return r.q.UpdateRundownItem(ctx, arg)
}
func (r *Repository) DeleteRundownItem(ctx context.Context, id uint64) error {
	return r.q.DeleteRundownItem(ctx, id)
}

// --- gallery_photos ---

func (r *Repository) ListGalleryPhotos(ctx context.Context) ([]sqlc.GalleryPhoto, error) {
	return r.q.ListGalleryPhotos(ctx)
}
func (r *Repository) GetGalleryPhoto(ctx context.Context, id uint64) (sqlc.GalleryPhoto, error) {
	return r.q.GetGalleryPhoto(ctx, id)
}
func (r *Repository) CreateGalleryPhoto(ctx context.Context, arg sqlc.CreateGalleryPhotoParams) (int64, error) {
	return r.q.CreateGalleryPhoto(ctx, arg)
}
func (r *Repository) UpdateGalleryPhoto(ctx context.Context, arg sqlc.UpdateGalleryPhotoParams) error {
	return r.q.UpdateGalleryPhoto(ctx, arg)
}
func (r *Repository) DeleteGalleryPhoto(ctx context.Context, id uint64) error {
	return r.q.DeleteGalleryPhoto(ctx, id)
}

// --- love_story_chapters ---

func (r *Repository) ListLoveStoryChapters(ctx context.Context) ([]sqlc.LoveStoryChapter, error) {
	return r.q.ListLoveStoryChapters(ctx)
}
func (r *Repository) GetLoveStoryChapter(ctx context.Context, id uint64) (sqlc.LoveStoryChapter, error) {
	return r.q.GetLoveStoryChapter(ctx, id)
}
func (r *Repository) CreateLoveStoryChapter(ctx context.Context, arg sqlc.CreateLoveStoryChapterParams) (int64, error) {
	return r.q.CreateLoveStoryChapter(ctx, arg)
}
func (r *Repository) UpdateLoveStoryChapter(ctx context.Context, arg sqlc.UpdateLoveStoryChapterParams) error {
	return r.q.UpdateLoveStoryChapter(ctx, arg)
}
func (r *Repository) DeleteLoveStoryChapter(ctx context.Context, id uint64) error {
	return r.q.DeleteLoveStoryChapter(ctx, id)
}

// --- wedding_gift_banks ---

func (r *Repository) ListWeddingGiftBanks(ctx context.Context) ([]sqlc.WeddingGiftBank, error) {
	return r.q.ListWeddingGiftBanks(ctx)
}
func (r *Repository) GetWeddingGiftBank(ctx context.Context, id uint64) (sqlc.WeddingGiftBank, error) {
	return r.q.GetWeddingGiftBank(ctx, id)
}
func (r *Repository) CreateWeddingGiftBank(ctx context.Context, arg sqlc.CreateWeddingGiftBankParams) (int64, error) {
	return r.q.CreateWeddingGiftBank(ctx, arg)
}
func (r *Repository) UpdateWeddingGiftBank(ctx context.Context, arg sqlc.UpdateWeddingGiftBankParams) error {
	return r.q.UpdateWeddingGiftBank(ctx, arg)
}
func (r *Repository) DeleteWeddingGiftBank(ctx context.Context, id uint64) error {
	return r.q.DeleteWeddingGiftBank(ctx, id)
}

// --- sections ---

func (r *Repository) ListSections(ctx context.Context) ([]sqlc.Section, error) {
	return r.q.ListSections(ctx)
}
func (r *Repository) ListEnabledSections(ctx context.Context) ([]sqlc.Section, error) {
	return r.q.ListEnabledSections(ctx)
}
func (r *Repository) GetSectionByKey(ctx context.Context, key string) (sqlc.Section, error) {
	return r.q.GetSectionByKey(ctx, key)
}
func (r *Repository) UpdateSection(ctx context.Context, arg sqlc.UpdateSectionParams) error {
	return r.q.UpdateSection(ctx, arg)
}

// SectionUpdate adalah satu perubahan section di dalam batch
// ApplySectionUpdates. Sengaja tipe milik infrastructure (bukan sqlc.
// UpdateSectionParams): `label` TIDAK datang dari pemanggil melainkan dibaca
// ulang di dalam transaksi, jadi bentuk ini yang jujur menggambarkan apa yang
// boleh diubah admin - enabled & urutan saja.
type SectionUpdate struct {
	Key       string
	IsEnabled bool
	SortOrder int32
}

// ApplySectionUpdates menerapkan SELURUH perubahan section dalam SATU
// transaksi - atau tidak sama sekali.
//
// Sebelumnya loop-nya ada di service tanpa transaksi, dan itu bisa menulis
// separuh batch lalu membalas "Failed to update sections": satu key yang
// tidak dikenal di tengah daftar membuat entri sebelumnya SUDAH tersimpan
// sementara admin diberi tahu bahwa penyimpanan gagal, sehingga layar dan
// database berbeda isi sampai halaman dimuat ulang. Untuk drag-reorder yang
// mengirim seluruh section sekaligus, separuh urutan yang tersimpan lebih
// buruk daripada tidak tersimpan sama sekali.
//
// Transaksi ini SAH menurut backend-modular-monolith.md: `sections` dimiliki
// modul content dan tidak ada tabel modul lain yang disentuh di sini.
func (r *Repository) ApplySectionUpdates(ctx context.Context, updates []SectionUpdate) error {
	if len(updates) == 0 {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	// Rollback SETELAH Commit sukses adalah no-op (sql.ErrTxDone) - defer ini
	// aman dan menjamin transaksi tidak pernah menggantung di jalur error
	// mana pun, termasuk yang ditambahkan kelak.
	defer func() { _ = tx.Rollback() }()

	q := r.q.WithTx(tx)
	for _, u := range updates {
		// Dibaca ULANG di dalam transaksi, bukan dipercaya dari pemanggil:
		// label bukan milik admin (tidak ada di form), dan key yang tidak
		// dikenal harus menggagalkan SELURUH batch di sini.
		existing, err := q.GetSectionByKey(ctx, u.Key)
		if err != nil {
			return err
		}
		if err := q.UpdateSection(ctx, sqlc.UpdateSectionParams{
			Label:      existing.Label,
			IsEnabled:  u.IsEnabled,
			SortOrder:  u.SortOrder,
			SectionKey: u.Key,
		}); err != nil {
			return err
		}
	}
	return tx.Commit()
}
