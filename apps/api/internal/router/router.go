// Package router mendaftarkan seluruh route (PLAN.md §5.1) dan menangani
// fallback SPA sesuai keputusan #10 (dua entry HTML terpisah) dan keputusan
// #17/F17 (fallback HANYA untuk GET - non-GET ke path tak dikenal harus
// selalu JSON 404, supaya request POST dari bundle legacy tidak pernah
// menerima balasan HTML yang bisa memicu penulisan DOM React - lihat
// PLAN.md §2.5).
package router

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	authPresentation "undangan-ariana-adrian/internal/modules/auth/presentation"
	contentPresentation "undangan-ariana-adrian/internal/modules/content/presentation"
	guestPresentation "undangan-ariana-adrian/internal/modules/guest/presentation"
	whatsappPresentation "undangan-ariana-adrian/internal/modules/whatsapp/presentation"
	"undangan-ariana-adrian/internal/shared/authmw"
	"undangan-ariana-adrian/internal/shared/response"
)

type Deps struct {
	AuthHandler     *authPresentation.Handler
	ContentHandler  *contentPresentation.Handler
	GuestHandler    *guestPresentation.Handler
	WhatsAppHandler *whatsappPresentation.Handler
	JWTSecret       string
	PublicDir       string
	UploadsDir      string
}

func New(d Deps) http.Handler {
	mux := http.NewServeMux()

	// --- health ---
	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		response.OK(w, "ok", nil)
	})

	// --- auth (publik) ---
	mux.HandleFunc("POST /api/v1/auth/login", d.AuthHandler.Login)

	// --- publik: undangan tamu ---
	mux.HandleFunc("GET /api/v1/public/invitation", d.ContentHandler.GetPublicInvitation)
	mux.HandleFunc("GET /api/v1/public/guests/by-token/{token}", d.GuestHandler.ResolveByToken)
	mux.HandleFunc("PATCH /api/v1/public/guests/by-token/{token}/rsvp", d.GuestHandler.UpdateRsvpStatus)

	// --- admin: content (JWT) ---
	admin := http.NewServeMux()
	admin.HandleFunc("GET /api/v1/admin/content", d.ContentHandler.GetContent)
	admin.HandleFunc("PATCH /api/v1/admin/content", d.ContentHandler.UpdateContent)

	admin.HandleFunc("GET /api/v1/admin/content/agenda-events", d.ContentHandler.ListAgendaEvents)
	admin.HandleFunc("POST /api/v1/admin/content/agenda-events", d.ContentHandler.CreateAgendaEvent)
	admin.HandleFunc("PUT /api/v1/admin/content/agenda-events/{id}", d.ContentHandler.UpdateAgendaEvent)
	admin.HandleFunc("DELETE /api/v1/admin/content/agenda-events/{id}", d.ContentHandler.DeleteAgendaEvent)

	admin.HandleFunc("GET /api/v1/admin/content/rundown-items", d.ContentHandler.ListRundownItems)
	admin.HandleFunc("POST /api/v1/admin/content/rundown-items", d.ContentHandler.CreateRundownItem)
	admin.HandleFunc("PUT /api/v1/admin/content/rundown-items/{id}", d.ContentHandler.UpdateRundownItem)
	admin.HandleFunc("DELETE /api/v1/admin/content/rundown-items/{id}", d.ContentHandler.DeleteRundownItem)

	admin.HandleFunc("GET /api/v1/admin/content/gallery-photos", d.ContentHandler.ListGalleryPhotos)
	admin.HandleFunc("POST /api/v1/admin/content/gallery-photos", d.ContentHandler.CreateGalleryPhoto)
	admin.HandleFunc("PUT /api/v1/admin/content/gallery-photos/{id}", d.ContentHandler.UpdateGalleryPhoto)
	admin.HandleFunc("DELETE /api/v1/admin/content/gallery-photos/{id}", d.ContentHandler.DeleteGalleryPhoto)

	admin.HandleFunc("GET /api/v1/admin/content/love-story-chapters", d.ContentHandler.ListLoveStoryChapters)
	admin.HandleFunc("POST /api/v1/admin/content/love-story-chapters", d.ContentHandler.CreateLoveStoryChapter)
	admin.HandleFunc("PUT /api/v1/admin/content/love-story-chapters/{id}", d.ContentHandler.UpdateLoveStoryChapter)
	admin.HandleFunc("DELETE /api/v1/admin/content/love-story-chapters/{id}", d.ContentHandler.DeleteLoveStoryChapter)

	admin.HandleFunc("GET /api/v1/admin/content/gift-banks", d.ContentHandler.ListWeddingGiftBanks)
	admin.HandleFunc("POST /api/v1/admin/content/gift-banks", d.ContentHandler.CreateWeddingGiftBank)
	admin.HandleFunc("PUT /api/v1/admin/content/gift-banks/{id}", d.ContentHandler.UpdateWeddingGiftBank)
	admin.HandleFunc("DELETE /api/v1/admin/content/gift-banks/{id}", d.ContentHandler.DeleteWeddingGiftBank)

	admin.HandleFunc("GET /api/v1/admin/sections", d.ContentHandler.ListSections)
	admin.HandleFunc("PATCH /api/v1/admin/sections", d.ContentHandler.UpdateSections)

	admin.HandleFunc("POST /api/v1/admin/uploads", d.ContentHandler.UploadPhoto)

	// --- admin: guests (JWT) ---
	// GET /guests/summary didaftarkan sebagai pola literal (bukan {id}) -
	// Go 1.22+ ServeMux memilih pola paling spesifik, jadi tidak bentrok
	// dengan PUT/DELETE /guests/{id} di bawahnya (admin-ui-redesign
	// PLAN.md task B7).
	admin.HandleFunc("GET /api/v1/admin/guests/summary", d.GuestHandler.GetSummary)
	admin.HandleFunc("GET /api/v1/admin/guests", d.GuestHandler.ListGuests)
	admin.HandleFunc("POST /api/v1/admin/guests", d.GuestHandler.CreateGuest)
	admin.HandleFunc("PUT /api/v1/admin/guests/{id}", d.GuestHandler.UpdateGuest)
	admin.HandleFunc("DELETE /api/v1/admin/guests/{id}", d.GuestHandler.DeleteGuest)

	// --- admin: users (JWT) - kelola akun admin (docs/plan/admin-users/PLAN.md) ---
	admin.HandleFunc("GET /api/v1/admin/users", d.AuthHandler.ListUsers)
	admin.HandleFunc("POST /api/v1/admin/users", d.AuthHandler.CreateUser)
	admin.HandleFunc("PUT /api/v1/admin/users/{id}", d.AuthHandler.UpdateUser)
	admin.HandleFunc("DELETE /api/v1/admin/users/{id}", d.AuthHandler.DeleteUser)

	// --- admin: whatsapp (JWT) - PLAN.md dashboard-wa-rsvp keputusan #4 ---
	admin.HandleFunc("GET /api/v1/admin/whatsapp/status", d.WhatsAppHandler.GetStatus)
	admin.HandleFunc("POST /api/v1/admin/whatsapp/pair/start", d.WhatsAppHandler.StartPairing)
	admin.HandleFunc("POST /api/v1/admin/whatsapp/logout", d.WhatsAppHandler.Logout)
	admin.HandleFunc("GET /api/v1/admin/whatsapp/config", d.WhatsAppHandler.GetConfig)
	admin.HandleFunc("PUT /api/v1/admin/whatsapp/config", d.WhatsAppHandler.UpdateConfig)
	admin.HandleFunc("GET /api/v1/admin/whatsapp/logs", d.WhatsAppHandler.ListLogs)
	admin.HandleFunc("POST /api/v1/admin/whatsapp/logs/{id}/resend", d.WhatsAppHandler.ResendLog)

	mux.Handle("/api/v1/admin/", authmw.RequireAdmin(d.JWTSecret)(admin))

	// --- foto/musik yang diunggah admin (keputusan #12) ---
	if d.UploadsDir != "" {
		mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir(d.UploadsDir))))
	}

	// --- SPA fallback (keputusan #10 & #17) ---
	// WAJIB didaftarkan tanpa syarat - bukan hanya saat PublicDir terisi.
	// Kalau registrasi "/" digerbangi `if d.PublicDir != ""` (seperti draf
	// awal), maka di dev (PUBLIC_DIR kosong, frontend disajikan Vite -
	// lihat .env.example) TIDAK ADA handler "/" sama sekali, sehingga
	// permintaan non-GET ke path tak dikenal jatuh ke 404 bawaan
	// `http.ServeMux` (`text/plain`, BUKAN JSON) - persis mitigasi F17 yang
	// seharusnya dicegah. `spaFallback` sendiri yang memutuskan per
	// request apakah PublicDir valid untuk disajikan sebagai file statis.
	mux.Handle("/", spaFallback(d.PublicDir))

	return mux
}

func spaFallback(publicDir string) http.Handler {
	fileServer := http.FileServer(http.Dir(publicDir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Keputusan #17 (F17/F20 PLAN.md): non-GET ke path tak dikenal
		// SELALU JSON 404, tidak pernah HTML. Ini mencegah POST dari bundle
		// legacy (fn_rsvp_init, wedding_gift_form, dst - §2.5 PLAN.md) yang
		// mem-POST ke URL halaman sendiri, kalau-kalau nyasar ke sini,
		// menerima balasan yang bisa memicu $(...).html(res) menghapus DOM
		// React atau window.location.reload(). Berlaku SELALU, termasuk
		// saat publicDir kosong/tidak valid (dev).
		if r.Method != http.MethodGet {
			response.NotFoundJSON(w, r)
			return
		}

		if publicDir == "" {
			response.NotFoundJSON(w, r)
			return
		}
		if _, err := os.Stat(publicDir); err != nil {
			response.NotFoundJSON(w, r)
			return
		}

		// File statis nyata (JS/CSS/gambar) disajikan apa adanya.
		cleanPath := filepath.Join(publicDir, filepath.Clean(r.URL.Path))
		if info, err := os.Stat(cleanPath); err == nil && !info.IsDir() {
			fileServer.ServeHTTP(w, r)
			return
		}

		// /admin dan /admin/* -> admin.html (dashboard, entry Vite terpisah,
		// keputusan #10). Selain itu -> index.html (undangan tamu).
		entry := "index.html"
		if r.URL.Path == "/admin" || strings.HasPrefix(r.URL.Path, "/admin/") {
			entry = "admin.html"
		}
		http.ServeFile(w, r, filepath.Join(publicDir, entry))
	})
}
