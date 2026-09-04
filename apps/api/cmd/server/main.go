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
	"undangan-ariana-adrian/internal/shared/storage"
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

	storageClient, err := storage.New(storage.Config{
		Endpoint:  cfg.S3Endpoint,
		Bucket:    cfg.S3Bucket,
		AccessKey: cfg.S3AccessKey,
		SecretKey: cfg.S3SecretKey,
		UseSSL:    cfg.S3UseSSL,
	})
	if err != nil {
		log.Fatalf("failed to create object storage client: %v", err)
	}

	authHandler := auth.New(db, cfg.JWTSecret, cfg.JWTExpiresIn)
	// content dirakit sebelum guest - guest butuh contracts.InvitationInfoProvider
	// milik content untuk menyusun teks QR (PLAN.md dashboard-wa-rsvp keputusan #19).
	contentHandler, invitationInfo := content.New(db, storageClient)
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
		Storage:         storageClient,
		// invitationInfo yang sama yang dipakai guest.New di atas - router
		// memakainya untuk menyuntikkan meta Open Graph ke index.html
		// (docs/plan/og-share-image-dinamis/PLAN.md T8), lewat contracts/,
		// bukan internal modul content.
		InvitationInfo: invitationInfo,
	})

	log.Printf("api listening on :%s (env=%s)", cfg.AppPort, cfg.AppEnv)
	log.Fatal(http.ListenAndServe(":"+cfg.AppPort, mux))
}
