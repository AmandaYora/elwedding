package application

// WhatsAppStatusDTO - kontrak GET /api/v1/admin/whatsapp/status. PairingQR
// terisi hanya selama pairing berlangsung dan belum sukses (PLAN.md §6.4).
type WhatsAppStatusDTO struct {
	LoggedIn     bool   `json:"loggedIn"`
	Pairing      bool   `json:"pairing"`
	PairingQR    string `json:"pairingQR"`
	PairingError string `json:"pairingError"`
}

// WhatsAppConfigDTO dipakai KEDUA arah - GetConfig mengembalikannya dan
// UpdateConfig menerimanya sebagai input - jadi cukup satu struct, beda dari
// modul content yang punya DTO baca & input tulis terpisah. Konsekuensinya:
// setiap field baru WAJIB dipetakan di dua tempat pada service.go (baca DAN
// tulis); melewatkan salah satunya membuat field hilang senyap di satu arah.
type WhatsAppConfigDTO struct {
	// MessageTemplate: jalur QR otomatis lewat whatsmeow (applyTemplate).
	MessageTemplate string `json:"messageTemplate"`
	// InvitationTemplate: tombol "Kirim Undangan" per tamu, yang murni klien
	// lewat wa.me dan TIDAK menyentuh modul whatsapp (docs/plan/
	// og-share-image-dinamis/PLAN.md D10/D11). Placeholder-nya {nama},
	// {mempelai}, {tanggal}, {link} - TANPA {jumlah} (K5), karena saat
	// undangan dikirim tamu belum RSVP.
	InvitationTemplate string `json:"invitationTemplate"`
	// IsEnabled HANYA mengatur jalur QR otomatis (D12). Tombol Kirim
	// Undangan sengaja TIDAK ikut toggle ini - kalau disamakan, mematikan
	// auto-send QR akan diam-diam melumpuhkan tombolnya tanpa penjelasan.
	IsEnabled bool `json:"isEnabled"`
}

type SendLogDTO struct {
	ID             uint64  `json:"id"`
	GuestID        uint64  `json:"guestId"`
	GuestName      string  `json:"guestName"`
	Phone          string  `json:"phone"`
	AttendingCount int     `json:"attendingCount"`
	Status         string  `json:"status"`
	ErrorMessage   *string `json:"errorMessage"`
	SentAt         *string `json:"sentAt"`
	CreatedAt      string  `json:"createdAt"`
}
