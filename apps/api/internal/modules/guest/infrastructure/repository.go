package infrastructure

import (
	"context"

	"undangan-ariana-adrian/internal/modules/guest/infrastructure/sqlc"
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
