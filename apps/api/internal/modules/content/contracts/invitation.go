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

type InvitationInfoProvider interface {
	GetQRInfo(ctx context.Context) (QRInfo, error)
}
