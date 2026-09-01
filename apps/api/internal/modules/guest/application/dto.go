package application

// GuestDTO - representasi admin (CRUD penuh, fitur #4/#6 PLAN.md).
// Field profil (guest-fields-admin-layout keputusan #12): Address/Notes
// dikembalikan sebagai string biasa (NULL->"") karena NULL vs "" tidak
// punya beda makna untuk keduanya. Gender tetap *string karena NULL di
// situ memang bermakna "belum diketahui" (keputusan #9).
// AttendingCount/IsExpectedAttending (dashboard-wa-rsvp keputusan #1/#2):
// IsExpectedAttending murni dugaan admin, terpisah dari RsvpStatus milik
// tamu. AttendingCount diisi TAMU saat RSVP 'attending', BUKAN oleh admin.
type GuestDTO struct {
	ID                  uint64  `json:"id"`
	Name                string  `json:"name"`
	Phone               string  `json:"phone"`
	Side                string  `json:"side"`
	Token               string  `json:"token"`
	RsvpStatus          string  `json:"rsvpStatus"`
	RsvpRespondedAt     *string `json:"rsvpRespondedAt"`
	CreatedAt           string  `json:"createdAt"`
	Gender              *string `json:"gender"`
	InvitationType      string  `json:"invitationType"`
	SouvenirType        string  `json:"souvenirType"`
	Email               string  `json:"email"`
	Address             string  `json:"address"`
	Notes               string  `json:"notes"`
	AttendingCount      int     `json:"attendingCount"`
	IsExpectedAttending bool    `json:"isExpectedAttending"`
}

type GuestInput struct {
	Name                string `json:"name"`
	Phone               string `json:"phone"`
	Side                string `json:"side"`
	Gender              string `json:"gender"`
	InvitationType      string `json:"invitationType"`
	SouvenirType        string `json:"souvenirType"`
	Email               string `json:"email"`
	Address             string `json:"address"`
	Notes               string `json:"notes"`
	IsExpectedAttending bool   `json:"isExpectedAttending"`
}

// GuestSessionDTO - kontrak publik GET /public/guests/by-token/:token
// (PLAN.md §5.4). Sengaja TIDAK menyertakan phone (tidak dibutuhkan
// tamu, hindari kebocoran data tamu lain via token tebakan). Field profil
// baru (email/alamat/catatan/souvenir) JAUH lebih sensitif daripada phone
// dan sengaja TIDAK ditambahkan di sini (guest-fields-admin-layout
// keputusan #14).
// AttendingCount ikut disertakan (dashboard-wa-rsvp, koreksi ditemukan saat
// implementasi RsvpConfirmation.tsx): tanpa ini, tamu yang membuka ulang
// link setelah RSVP 'attending' sebelumnya tidak tahu jumlah tamu yang
// sudah dikonfirmasi untuk menyusun ulang QR-nya. Bukan data sensitif -
// milik tamu itu sendiri (beda dengan phone yang sengaja TIDAK disertakan).
type GuestSessionDTO struct {
	Name           string `json:"name"`
	Side           string `json:"side"`
	RsvpStatus     string `json:"rsvpStatus"`
	AttendingCount int    `json:"attendingCount"`
}

// GuestSummaryDTO - kontrak GET /api/v1/admin/guests/summary, dipakai
// halaman Ringkasan (admin-ui-redesign/PLAN.md §5.4/keputusan #11).
// Selalu mengembalikan angka lengkap - kategori yang tidak muncul di hasil
// GROUP BY (karena belum ada tamu berkategori itu) di-default 0 oleh
// Service.Summary, BUKAN dihilangkan dari respons (lihat PLAN.md V3/§7).
// 4 field logistik (guest-fields-admin-layout keputusan #18) untuk panel
// logistik Ringkasan. AttendingPax/breakdown side & gender/RecentResponses
// (dashboard-wa-rsvp §3.4/keputusan #16) untuk dashboard berbasis kartu -
// Total TETAP hanya diakumulasi dari loop status, tidak pernah dari
// breakdown lain (lihat buildSummaryDTO).
type GuestSummaryDTO struct {
	Total              int                `json:"total"`
	Attending          int                `json:"attending"`
	NotAttending       int                `json:"notAttending"`
	RemindLater        int                `json:"remindLater"`
	Pending            int                `json:"pending"`
	InvitationOnline   int                `json:"invitationOnline"`
	InvitationPhysical int                `json:"invitationPhysical"`
	SouvenirRegular    int                `json:"souvenirRegular"`
	SouvenirVip        int                `json:"souvenirVip"`
	AttendingPax       int                `json:"attendingPax"`
	SideGroom          int                `json:"sideGroom"`
	SideBride          int                `json:"sideBride"`
	GenderMale         int                `json:"genderMale"`
	GenderFemale       int                `json:"genderFemale"`
	RecentResponses    []RecentResponseDTO `json:"recentResponses"`
}

// RecentResponseDTO - satu baris kartu "Aktivitas RSVP terbaru" (dashboard-
// wa-rsvp §3.2): rsvp_responded_at sudah diisi sejak awal tapi belum pernah
// ditampilkan di UI mana pun.
type RecentResponseDTO struct {
	Name           string `json:"name"`
	RsvpStatus     string `json:"rsvpStatus"`
	AttendingCount int    `json:"attendingCount"`
	RespondedAt    string `json:"respondedAt"`
}
