package infrastructure

import (
	"context"
	"database/sql"

	"undangan-ariana-adrian/internal/modules/auth/infrastructure/sqlc"
)

type Repository struct {
	q *sqlc.Queries
}

func NewRepository(db sqlc.DBTX) *Repository {
	return &Repository{q: sqlc.New(db)}
}

func (r *Repository) GetByUsername(ctx context.Context, username string) (sqlc.AdminUser, error) {
	return r.q.GetAdminUserByUsername(ctx, username)
}

func (r *Repository) Create(ctx context.Context, username, passwordHash string) (int64, error) {
	return r.q.CreateAdminUser(ctx, sqlc.CreateAdminUserParams{Username: username, PasswordHash: passwordHash})
}

func (r *Repository) List(ctx context.Context, limit, offset int32) ([]sqlc.ListAdminUsersRow, error) {
	return r.q.ListAdminUsers(ctx, sqlc.ListAdminUsersParams{Limit: limit, Offset: offset})
}

func (r *Repository) Count(ctx context.Context) (int64, error) {
	return r.q.CountAdminUsers(ctx)
}

func (r *Repository) UpdateUsername(ctx context.Context, id uint64, username string) error {
	return r.q.UpdateAdminUserUsername(ctx, sqlc.UpdateAdminUserUsernameParams{Username: username, ID: id})
}

func (r *Repository) UpdateUsernameAndPassword(ctx context.Context, id uint64, username, passwordHash string) error {
	return r.q.UpdateAdminUserUsernameAndPassword(ctx, sqlc.UpdateAdminUserUsernameAndPasswordParams{
		Username: username, PasswordHash: passwordHash, ID: id,
	})
}

func (r *Repository) Delete(ctx context.Context, id uint64) error {
	return r.q.DeleteAdminUser(ctx, id)
}

var ErrNotFound = sql.ErrNoRows
