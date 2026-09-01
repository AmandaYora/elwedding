package content

import (
	"database/sql"

	"undangan-ariana-adrian/internal/modules/content/application"
	"undangan-ariana-adrian/internal/modules/content/contracts"
	"undangan-ariana-adrian/internal/modules/content/infrastructure"
	"undangan-ariana-adrian/internal/modules/content/presentation"
)

// New merangkai modul content: repository -> service -> handler. Sejak
// dashboard-wa-rsvp keputusan #19, juga mengembalikan
// contracts.InvitationInfoProvider - satu-satunya cara modul guest
// memperoleh info undangan untuk menyusun teks QR.
func New(db *sql.DB, uploadsDir string) (*presentation.Handler, contracts.InvitationInfoProvider) {
	repo := infrastructure.NewRepository(db)
	service := application.NewService(repo, uploadsDir)
	return presentation.NewHandler(service), service
}
