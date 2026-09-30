// Package contracts adalah satu-satunya permukaan modul telegram yang boleh
// diimpor modul lain (.claude/rules/backend-modular-monolith.md).
// Modul guest memakai ini untuk memicu pengiriman QR tanpa modul telegram
// pernah tahu ada tabel guests - cermin contracts/ milik modul whatsapp.
package contracts

import "context"

// SendTGInput membawa semua data yang dibutuhkan modul telegram untuk
// mengirim & mencatat log, termasuk CoupleName/EventDateLabel supaya modul
// telegram tidak perlu bergantung pada modul content - pola yang sama dengan
// whatsapp/contracts.SendQRInput.
type SendTGInput struct {
	GuestID          uint64
	GuestName        string
	TelegramUsername string // tanpa @, sudah dinormalisasi di modul guest
	QRPayload        string
	CoupleName       string // untuk placeholder {mempelai}
	EventDateLabel   string // untuk placeholder {tanggal}
	AttendingCount   int    // untuk placeholder {jumlah}
}

// SendInvitationInput membawa data undangan manual per tamu (tombol kirim di
// menu Tamu). Link + CoupleName/EventDateLabel dipasok pemanggil (modul guest
// yang sudah memegang baris tamu & InvitationInfoProvider), template
// invitation_template dibaca modul ini sendiri - pola yang sama dengan
// SendTGInput: modul telegram tidak pernah membaca tabel milik modul lain.
type SendInvitationInput struct {
	GuestID          uint64
	GuestName        string
	TelegramUsername string // tanpa @, sudah dinormalisasi di modul guest
	Link             string // untuk placeholder {link}
	CoupleName       string // untuk placeholder {mempelai}
	EventDateLabel   string // untuk placeholder {tanggal}
}

// PreviewInvitationInput sama dengan SendInvitationInput tanpa identitas
// pengiriman - dipakai modal preview sebelum admin menekan Kirim.
type PreviewInvitationInput struct {
	GuestName        string
	TelegramUsername string
	Link             string
	CoupleName       string
	EventDateLabel   string
}

type Sender interface {
	SendQR(ctx context.Context, in SendTGInput) error
	// PreviewInvitation me-render invitation_template apa adanya (tanpa
	// menyentuh koneksi) - source of truth untuk modal preview.
	PreviewInvitation(ctx context.Context, in PreviewInvitationInput) (string, error)
	// SendInvitation mengirim undangan sebagai pesan TEKS sinkron (tanpa
	// antrean retry, tanpa baris send_logs): gagal = error langsung untuk
	// ditampilkan di modal, sukses ditandai pemanggil via contacted_at.
	SendInvitation(ctx context.Context, in SendInvitationInput) error
}
