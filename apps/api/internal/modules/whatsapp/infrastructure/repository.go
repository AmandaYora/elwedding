package infrastructure

import (
	"context"

	"undangan-ariana-adrian/internal/modules/whatsapp/infrastructure/sqlc"
)

type Repository struct {
	q *sqlc.Queries
}

func NewRepository(db sqlc.DBTX) *Repository {
	return &Repository{q: sqlc.New(db)}
}

func (r *Repository) GetConfig(ctx context.Context) (sqlc.WhatsappConfig, error) {
	return r.q.GetWhatsAppConfig(ctx)
}

func (r *Repository) UpdateConfig(ctx context.Context, arg sqlc.UpdateWhatsAppConfigParams) error {
	return r.q.UpdateWhatsAppConfig(ctx, arg)
}

func (r *Repository) InsertSendLog(ctx context.Context, arg sqlc.InsertSendLogParams) (int64, error) {
	return r.q.InsertSendLog(ctx, arg)
}

func (r *Repository) UpdateSendLogStatus(ctx context.Context, arg sqlc.UpdateSendLogStatusParams) error {
	return r.q.UpdateSendLogStatus(ctx, arg)
}

func (r *Repository) GetSendLogByID(ctx context.Context, id uint64) (sqlc.WhatsappSendLog, error) {
	return r.q.GetSendLogByID(ctx, id)
}

func (r *Repository) ListSendLogs(ctx context.Context, arg sqlc.ListSendLogsParams) ([]sqlc.WhatsappSendLog, error) {
	return r.q.ListSendLogs(ctx, arg)
}

func (r *Repository) CountSendLogs(ctx context.Context) (int64, error) {
	return r.q.CountSendLogs(ctx)
}
