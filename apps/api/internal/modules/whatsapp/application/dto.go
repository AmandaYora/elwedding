package application

// WhatsAppStatusDTO - kontrak GET /api/v1/admin/whatsapp/status. PairingQR
// terisi hanya selama pairing berlangsung dan belum sukses (PLAN.md §6.4).
type WhatsAppStatusDTO struct {
	LoggedIn     bool   `json:"loggedIn"`
	Pairing      bool   `json:"pairing"`
	PairingQR    string `json:"pairingQR"`
	PairingError string `json:"pairingError"`
}

type WhatsAppConfigDTO struct {
	MessageTemplate string `json:"messageTemplate"`
	IsEnabled       bool   `json:"isEnabled"`
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
