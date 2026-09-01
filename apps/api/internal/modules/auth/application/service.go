package application

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"

	"undangan-ariana-adrian/internal/modules/auth/infrastructure"
	"undangan-ariana-adrian/internal/shared/jwtutil"
	"undangan-ariana-adrian/internal/shared/pagination"
)

var ErrInvalidCredentials = errors.New("invalid username or password")

var (
	ErrUsernameRequired      = errors.New("username is required")
	ErrPasswordTooShort      = errors.New("password must be at least 6 characters")
	ErrUsernameTaken         = errors.New("username already taken")
	ErrCannotDeleteSelf      = errors.New("cannot delete your own account")
	ErrCannotDeleteLastAdmin = errors.New("cannot delete the last remaining admin account")
)

type Service struct {
	repo         *infrastructure.Repository
	jwtSecret    string
	jwtExpiresIn time.Duration
}

func NewService(repo *infrastructure.Repository, jwtSecret string, jwtExpiresIn time.Duration) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret, jwtExpiresIn: jwtExpiresIn}
}

// Authenticate memeriksa username+password terhadap admin_users, lalu
// menerbitkan JWT (PLAN.md §1 keputusan #11 - 1 admin, JWT stateless).
func (s *Service) Authenticate(ctx context.Context, username, password string) (string, error) {
	user, err := s.repo.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrInvalidCredentials
		}
		return "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", ErrInvalidCredentials
	}

	return jwtutil.Generate(s.jwtSecret, s.jwtExpiresIn, user.ID, user.Username)
}

// List/Create/Update/Delete (fitur admin-users PLAN.md): CRUD akun admin,
// semua admin setara/tanpa role (keputusan #2) - siapa pun yang login boleh
// mengelola akun siapa pun, termasuk dirinya sendiri, kecuali dua guardrail
// di Delete di bawah.
func (s *Service) List(ctx context.Context, p pagination.Params) ([]AdminUserDTO, int, error) {
	total, err := s.repo.Count(ctx)
	if err != nil {
		return nil, 0, err
	}
	rows, err := s.repo.List(ctx, int32(p.Limit), int32(p.Offset()))
	if err != nil {
		return nil, 0, err
	}
	out := make([]AdminUserDTO, 0, len(rows))
	for _, row := range rows {
		out = append(out, AdminUserDTO{ID: row.ID, Username: row.Username, CreatedAt: row.CreatedAt.Format(time.RFC3339)})
	}
	return out, int(total), nil
}

func (s *Service) Create(ctx context.Context, in CreateUserInput) (AdminUserDTO, error) {
	if in.Username == "" {
		return AdminUserDTO{}, ErrUsernameRequired
	}
	if len(in.Password) < 6 {
		return AdminUserDTO{}, ErrPasswordTooShort
	}
	if _, err := s.repo.GetByUsername(ctx, in.Username); err == nil {
		return AdminUserDTO{}, ErrUsernameTaken
	} else if !errors.Is(err, sql.ErrNoRows) {
		return AdminUserDTO{}, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return AdminUserDTO{}, err
	}
	id, err := s.repo.Create(ctx, in.Username, string(hash))
	if err != nil {
		return AdminUserDTO{}, err
	}
	return AdminUserDTO{ID: uint64(id), Username: in.Username, CreatedAt: time.Now().Format(time.RFC3339)}, nil
}

func (s *Service) Update(ctx context.Context, id uint64, in UpdateUserInput) error {
	if in.Username == "" {
		return ErrUsernameRequired
	}
	if existing, err := s.repo.GetByUsername(ctx, in.Username); err == nil {
		if existing.ID != id {
			return ErrUsernameTaken
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if in.Password == "" {
		return s.repo.UpdateUsername(ctx, id, in.Username)
	}
	if len(in.Password) < 6 {
		return ErrPasswordTooShort
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return s.repo.UpdateUsernameAndPassword(ctx, id, in.Username, string(hash))
}

// Delete menolak 2 kasus (keputusan Step 4): menghapus akun sendiri yang
// sedang login, dan menghapus admin terakhir - keduanya bisa mengunci
// sistem karena semua admin setara/tanpa role.
func (s *Service) Delete(ctx context.Context, id, currentAdminID uint64) error {
	if id == currentAdminID {
		return ErrCannotDeleteSelf
	}
	total, err := s.repo.Count(ctx)
	if err != nil {
		return err
	}
	if total <= 1 {
		return ErrCannotDeleteLastAdmin
	}
	return s.repo.Delete(ctx, id)
}

// StatusHTTPCode memetakan error domain ke status HTTP - dipakai presentation,
// pola sama seperti guest/application/service.go.
func StatusHTTPCode(err error) int {
	switch {
	case errors.Is(err, ErrUsernameRequired), errors.Is(err, ErrPasswordTooShort),
		errors.Is(err, ErrUsernameTaken), errors.Is(err, ErrCannotDeleteSelf),
		errors.Is(err, ErrCannotDeleteLastAdmin):
		return 400
	default:
		return 500
	}
}
