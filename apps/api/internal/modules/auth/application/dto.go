package application

// Role pada DTO & input (docs/plan/scan-checkin-gate/PLAN.md T6/K2):
// "admin" = akses penuh, "scanner" = petugas gate yang HANYA boleh membuka
// menu Scan. Sebelum fitur ini semua admin setara/tanpa role - lihat
// migration 000015 untuk alasan pembalikannya.
type AdminUserDTO struct {
	ID        uint64 `json:"id"`
	Username  string `json:"username"`
	Role      string `json:"role"`
	CreatedAt string `json:"createdAt"`
}

type CreateUserInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// Role kosong di UpdateUserInput berarti "jangan ubah peran", sejalan dengan
// Password kosong yang berarti "jangan ganti password" - klien lama yang
// belum mengirim field ini tidak diam-diam menurunkan peran akun.
type UpdateUserInput struct {
	Username string `json:"username"`
	Password string `json:"password"` // kosong = tidak diganti
	Role     string `json:"role"`     // kosong = tidak diubah
}
