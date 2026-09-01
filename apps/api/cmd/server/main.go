package main

import (
	"log"
	"net/http"

	"github.com/joho/godotenv"

	"undangan-ariana-adrian/internal/config"
	"undangan-ariana-adrian/internal/database"
	"undangan-ariana-adrian/internal/modules/auth"
	"undangan-ariana-adrian/internal/modules/content"
	"undangan-ariana-adrian/internal/modules/guest"
	"undangan-ariana-adrian/internal/modules/whatsapp"
	"undangan-ariana-adrian/internal/router"
)

func main() {
	// .env ada di root repo; API berjalan dari apps/api. Error diabaikan:
	// di container env datang dari env_file (docker-compose.yml).
	_ = godotenv.Load("../../.env")
	_ = godotenv.Load(".env")

	cfg := config.Load()

	db, err := database.Open(cfg.DBDSN)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer db.Close()

	authHandler := auth.New(db, cfg.JWTSecret, cfg.JWTExpiresIn)
	// content dirakit sebelum guest - guest butuh contracts.InvitationInfoProvider
	// milik content untuk menyusun teks QR (PLAN.md dashboard-wa-rsvp keputusan #19).
	contentHandler, invitationInfo := content.New(db, cfg.UploadsDir)
	// whatsapp dirakit sebelum guest - guest butuh contracts.Sender milik
	// whatsapp untuk memicu kirim QR (keputusan #8). Kegagalan modul WhatsApp
	// TIDAK menghentikan boot API - sender tetap nil, RSVP tetap berjalan
	// tanpa pengiriman WhatsApp (dicek nil di guest/application/service.go).
	whatsappHandler, sender, err := whatsapp.New(db, cfg.WAStoreDBPath)
	if err != nil {
		log.Printf("whatsapp: modul tidak aktif (%v) - RSVP tetap berjalan tanpa kirim QR otomatis", err)
	}
	guestHandler := guest.New(db, sender, invitationInfo)

	mux := router.New(router.Deps{
		AuthHandler:     authHandler,
		ContentHandler:  contentHandler,
		GuestHandler:    guestHandler,
		WhatsAppHandler: whatsappHandler,
		JWTSecret:       cfg.JWTSecret,
		PublicDir:       cfg.PublicDir,
		UploadsDir:      cfg.UploadsDir,
	})

	log.Printf("api listening on :%s (env=%s)", cfg.AppPort, cfg.AppEnv)
	log.Fatal(http.ListenAndServe(":"+cfg.AppPort, mux))
}
