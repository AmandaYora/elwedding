// Package router mendaftarkan seluruh route (PLAN.md §5.1) dan menangani
// fallback SPA sesuai keputusan #10 (dua entry HTML terpisah) dan keputusan
// #17/F17 (fallback HANYA untuk GET - non-GET ke path tak dikenal harus
// selalu JSON 404, supaya request POST dari bundle legacy tidak pernah
// menerima balasan HTML yang bisa memicu penulisan DOM React - lihat
// PLAN.md §2.5).
package router

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	authPresentation "undangan-ariana-adrian/internal/modules/auth/presentation"
	// contracts/ adalah permukaan PUBLIK modul content - satu-satunya yang
	// boleh diimpor modul lain (.claude/rules/backend-modular-monolith.md).
	// Internal content (application/infrastructure/domain) tetap terlarang;
	// lihat juga contentTypeByExt di bawah yang sengaja disalin, bukan
	// diimpor, karena tidak ada di contracts.
	contentContracts "undangan-ariana-adrian/internal/modules/content/contracts"
	contentPresentation "undangan-ariana-adrian/internal/modules/content/presentation"
	guestPresentation "undangan-ariana-adrian/internal/modules/guest/presentation"
	whatsappPresentation "undangan-ariana-adrian/internal/modules/whatsapp/presentation"
	"undangan-ariana-adrian/internal/shared/authmw"
	"undangan-ariana-adrian/internal/shared/response"
	"undangan-ariana-adrian/internal/shared/storage"
)

type Deps struct {
	AuthHandler     *authPresentation.Handler
	ContentHandler  *contentPresentation.Handler
	GuestHandler    *guestPresentation.Handler
	WhatsAppHandler *whatsappPresentation.Handler
	JWTSecret       string
	PublicDir       string
	Storage         *storage.Client
	// InvitationInfo BOLEH nil (D6): bila nil, index.html disajikan apa
	// adanya tanpa injeksi meta OG. Itu jalur dev & jalur aman produksi.
	InvitationInfo contentContracts.InvitationInfoProvider
}

// contentTypeByExt: salinan kecil khusus paket router, BUKAN impor dari
// content/application (tidak diekspor & lintas modul dilarang -
// .claude/rules/backend-modular-monolith.md). 7 key sama persis dengan
// whitelist upload di content/application/service_upload.go.
var contentTypeByExt = map[string]string{
	".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
	".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
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
	// Jalur image-only base64 (docs/plan/admin-content-upload-base64/PLAN.md
	// keputusan K1/K5) - berdampingan dengan upload multipart di atas, yang
	// tetap dipakai audio (K2). Sama-sama di belakang RequireAdmin lewat mux
	// admin di bawah.
	admin.HandleFunc("POST /api/v1/admin/uploads/base64", d.ContentHandler.UploadImageBase64)

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

	// --- admin: group tamu (JWT) - docs/plan/guest-groups/PLAN.md T9 ---
	// Didaftarkan di mux `admin`, yang seluruhnya dijaga RequireFullAdmin di
	// bawah. JANGAN memindahkannya ke mux ROOT seperti checkin/* - itu justru
	// membuka pengelolaan group untuk akun petugas gate (D10/§2.4). Petugas
	// MELIHAT nama group di hasil scan (ikut di dalam respons check-in), bukan
	// dengan memanggil endpoint ini.
	admin.HandleFunc("GET /api/v1/admin/groups", d.GuestHandler.ListGroups)
	admin.HandleFunc("POST /api/v1/admin/groups", d.GuestHandler.CreateGroup)
	admin.HandleFunc("PUT /api/v1/admin/groups/{id}", d.GuestHandler.UpdateGroup)
	admin.HandleFunc("DELETE /api/v1/admin/groups/{id}", d.GuestHandler.DeleteGroup)

	// --- admin: whatsapp (JWT) - PLAN.md dashboard-wa-rsvp keputusan #4 ---
	admin.HandleFunc("GET /api/v1/admin/whatsapp/status", d.WhatsAppHandler.GetStatus)
	admin.HandleFunc("POST /api/v1/admin/whatsapp/pair/start", d.WhatsAppHandler.StartPairing)
	admin.HandleFunc("POST /api/v1/admin/whatsapp/logout", d.WhatsAppHandler.Logout)
	admin.HandleFunc("GET /api/v1/admin/whatsapp/config", d.WhatsAppHandler.GetConfig)
	admin.HandleFunc("PUT /api/v1/admin/whatsapp/config", d.WhatsAppHandler.UpdateConfig)
	admin.HandleFunc("GET /api/v1/admin/whatsapp/logs", d.WhatsAppHandler.ListLogs)
	admin.HandleFunc("POST /api/v1/admin/whatsapp/logs/{id}/resend", d.WhatsAppHandler.ResendLog)

	// --- admin: check-in di gate (docs/plan/scan-checkin-gate/PLAN.md T9/D6) ---
	// Didaftarkan langsung di mux ROOT sebagai pola SPESIFIK, bukan lewat mux
	// `admin` di atas, dan itu yang membuat kelimanya lolos ke petugas gate:
	// Go 1.22+ ServeMux memilih pola paling spesifik, sehingga
	// "POST /api/v1/admin/checkin/scan" menang atas prefix "/api/v1/admin/"
	// yang dijaga RequireFullAdmin di bawah. Mekanismenya sama persis dengan
	// GET /guests/summary vs PUT /guests/{id} (lihat komentar di atas).
	//
	// JANGAN "dirapikan" dengan memindahkannya ke dalam mux `admin` atau
	// menukar urutannya - akun petugas akan langsung kehilangan menu Scan.
	// Literal "checkin/scan", "checkin/search", "checkin/arrivals" &
	// "checkin/summary" juga menang atas "checkin/{id}".
	//
	// Penjaganya RequireAdmin (petugas MAUPUN admin penuh boleh), bukan
	// RequireFullAdmin.
	scanAuth := authmw.RequireAdmin(d.JWTSecret)
	mux.Handle("POST /api/v1/admin/checkin/scan", scanAuth(http.HandlerFunc(d.GuestHandler.CheckinByQR)))
	mux.Handle("GET /api/v1/admin/checkin/search", scanAuth(http.HandlerFunc(d.GuestHandler.SearchForCheckin)))
	mux.Handle("GET /api/v1/admin/checkin/arrivals", scanAuth(http.HandlerFunc(d.GuestHandler.ListArrivals)))
	mux.Handle("GET /api/v1/admin/checkin/summary", scanAuth(http.HandlerFunc(d.GuestHandler.GetCheckinSummary)))
	mux.Handle("POST /api/v1/admin/checkin/{id}", scanAuth(http.HandlerFunc(d.GuestHandler.CheckinByID)))

	// Seluruh sisa /api/v1/admin/ kini butuh admin PENUH (T9/D7): akun
	// petugas hanya boleh memindai, tidak boleh mengubah konten atau
	// menghapus tamu (K2). Ini penegakan yang sebenarnya - penyaringan menu
	// di frontend murni kosmetik.
	mux.Handle("/api/v1/admin/", authmw.RequireFullAdmin(d.JWTSecret)(admin))

	// --- foto/musik yang diunggah admin (keputusan #12, dipindah ke object
	// storage S3 - docs/plan/content-uploads-object-storage/PLAN.md) ---
	mux.HandleFunc("GET /uploads/{category}/{filename}", func(w http.ResponseWriter, r *http.Request) {
		category := r.PathValue("category")
		filename := r.PathValue("filename")
		if category != "images" && category != "audio" {
			response.NotFoundJSON(w, r)
			return
		}

		reader, err := d.Storage.Open(r.Context(), "elwedding/upload/"+category+"/"+filename)
		if err != nil {
			if errors.Is(err, storage.ErrNotFound) {
				response.NotFoundJSON(w, r)
				return
			}
			response.Internal(w, "Failed to fetch file")
			return
		}
		defer reader.Close()

		// ServeContent (BUKAN io.Copy) memberi dukungan HTTP Range/206
		// Partial Content secara otomatis - PENTING untuk musik latar yang
		// diputar lewat elemen <audio> native dengan preload="auto"
		// (fddf2641.js), yang butuh Range untuk buffer/seek (kritis di
		// Safari/iOS). Content-Type di-set eksplisit SEBELUM ServeContent
		// supaya dipakai apa adanya, bukan hasil sniffing. modtime kosong
		// (time.Time{}) - caching lewat Cache-Control immutable di bawah,
		// bukan Last-Modified (nama file sudah unik per upload, aman
		// di-cache permanen).
		if ct, ok := contentTypeByExt[strings.ToLower(filepath.Ext(filename))]; ok {
			w.Header().Set("Content-Type", ct)
		}
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		http.ServeContent(w, r, filename, time.Time{}, reader)
	})

	// Segala path /uploads/* yang TIDAK cocok pola dua segmen di atas -
	// terutama URL skema LAMA yang cuma satu segmen (`/uploads/<file>.jpeg`,
	// bentuk 3 file legacy di produksi) - harus 404 JSON. Tanpa ini, path
	// tersebut jatuh ke SPA fallback "/" dan dibalas index.html dengan status
	// 200, sehingga <img> rusak tanpa sinyal error yang jelas (terbukti lewat
	// uploads_test.go: TestUploads_UrlLamaSatuSegmen_404BukanHTML).
	mux.HandleFunc("/uploads/", func(w http.ResponseWriter, r *http.Request) {
		response.NotFoundJSON(w, r)
	})

	// --- SPA fallback (keputusan #10 & #17) ---
	// WAJIB didaftarkan tanpa syarat - bukan hanya saat PublicDir terisi.
	// Kalau registrasi "/" digerbangi `if d.PublicDir != ""` (seperti draf
	// awal), maka di dev (PUBLIC_DIR kosong, frontend disajikan Vite -
	// lihat .env.example) TIDAK ADA handler "/" sama sekali, sehingga
	// permintaan non-GET ke path tak dikenal jatuh ke 404 bawaan
	// `http.ServeMux` (`text/plain`, BUKAN JSON) - persis mitigasi F17 yang
	// seharusnya dicegah. `spaFallback` sendiri yang memutuskan per
	// request apakah PublicDir valid untuk disajikan sebagai file statis.
	mux.Handle("/", spaFallback(d.PublicDir, d.InvitationInfo))

	return mux
}

// spaFallback menyajikan entry HTML SPA. `info` boleh nil - lihat Deps.
func spaFallback(publicDir string, info contentContracts.InvitationInfoProvider) http.Handler {
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
			if cc := cacheControlForPath(r.URL.Path); cc != "" {
				w.Header().Set("Cache-Control", cc)
			}
			fileServer.ServeHTTP(w, r)
			return
		}

		// /admin dan /admin/* -> admin.html (dashboard, entry Vite terpisah,
		// keputusan #10). Selain itu -> index.html (undangan tamu).
		entry := "index.html"
		if r.URL.Path == "/admin" || strings.HasPrefix(r.URL.Path, "/admin/") {
			entry = "admin.html"
		}
		// Entry HTML TIDAK BOLEH di-cache browser tanpa revalidasi - dia
		// mereferensikan nama bundle JS/CSS ber-hash (mis. main-BKYWYRkY.js)
		// yang berganti nama total tiap build. Setiap image baru berisi
		// dist/ yang benar-benar baru (Dockerfile meng-copy ulang, bukan
		// incremental) - hash lama TIDAK ada lagi di server. Tanpa header
		// ini, browser tamu bisa diam-diam menyajikan snapshot HTML+JS lama
		// dari cache lokal tanpa pernah menghubungi server sama sekali,
		// sehingga perubahan konten/deploy baru tidak pernah terlihat sampai
		// user hard-refresh manual (ditemukan langsung di production,
		// 2026-09-02). no-cache (bukan no-store) supaya browser tetap boleh
		// revalidasi lewat If-Modified-Since - request tetap ringan (304)
		// kalau memang belum berubah.
		w.Header().Set("Cache-Control", "no-cache, must-revalidate")

		entryPath := filepath.Join(publicDir, entry)

		// Injeksi meta Open Graph dinamis - docs/plan/og-share-image-dinamis
		// PLAN.md D1/T6. Ini SATU-SATUNYA tempat nilainya bisa benar: crawler
		// WhatsApp/Facebook tidak menjalankan JavaScript, jadi menambal
		// <meta> dari React tidak akan pernah terbaca, sedangkan nilainya
		// ada di DB dan index.html statis.
		//
		// Hanya index.html (undangan tamu) - admin.html tidak pernah
		// di-inject; dasbor tidak pernah dibagikan sebagai link preview.
		//
		// SETIAP kegagalan jatuh ke http.ServeFile statis di bawah, tidak
		// pernah error: DB mati, berkas gagal dibaca, marker hilang, atau
		// tidak ada nilai yang layak. Halaman undangan tidak boleh mati
		// hanya karena preview tidak bisa dipersonalisasi.
		if entry == "index.html" && info != nil {
			if injected, ok := renderIndexWithOgMeta(r, entryPath, info); ok {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				// SENGAJA tanpa Last-Modified/ETag dari mtime berkas: isinya
				// kini bergantung DB, jadi validator berbasis berkas akan
				// menyajikan preview basi setelah admin mengganti gambar
				// (itulah yang dilakukan http.ServeFile, dan alasan jalur ini
				// menulis byte-nya sendiri).
				_, _ = w.Write(injected)
				return
			}
		}

		http.ServeFile(w, r, entryPath)
	})
}

// renderIndexWithOgMeta membaca index.html lalu menyuntikkan meta OG dari DB.
// ok=false berarti "pakai jalur statis" - dipakai untuk SEMUA kegagalan,
// termasuk saat hasil injeksi tidak berbeda dari berkas aslinya.
func renderIndexWithOgMeta(r *http.Request, entryPath string, info contentContracts.InvitationInfoProvider) ([]byte, bool) {
	shareInfo, err := info.GetShareInfo(r.Context())
	if err != nil {
		return nil, false
	}

	raw, err := os.ReadFile(entryPath)
	if err != nil {
		return nil, false
	}
	if !hasOgMarkers(raw) {
		return nil, false
	}

	// Skema di-hardcode https + Host dari request (D5). Bukan tebakan:
	// nginx repo ini meneruskan Host (infra/nginx/nginx.conf) tapi TIDAK
	// menyetel X-Forwarded-Proto, dan r.TLS nil karena TLS diterminasi di
	// nginx - jadi skema memang tidak bisa dibaca dari request.
	origin := ""
	if r.Host != "" {
		origin = "https://" + r.Host
	}

	tags := buildOgTags(origin, shareInfo)
	if tags == "" {
		return nil, false
	}

	return injectOgMeta(raw, tags), true
}

func cacheControlForPath(path string) string {
	if strings.HasPrefix(path, "/assets/") {
		trimmed := strings.TrimPrefix(path, "/assets/")
		if !strings.Contains(trimmed, "/") && (strings.HasSuffix(trimmed, ".js") || strings.HasSuffix(trimmed, ".css")) {
			if strings.Contains(trimmed, "-") {
				return "public, max-age=31536000, immutable"
			}
		}
		return "public, max-age=2592000"
	}
	if strings.HasPrefix(path, "/media/") || strings.HasPrefix(path, "/vendor/") {
		return "public, max-age=2592000"
	}
	return ""
}
