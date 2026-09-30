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

// SendInvitationInput membawa data undangan manual per tamu (tombol kirim di
// menu Tamu). Link + CoupleName/EventDateLabel dipasok pemanggil (modul guest
// yang sudah memegang baris tamu & InvitationInfoProvider), template
// invitation_template dibaca modul ini sendiri - pola yang sama dengan
// SendQRInput: modul whatsapp tidak pernah membaca tabel milik modul lain.
type SendInvitationInput struct {
	GuestID        uint64
	GuestName      string
	Phone          string
	Link           string // untuk placeholder {link}
	CoupleName     string // untuk placeholder {mempelai}
	EventDateLabel string // untuk placeholder {tanggal}
}

// PreviewInvitationInput sama dengan SendInvitationInput tanpa identitas
// pengiriman - dipakai modal preview sebelum admin menekan Kirim.
type PreviewInvitationInput struct {
	GuestName      string
	Link           string
	CoupleName     string
	EventDateLabel string
}

type Sender interface {
	SendQR(ctx context.Context, in SendQRInput) error
	// PreviewInvitation me-render invitation_template apa adanya (tanpa
	// menyentuh koneksi) - source of truth untuk modal preview.
	PreviewInvitation(ctx context.Context, in PreviewInvitationInput) (string, error)
	// SendInvitation mengirim undangan sebagai pesan TEKS sinkron (tanpa
	// antrean retry, tanpa baris send_logs): gagal = error langsung untuk
	// ditampilkan di modal, sukses ditandai pemanggil via contacted_at.
	SendInvitation(ctx context.Context, in SendInvitationInput) error
}
