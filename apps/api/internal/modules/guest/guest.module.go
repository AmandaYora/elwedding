package guest

import (
	"database/sql"

	contentContracts "undangan-ariana-adrian/internal/modules/content/contracts"
	"undangan-ariana-adrian/internal/modules/guest/application"
	"undangan-ariana-adrian/internal/modules/guest/infrastructure"
	"undangan-ariana-adrian/internal/modules/guest/presentation"
	waContracts "undangan-ariana-adrian/internal/modules/whatsapp/contracts"
)

// New merangkai modul guest: repository -> service -> handler. sender &
// invitationInfo diterima lewat contracts modul lain (PLAN.md dashboard-
// wa-rsvp keputusan #8/#19) - sender boleh nil (deployment tanpa WhatsApp).
func New(db *sql.DB, sender waContracts.Sender, invitationInfo contentContracts.InvitationInfoProvider) *presentation.Handler {
	repo := infrastructure.NewRepository(db)
	service := application.NewService(repo, sender, invitationInfo)
	return presentation.NewHandler(service)
}
