// Package contracts adalah satu-satunya permukaan modul content yang boleh
// diimpor modul lain (PLAN.md docs/plan/dashboard-wa-rsvp keputusan #19).
// Modul guest memakai ini untuk menyusun teks QR tanpa membaca tabel
// invitation_content secara langsung - melanggar itu berarti melanggar
// aturan modular monolith (.claude/rules/backend-modular-monolith.md).
package contracts

import "context"

// QRInfo membawa hanya field yang dibutuhkan untuk menyusun teks QR & isi
// template pesan WhatsApp - bukan seluruh InvitationContentDTO.
type QRInfo struct {
	BrideName        string
	GroomName        string
	WeddingDateLabel string
}

// ShareInfo membawa hanya field yang dibutuhkan paket router untuk menyusun
// meta Open Graph halaman undangan (docs/plan/og-share-image-dinamis/PLAN.md
// D4) - sengaja TERPISAH dari QRInfo, yang dinamai & dibatasi untuk keperluan
// QR. Menitipkan URL gambar share ke QRInfo akan mengaburkan maksud keduanya.
type ShareInfo struct {
	BrideName        string
	GroomName        string
	WeddingDateLabel string

	// ShareImageUrl '' bila admin belum mengunggah gambar preview.
	ShareImageUrl string

	// CoverImageUrl adalah fallback bila ShareImageUrl kosong (K4).
	//
	// PERINGATAN: nilai ini TIDAK DIJAMIN berupa gambar. Kolom cover boleh
	// berisi video (.mp4/.webm - migration 000010 pernah benar-benar
	// menyetelnya begitu) maupun .webp yang tidak dirender crawler WhatsApp.
	// Pemakainya WAJIB menyaring ekstensi sebelum memasangnya sebagai
	// og:image - lihat isWaCompatibleImage di internal/router/og_meta.go.
	CoverImageUrl string
}

type InvitationInfoProvider interface {
	GetQRInfo(ctx context.Context) (QRInfo, error)
	GetShareInfo(ctx context.Context) (ShareInfo, error)
}
