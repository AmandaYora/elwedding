package application

// TelegramStatusDTO - kontrak GET /api/v1/admin/telegram/status.
//
// Beda dari WhatsAppStatusDTO: tidak ada PairingQR (login userbot memakai
// kode OTP yang dikirim ke nomor HP + password 2FA, bukan scan QR) dan tidak
// ada pemisahan connected/socket yang persisten - klien one-shot terhubung
// per operasi. LoggedIn = sesi tersimpan & masih sah; Connected = pemeriksaan
// terakhir berhasil terhubung (diperbarui tiap Status/Send).
type TelegramStatusDTO struct {
	LoggedIn     bool   `json:"loggedIn"`
	Connected    bool   `json:"connected"`
	LoginPending bool   `json:"loginPending"`
	LoginError   string `json:"loginError"`
	// LastConnectedAt RFC3339, string kosong bila belum pernah terhubung
	// sejak boot. LastError alasan gangguan terakhir, kosong bila sehat.
	LastConnectedAt string `json:"lastConnectedAt"`
	LastError       string `json:"lastError"`
}

// TelegramConfigDTO dipakai KEDUA arah - GetConfig mengembalikannya dan
// UpdateConfig menerimanya sebagai input - pola WhatsAppConfigDTO.
type TelegramConfigDTO struct {
	// MessageTemplate: jalur QR otomatis lewat userbot (applyTemplate).
	// Placeholder: {nama}, {jumlah}, {mempelai}, {tanggal} - SAMA dengan
	// jalur WA supaya admin tidak menghafal dua kamus.
	MessageTemplate string `json:"messageTemplate"`
	// InvitationTemplate: tombol kirim undangan manual per tamu di menu Tamu
	// (applyInvitationTemplate, dikirim sebagai TEKS via userbot). Placeholder:
	// {nama}, {mempelai}, {tanggal}, {link} - TANPA {jumlah}, karena saat
	// undangan dikirim tamu belum RSVP (K5 og-share-image-dinamis). Cermin
	// invitationTemplate milik whatsapp_config (migration 000013/000024).
	InvitationTemplate string `json:"invitationTemplate"`
	// IsEnabled mengatur jalur QR otomatis Telegram.
	IsEnabled bool `json:"isEnabled"`
}

// TelegramLoginStartDTO - respons POST /api/v1/admin/telegram/login/start:
// kode OTP sudah dikirim Telegram ke nomor HP akun userbot; admin
// memasukkannya lewat login/complete. PhoneCodeHash TIDAK dikembalikan ke
// klien - disimpan di memori service (jalur complete mengambilnya dari sana).
type TelegramLoginStartDTO struct {
	Phone string `json:"phone"`
}

// TelegramLoginCompleteInput - body POST .../login/complete. Password
// dikirim HANYA bila respons sebelumnya menandakan 2FA dibutuhkan
// (lihat ErrPasswordNeeded).
type TelegramLoginCompleteInput struct {
	Code     string `json:"code"`
	Password string `json:"password"`
}

type SendLogDTO struct {
	ID               uint64  `json:"id"`
	GuestID          uint64  `json:"guestId"`
	GuestName        string  `json:"guestName"`
	TelegramUsername string  `json:"telegramUsername"`
	AttendingCount   int     `json:"attendingCount"`
	Status           string  `json:"status"`
	ErrorMessage     *string `json:"errorMessage"`
	SentAt           *string `json:"sentAt"`
	CreatedAt        string  `json:"createdAt"`
}
