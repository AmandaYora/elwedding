package auth

import (
	"database/sql"
	"time"

	"undangan-digital/internal/modules/auth/application"
	"undangan-digital/internal/modules/auth/infrastructure"
	"undangan-digital/internal/modules/auth/presentation"
)

// New merangkai modul auth: repository -> service -> handler. Hanya
// presentation.Handler yang diekspor untuk dipasang router (mengikuti pola
// module wiring backend-modular-monolith.md).
func New(db *sql.DB, jwtSecret string, jwtExpiresIn time.Duration) *presentation.Handler {
	repo := infrastructure.NewRepository(db)
	service := application.NewService(repo, jwtSecret, jwtExpiresIn)
	return presentation.NewHandler(service)
}
