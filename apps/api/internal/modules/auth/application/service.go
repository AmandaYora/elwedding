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
	ErrCannotDemoteLastAdmin = errors.New("cannot demote the last remaining admin account")
	ErrInvalidRole           = errors.New("role must be 'admin' or 'scanner'")
	ErrUserNotFound          = errors.New("admin user not found")
)

// RoleAdmin/RoleScanner cocok dengan enum kolom admin_users.role (migration
// 000015) dan dengan authmw.RoleScanner - docs/plan/scan-checkin-gate/PLAN.md
// T6/K2.
const (
	RoleAdmin   = "admin"
	RoleScanner = "scanner"
)

// validRoles mengikuti pola validStatuses di modul guest: string di luar map
// ini ditolak sebagai ErrInvalidRole, tidak pernah diteruskan ke DB.
var validRoles = map[string]bool{RoleAdmin: true, RoleScanner: true}

type Service struct {
	repo         *infrastructure.Repository
	jwtSecret    string
	jwtExpiresIn time.Duration
}

func NewService(repo *infrastructure.Repository, jwtSecret string, jwtExpiresIn time.Duration) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret, jwtExpiresIn: jwtExpiresIn}
}

// Authenticate memeriksa username+password terhadap admin_users, lalu
// menerbitkan JWT (PLAN.md §1 keputusan #11 - JWT stateless). Peran ikut
// dikembalikan supaya handler bisa menaruhnya di respons login: SPA butuh
// tahu peran sebelum merender menu (docs/plan/scan-checkin-gate T6/T12).
func (s *Service) Authenticate(ctx context.Context, username, password string) (string, string, error) {
	user, err := s.repo.GetByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", "", ErrInvalidCredentials
		}
		return "", "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", "", ErrInvalidCredentials
	}

	role := string(user.Role)
	token, err := jwtutil.Generate(s.jwtSecret, s.jwtExpiresIn, user.ID, user.Username, role)
	if err != nil {
		return "", "", err
	}
	return token, role, nil
}

// canDeleteAdmin & canChangeRole adalah FUNGSI MURNI supaya bisa diuji tanpa
// DB (role_guard_test.go) - Service memegang *infrastructure.Repository
// konkret, jadi method yang menyentuh repo memang tidak bisa di-unit-test.
// Pola yang sama dipakai resolveAttendingCount di modul guest.
//
// Keduanya membaca jumlah ADMIN PENUH, bukan seluruh baris (docs/plan/
// scan-checkin-gate/PLAN.md §2.3). Dengan Count() apa adanya, 1 admin penuh +
// 3 petugas = 4 sehingga admin penuh terakhir lolos dihapus dan sistem
// TERKUNCI PERMANEN: tidak ada lagi akun yang bisa membuka menu Pengguna
// untuk memperbaikinya.
func canDeleteAdmin(targetRole string, fullAdminCount int) error {
	// Menghapus akun petugas TIDAK PERNAH boleh terhalang jumlah admin -
	// petugas tidak memegang akses yang bisa hilang dari sistem.
	if targetRole != RoleAdmin {
		return nil
	}
	if fullAdminCount <= 1 {
		return ErrCannotDeleteLastAdmin
	}
	return nil
}

// canChangeRole menolak penurunan admin penuh TERAKHIR jadi petugas -
// penguncian yang persis sama dengan menghapusnya. Kenaikan petugas jadi
// admin selalu boleh.
func canChangeRole(currentRole, newRole string, fullAdminCount int) error {
	if currentRole != RoleAdmin || newRole != RoleScanner {
		return nil
	}
	if fullAdminCount <= 1 {
		return ErrCannotDemoteLastAdmin
	}
	return nil
}

// List/Create/Update/Delete (fitur admin-users PLAN.md): CRUD akun admin.
// Sejak docs/plan/scan-checkin-gate (K2) akun TIDAK LAGI setara - ada peran
// 'admin' (akses penuh) dan 'scanner' (petugas gate, hanya menu Scan), yang
// membalik keputusan #2 secara sadar. Menu ini sendiri hanya bisa dibuka
// admin penuh (authmw.RequireFullAdmin di router.go).
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
		out = append(out, AdminUserDTO{
			ID: row.ID, Username: row.Username, Role: string(row.Role),
			CreatedAt: row.CreatedAt.Format(time.RFC3339),
		})
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
	// Peran kosong pada Create = 'admin', mempertahankan perilaku klien lama
	// yang belum mengirim field ini (sejalan dengan DEFAULT kolomnya).
	role := in.Role
	if role == "" {
		role = RoleAdmin
	}
	if !validRoles[role] {
		return AdminUserDTO{}, ErrInvalidRole
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
	id, err := s.repo.Create(ctx, in.Username, string(hash), role)
	if err != nil {
		return AdminUserDTO{}, err
	}
	return AdminUserDTO{ID: uint64(id), Username: in.Username, Role: role, CreatedAt: time.Now().Format(time.RFC3339)}, nil
}

// Update juga bisa mengubah peran. Perubahan peran diperiksa canChangeRole
// SEBELUM ditulis (§2.3) - menurunkan admin penuh terakhir jadi petugas
// mengunci sistem sama persis seperti menghapusnya.
func (s *Service) Update(ctx context.Context, id uint64, in UpdateUserInput) error {
	if in.Username == "" {
		return ErrUsernameRequired
	}
	if in.Role != "" && !validRoles[in.Role] {
		return ErrInvalidRole
	}
	if existing, err := s.repo.GetByUsername(ctx, in.Username); err == nil {
		if existing.ID != id {
			return ErrUsernameTaken
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	// Role kosong = tidak diubah (sejalan dengan Password kosong), jadi tidak
	// ada yang perlu dijaga.
	if in.Role != "" {
		target, err := s.repo.GetByID(ctx, id)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrUserNotFound
			}
			return err
		}
		currentRole := string(target.Role)
		if currentRole != in.Role {
			fullAdmins, err := s.repo.CountFullAdmins(ctx)
			if err != nil {
				return err
			}
			if err := canChangeRole(currentRole, in.Role, int(fullAdmins)); err != nil {
				return err
			}
			if err := s.repo.UpdateRole(ctx, id, in.Role); err != nil {
				return err
			}
		}
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
// sedang login, dan menghapus admin PENUH terakhir - keduanya mengunci
// sistem.
//
// Penghitungnya CountFullAdmins, BUKAN Count (§2.3): sejak ada akun petugas,
// menghitung seluruh baris membuat admin penuh terakhir lolos dihapus.
// Count() tetap ada dan tetap dipakai paginasi List - hanya guardrail ini
// yang pindah.
func (s *Service) Delete(ctx context.Context, id, currentAdminID uint64) error {
	if id == currentAdminID {
		return ErrCannotDeleteSelf
	}
	target, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrUserNotFound
		}
		return err
	}
	fullAdmins, err := s.repo.CountFullAdmins(ctx)
	if err != nil {
		return err
	}
	if err := canDeleteAdmin(string(target.Role), int(fullAdmins)); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

// StatusHTTPCode memetakan error domain ke status HTTP - dipakai presentation,
// pola sama seperti guest/application/service.go.
func StatusHTTPCode(err error) int {
	switch {
	case errors.Is(err, ErrUserNotFound):
		return 404
	case errors.Is(err, ErrUsernameRequired), errors.Is(err, ErrPasswordTooShort),
		errors.Is(err, ErrUsernameTaken), errors.Is(err, ErrCannotDeleteSelf),
		errors.Is(err, ErrCannotDeleteLastAdmin), errors.Is(err, ErrCannotDemoteLastAdmin),
		errors.Is(err, ErrInvalidRole):
		return 400
	default:
		return 500
	}
}
