// Package contracts adalah satu-satunya permukaan modul whatsapp yang boleh
// diimpor modul lain (PLAN.md docs/plan/dashboard-wa-rsvp keputusan #8).
// Modul guest memakai ini untuk memicu pengiriman QR tanpa modul whatsapp
// pernah tahu ada tabel guests.
package contracts

import "context"

// SendQRInput membawa semua data yang dibutuhkan modul whatsapp untuk
// mengirim & mencatat log, termasuk CoupleName/EventDateLabel (keputusan
// #19) supaya modul whatsapp tidak perlu bergantung pada modul content.
type SendQRInput struct {
	GuestID        uint64
	GuestName      string
	Phone          string
	QRPayload      string
	CoupleName     string // untuk placeholder {mempelai}
	EventDateLabel string // untuk placeholder {tanggal}
	AttendingCount int    // untuk placeholder {jumlah} - ditambah migration 000009
}

type Sender interface {
	SendQR(ctx context.Context, in SendQRInput) error
}
