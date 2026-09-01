package application

type AdminUserDTO struct {
	ID        uint64 `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"createdAt"`
}

type CreateUserInput struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type UpdateUserInput struct {
	Username string `json:"username"`
	Password string `json:"password"` // kosong = tidak diganti
}
