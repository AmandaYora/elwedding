package content

import (
	"database/sql"

	"undangan-digital/internal/modules/content/application"
	"undangan-digital/internal/modules/content/contracts"
	"undangan-digital/internal/modules/content/infrastructure"
	"undangan-digital/internal/modules/content/presentation"
	"undangan-digital/internal/shared/storage"
)

// New merangkai modul content: repository -> service -> handler. Sejak
// dashboard-wa-rsvp keputusan #19, juga mengembalikan
// contracts.InvitationInfoProvider - satu-satunya cara modul guest
// memperoleh info undangan untuk menyusun teks QR.
func New(db *sql.DB, storageClient *storage.Client) (*presentation.Handler, contracts.InvitationInfoProvider) {
	repo := infrastructure.NewRepository(db)
	service := application.NewService(repo, storageClient)
	return presentation.NewHandler(service), service
}
