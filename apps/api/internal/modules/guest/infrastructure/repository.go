package infrastructure

import (
	"context"
	"database/sql"

	"undangan-digital/internal/modules/guest/infrastructure/sqlc"
)

type Repository struct {
	q *sqlc.Queries
}

func NewRepository(db sqlc.DBTX) *Repository {
	return &Repository{q: sqlc.New(db)}
}

func (r *Repository) Create(ctx context.Context, arg sqlc.CreateGuestParams) (int64, error) {
	return r.q.CreateGuest(ctx, arg)
}

func (r *Repository) GetByID(ctx context.Context, id uint64) (sqlc.Guest, error) {
	return r.q.GetGuestByID(ctx, id)
}

func (r *Repository) GetByToken(ctx context.Context, token string) (sqlc.Guest, error) {
	return r.q.GetGuestByToken(ctx, token)
}

func (r *Repository) Update(ctx context.Context, arg sqlc.UpdateGuestParams) error {
	return r.q.UpdateGuest(ctx, arg)
}

func (r *Repository) UpdateRsvpStatusByToken(ctx context.Context, arg sqlc.UpdateGuestRsvpStatusByTokenParams) error {
	return r.q.UpdateGuestRsvpStatusByToken(ctx, arg)
}

// ResetRsvp mengosongkan JAWABAN tamu, bukan barisnya (docs/plan/
// reservation-reset-contacted-flag/PLAN.md K1) - dipakai tombol Hapus di menu
// Reservasi. Bedakan dari Delete di bawah, yang benar-benar menghapus tamunya.
func (r *Repository) ResetRsvp(ctx context.Context, id uint64) error {
	return r.q.ResetGuestRsvpByID(ctx, id)
}

func (r *Repository) MarkContacted(ctx context.Context, id uint64) error {
	return r.q.MarkGuestContacted(ctx, id)
}

func (r *Repository) UnmarkContacted(ctx context.Context, id uint64) error {
	return r.q.UnmarkGuestContacted(ctx, id)
}

// MarkCheckedIn meneruskan ROWS AFFECTED, bukan error saja (docs/plan/
// scan-checkin-gate/PLAN.md D5): 1 = tamu baru saja check-in, 0 = sudah
// pernah check-in sebelumnya. Itulah yang membedakan kedua keadaan tanpa
// baca-lalu-tulis yang bisa saling menimpa antar petugas.
func (r *Repository) MarkCheckedIn(ctx context.Context, id uint64) (int64, error) {
	return r.q.MarkGuestCheckedIn(ctx, id)
}

// ListCheckedIn/CountCheckedIn/CheckinSummary melayani menu "Tamu Masuk"
// milik petugas gate. Baris hasilnya bertipe ListCheckedInGuestsRow (bukan
// sqlc.Guest) karena query-nya menyebut kolom satu per satu - itu disengaja,
// lihat komentar di queries/guests.sql.
func (r *Repository) ListCheckedIn(ctx context.Context, limit, offset int32) ([]sqlc.ListCheckedInGuestsRow, error) {
	return r.q.ListCheckedInGuests(ctx, sqlc.ListCheckedInGuestsParams{Limit: limit, Offset: offset})
}

func (r *Repository) CountCheckedIn(ctx context.Context) (int64, error) {
	return r.q.CountCheckedInGuests(ctx)
}

func (r *Repository) CheckinSummary(ctx context.Context) (sqlc.GetCheckinSummaryRow, error) {
	return r.q.GetCheckinSummary(ctx)
}

func (r *Repository) Delete(ctx context.Context, id uint64) error {
	return r.q.DeleteGuest(ctx, id)
}

// ListFiltered & CountFiltered menggantikan List/ListByStatus/Count/CountByStatus
// lama (PLAN.md admin-ui-redesign keputusan #9) - status dan pencarian
// nama/telepon digabung jadi satu query lewat sqlc.narg, terverifikasi
// bekerja terhadap MySQL sungguhan (lihat PLAN.md §1.3 "Bukti runtime").
func (r *Repository) ListFiltered(ctx context.Context, arg sqlc.ListGuestsFilteredParams) ([]sqlc.Guest, error) {
	return r.q.ListGuestsFiltered(ctx, arg)
}

func (r *Repository) CountFiltered(ctx context.Context, arg sqlc.CountGuestsFilteredParams) (int64, error) {
	return r.q.CountGuestsFiltered(ctx, arg)
}

// CountGroupedByStatus dipakai halaman Ringkasan (keputusan #11) - 1 query
// GROUP BY, bukan 4 query terpisah.
func (r *Repository) CountGroupedByStatus(ctx context.Context) ([]sqlc.CountGuestsGroupedByStatusRow, error) {
	return r.q.CountGuestsGroupedByStatus(ctx)
}

// CountGroupedByInvitationType & CountGroupedBySouvenirType dipakai panel
// logistik Ringkasan (PLAN.md guest-fields-admin-layout keputusan #18) -
// meniru pola CountGroupedByStatus di atas.
func (r *Repository) CountGroupedByInvitationType(ctx context.Context) ([]sqlc.CountGuestsGroupedByInvitationTypeRow, error) {
	return r.q.CountGuestsGroupedByInvitationType(ctx)
}

func (r *Repository) CountGroupedBySouvenirType(ctx context.Context) ([]sqlc.CountGuestsGroupedBySouvenirTypeRow, error) {
	return r.q.CountGuestsGroupedBySouvenirType(ctx)
}

// CountGroupedBySide, CountGroupedByGender & ListRecentRsvpResponses dipakai
// dashboard berbasis kartu (PLAN.md dashboard-wa-rsvp §3.4) - meniru pola
// yang sama dengan CountGroupedByStatus.
func (r *Repository) CountGroupedBySide(ctx context.Context) ([]sqlc.CountGuestsGroupedBySideRow, error) {
	return r.q.CountGuestsGroupedBySide(ctx)
}

func (r *Repository) CountGroupedByGender(ctx context.Context) ([]sqlc.CountGuestsGroupedByGenderRow, error) {
	return r.q.CountGuestsGroupedByGender(ctx)
}

func (r *Repository) ListRecentRsvpResponses(ctx context.Context) ([]sqlc.ListRecentRsvpResponsesRow, error) {
	return r.q.ListRecentRsvpResponses(ctx)
}

// --- group tamu (docs/plan/guest-groups/PLAN.md T3) ---
//
// Tabel guest_groups DIMILIKI modul guest yang sama (D1), jadi seluruh method
// di bawah tetap penerusan tipis ke r.q.* seperti method tamu di atas - tidak
// ada repository baru, tidak ada contracts/, tidak ada module client.

func (r *Repository) CreateGroup(ctx context.Context, arg sqlc.CreateGuestGroupParams) (int64, error) {
	return r.q.CreateGuestGroup(ctx, arg)
}

func (r *Repository) GetGroupByID(ctx context.Context, id uint64) (sqlc.GuestGroup, error) {
	return r.q.GetGuestGroupByID(ctx, id)
}

func (r *Repository) GetGroupByName(ctx context.Context, name string) (sqlc.GuestGroup, error) {
	return r.q.GetGuestGroupByName(ctx, name)
}

func (r *Repository) ListGroups(ctx context.Context, limit, offset int32) ([]sqlc.GuestGroup, error) {
	return r.q.ListGuestGroups(ctx, sqlc.ListGuestGroupsParams{Limit: limit, Offset: offset})
}

func (r *Repository) CountGroups(ctx context.Context) (int64, error) {
	return r.q.CountGuestGroups(ctx)
}

func (r *Repository) UpdateGroup(ctx context.Context, arg sqlc.UpdateGuestGroupParams) error {
	return r.q.UpdateGuestGroup(ctx, arg)
}

func (r *Repository) DeleteGroup(ctx context.Context, id uint64) error {
	return r.q.DeleteGuestGroup(ctx, id)
}

// CountGuestsByGroupID & CountGroupedByGroup menyentuh tabel `guests`, bukan
// guest_groups - keduanya tetap di sini karena repository ini memang pemilik
// kedua tabel itu.
//
// CountGuestsByGroupID adalah penjaga K4, dipanggil tepat sebelum hapus.
func (r *Repository) CountGuestsByGroupID(ctx context.Context, id uint64) (int64, error) {
	return r.q.CountGuestsByGroupID(ctx, sql.NullInt64{Int64: int64(id), Valid: true})
}

// CountGroupedByGroup mengisi kolom "Jumlah tamu" SELURUH halaman Group lewat
// satu GROUP BY - pola CountGroupedByStatus, bukan satu COUNT per baris.
func (r *Repository) CountGroupedByGroup(ctx context.Context) ([]sqlc.CountGuestsGroupedByGroupRow, error) {
	return r.q.CountGuestsGroupedByGroup(ctx)
}

// --- wedding wishes (docs/plan/wedding-wish/PLAN.md T5) ---
//
// Tabel wedding_wishes DIMILIKI modul guest yang sama (D5), jadi seluruh
// method di bawah tetap penerusan tipis ke r.q.* seperti method group di
// atas - tidak ada repository baru, tidak ada contracts/, tidak ada module
// client. Query-nya menyentuh wedding_wishes dan guests - keduanya milik
// modul ini, jadi JOIN intra-modul di query list sah.

func (r *Repository) CreateWish(ctx context.Context, arg sqlc.CreateWeddingWishParams) (int64, error) {
	return r.q.CreateWeddingWish(ctx, arg)
}

func (r *Repository) GetWishByGuestID(ctx context.Context, guestID uint64) (sqlc.WeddingWish, error) {
	return r.q.GetWeddingWishByGuestID(ctx, guestID)
}

func (r *Repository) GetWishByID(ctx context.Context, id uint64) (sqlc.WeddingWish, error) {
	return r.q.GetWeddingWishByID(ctx, id)
}

func (r *Repository) ListPublicWishes(ctx context.Context, limit int32) ([]sqlc.ListPublicWeddingWishesRow, error) {
	return r.q.ListPublicWeddingWishes(ctx, limit)
}

func (r *Repository) ListWishesAdmin(ctx context.Context, arg sqlc.ListWeddingWishesAdminParams) ([]sqlc.ListWeddingWishesAdminRow, error) {
	return r.q.ListWeddingWishesAdmin(ctx, arg)
}

func (r *Repository) CountWishes(ctx context.Context) (int64, error) {
	return r.q.CountWeddingWishes(ctx)
}

func (r *Repository) SetWishHidden(ctx context.Context, arg sqlc.SetWeddingWishHiddenParams) error {
	return r.q.SetWeddingWishHidden(ctx, arg)
}

func (r *Repository) DeleteWish(ctx context.Context, id uint64) error {
	return r.q.DeleteWeddingWish(ctx, id)
}
