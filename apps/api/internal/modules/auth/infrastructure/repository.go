package infrastructure

import (
	"context"
	"database/sql"

	"undangan-digital/internal/modules/auth/infrastructure/sqlc"
)

type Repository struct {
	q *sqlc.Queries
}

func NewRepository(db sqlc.DBTX) *Repository {
	return &Repository{q: sqlc.New(db)}
}

// GetByUsername mengembalikan GetAdminUserByUsernameRow, bukan sqlc.AdminUser:
// sejak `role` ditambahkan (migration 000015) urutan kolom pada query eksplisit
// tidak lagi identik dengan struct tabel, jadi sqlc menghasilkan tipe baris
// tersendiri. Isinya sama persis.
func (r *Repository) GetByUsername(ctx context.Context, username string) (sqlc.GetAdminUserByUsernameRow, error) {
	return r.q.GetAdminUserByUsername(ctx, username)
}

func (r *Repository) GetByID(ctx context.Context, id uint64) (sqlc.GetAdminUserByIDRow, error) {
	return r.q.GetAdminUserByID(ctx, id)
}

func (r *Repository) Create(ctx context.Context, username, passwordHash, role string) (int64, error) {
	return r.q.CreateAdminUser(ctx, sqlc.CreateAdminUserParams{
		Username: username, PasswordHash: passwordHash, Role: sqlc.AdminUsersRole(role),
	})
}

func (r *Repository) List(ctx context.Context, limit, offset int32) ([]sqlc.ListAdminUsersRow, error) {
	return r.q.ListAdminUsers(ctx, sqlc.ListAdminUsersParams{Limit: limit, Offset: offset})
}

// Count menghitung SELURUH baris - tetap dipakai paginasi List. Guardrail
// anti-terkunci TIDAK boleh memakainya; lihat CountFullAdmins.
func (r *Repository) Count(ctx context.Context) (int64, error) {
	return r.q.CountAdminUsers(ctx)
}

// CountFullAdmins menghitung akun berperan 'admin' saja (docs/plan/
// scan-checkin-gate/PLAN.md §2.3) - satu-satunya angka yang sahih untuk
// guardrail "admin terakhir", karena 1 admin + 3 petugas = 4 pada Count()
// dan admin penuh terakhir lolos dihapus.
func (r *Repository) CountFullAdmins(ctx context.Context) (int64, error) {
	return r.q.CountFullAdmins(ctx)
}

func (r *Repository) UpdateUsername(ctx context.Context, id uint64, username string) error {
	return r.q.UpdateAdminUserUsername(ctx, sqlc.UpdateAdminUserUsernameParams{Username: username, ID: id})
}

func (r *Repository) UpdateUsernameAndPassword(ctx context.Context, id uint64, username, passwordHash string) error {
	return r.q.UpdateAdminUserUsernameAndPassword(ctx, sqlc.UpdateAdminUserUsernameAndPasswordParams{
		Username: username, PasswordHash: passwordHash, ID: id,
	})
}

func (r *Repository) UpdateRole(ctx context.Context, id uint64, role string) error {
	return r.q.UpdateAdminUserRole(ctx, sqlc.UpdateAdminUserRoleParams{Role: sqlc.AdminUsersRole(role), ID: id})
}

func (r *Repository) Delete(ctx context.Context, id uint64) error {
	return r.q.DeleteAdminUser(ctx, id)
}

var ErrNotFound = sql.ErrNoRows
