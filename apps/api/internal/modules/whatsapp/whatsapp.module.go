package whatsapp

import (
	"context"
	"database/sql"

	"undangan-ariana-adrian/internal/modules/whatsapp/application"
	"undangan-ariana-adrian/internal/modules/whatsapp/contracts"
	"undangan-ariana-adrian/internal/modules/whatsapp/infrastructure"
	"undangan-ariana-adrian/internal/modules/whatsapp/presentation"
)

// New merangkai modul whatsapp: waclient (sesi SQLite terpisah) + repository
// (MySQL, config & log) -> service -> handler. storeDBPath adalah file
// SQLite di WA_STORE_DIR - TERPISAH dari db MySQL project, karena whatsmeow
// tidak mendukung MySQL (PLAN.md dashboard-wa-rsvp §2). Juga mengembalikan
// contracts.Sender untuk di-inject ke modul guest (keputusan #8).
func New(db *sql.DB, storeDBPath string) (*presentation.Handler, contracts.Sender, error) {
	waClient, err := infrastructure.NewWAClient(context.Background(), storeDBPath)
	if err != nil {
		return nil, nil, err
	}
	repo := infrastructure.NewRepository(db)
	service := application.NewService(repo, waClient)
	return presentation.NewHandler(service), service, nil
}
