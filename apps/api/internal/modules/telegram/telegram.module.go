package telegram

import (
	"database/sql"

	"undangan-digital/internal/modules/telegram/application"
	"undangan-digital/internal/modules/telegram/contracts"
	"undangan-digital/internal/modules/telegram/infrastructure"
	"undangan-digital/internal/modules/telegram/presentation"
)

// TGConfig membawa kredensial userbot dari config.Load - dipisah dari
// *sql.DB supaya signature New tetap eksplisit tentang apa yang dibutuhkannya.
type TGConfig struct {
	AppID       int
	AppHash     string
	Phone       string
	SessionPath string
}

// New merangkai modul telegram: tgclient (sesi file JSON terpisah) +
// repository (MySQL, config & log) -> service -> handler. SessionPath adalah
// file sesi gotd/td di TG_SESSION_PATH - TERPISAH dari db MySQL project.
// Juga mengembalikan contracts.Sender untuk di-inject ke modul guest
// (pola whatsapp.New keputusan #8).
//
// Kegagalan di sini (mis. TG_API_ID belum diisi) TIDAK menghentikan boot API
// - pemanggil (main.go) melanjutkan dengan handler & sender nil, dan RSVP
// tetap berjalan tanpa kirim QR Telegram (dicek nil di
// guest/application/service.go).
func New(db *sql.DB, cfg TGConfig) (*presentation.Handler, contracts.Sender, error) {
	tgClient, err := infrastructure.NewTGClient(cfg.AppID, cfg.AppHash, cfg.Phone, cfg.SessionPath)
	if err != nil {
		return nil, nil, err
	}
	repo := infrastructure.NewRepository(db)
	service := application.NewService(repo, tgClient)
	return presentation.NewHandler(service), service, nil
}
