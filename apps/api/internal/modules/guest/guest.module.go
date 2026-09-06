package guest

import (
	"database/sql"

	contentContracts "undangan-digital/internal/modules/content/contracts"
	"undangan-digital/internal/modules/guest/application"
	"undangan-digital/internal/modules/guest/infrastructure"
	"undangan-digital/internal/modules/guest/presentation"
	waContracts "undangan-digital/internal/modules/whatsapp/contracts"
)

// New merangkai modul guest: repository -> service -> handler. sender &
// invitationInfo diterima lewat contracts modul lain (PLAN.md dashboard-
// wa-rsvp keputusan #8/#19) - sender boleh nil (deployment tanpa WhatsApp).
func New(db *sql.DB, sender waContracts.Sender, invitationInfo contentContracts.InvitationInfoProvider) *presentation.Handler {
	repo := infrastructure.NewRepository(db)
	service := application.NewService(repo, sender, invitationInfo)
	return presentation.NewHandler(service)
}
