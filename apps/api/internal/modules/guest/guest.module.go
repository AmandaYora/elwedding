package guest

import (
	"database/sql"

	contentContracts "undangan-digital/internal/modules/content/contracts"
	"undangan-digital/internal/modules/guest/application"
	"undangan-digital/internal/modules/guest/infrastructure"
	"undangan-digital/internal/modules/guest/presentation"
	tgContracts "undangan-digital/internal/modules/telegram/contracts"
	waContracts "undangan-digital/internal/modules/whatsapp/contracts"
)

// New merangkai modul guest: repository -> service -> handler. sender,
// tgSender & invitationInfo diterima lewat contracts modul lain (PLAN.md
// dashboard-wa-rsvp keputusan #8/#19) - keduanya boleh nil (deployment tanpa
// WhatsApp/Telegram).
func New(db *sql.DB, sender waContracts.Sender, tgSender tgContracts.Sender, invitationInfo contentContracts.InvitationInfoProvider) *presentation.Handler {
	repo := infrastructure.NewRepository(db)
	service := application.NewService(repo, sender, tgSender, invitationInfo)
	return presentation.NewHandler(service)
}
