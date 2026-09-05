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
	// GroupID POINTER (docs/plan/guest-groups/PLAN.md T4/K2): NULL di sini
	// bermakna "belum ditentukan" - tamu yang dibuat SEBELUM migration 000016
	// dan belum pernah disunting (§2.6). Pola yang sama persis dengan
	// Gender *string di atas. Namanya TIDAK dikirim: daftar Tamu memetakan
	// id->nama di frontend dari daftar group yang memang sudah dimuat halaman
	// itu (D2), sehingga tidak ada JOIN dan tidak ada N+1.
	GroupID *uint64 `json:"groupId"`
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
	// GroupID sengaja BUKAN pointer (T4/D4): 0 berarti tidak dikirim dan
	// ditolak validateGroupID, persis seperti string kosong pada enum wajib
	// (gender/invitationType/souvenirType) yang ditolak validGenders dkk.
	GroupID uint64 `json:"groupId"`
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

// GuestGroupDTO & GuestGroupInput - kontrak menu Group
// (docs/plan/guest-groups/PLAN.md T4). Isi satu group sengaja hanya nama +
// deskripsi (K3): tanpa warna, nomor meja, maupun kuota.
//
// GuestCount TIDAK datang dari query group, melainkan diisi Service.ListGroups
// dari SATU CountGuestsGroupedByGroup yang dipetakan ke map di memori - bukan
// satu COUNT per baris (yang itu N+1). Dialah yang menjelaskan ke admin kenapa
// sebuah group tidak bisa dihapus (K4).
type GuestGroupDTO struct {
	ID          uint64 `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	GuestCount  int    `json:"guestCount"`
	CreatedAt   string `json:"createdAt"`
}

type GuestGroupInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// CheckinResultDTO & CheckinSearchItemDTO - kontrak menu Scan di gate
// (docs/plan/scan-checkin-gate/PLAN.md T7/D3).
//
// SENGAJA BUKAN GuestDTO. GuestDTO membawa Phone, Email, Address, Notes DAN
// Token; memakainya ulang untuk akun petugas berarti menyerahkan kredensial
// undangan SETIAP tamu ke staf vendor yang berjaga di pintu. DTO ringkas ini
// keputusan keamanan, bukan duplikasi - jangan "dirapikan" jadi GuestDTO.
//
// CheckedInAt diformat RFC3339 ("2006-01-02T15:04:05Z07:00"), konvensi waktu
// seluruh modul ini: frontend butuh nilai yang bisa diparse untuk menampilkan
// "sudah check-in jam sekian" (K3), bukan string yang sudah diformat manusia.
type CheckinResultDTO struct {
	ID               uint64 `json:"id"`
	Name             string `json:"name"`
	Side             string `json:"side"`
	InvitationType   string `json:"invitationType"`
	SouvenirType     string `json:"souvenirType"`
	RsvpStatus       string `json:"rsvpStatus"`
	AttendingCount   int    `json:"attendingCount"`
	CheckedInAt      string `json:"checkedInAt"`
	AlreadyCheckedIn bool   `json:"alreadyCheckedIn"`
	// GroupName di-resolve DI SERVER, berbeda dari GuestDTO.GroupID yang
	// hanya membawa id (D8). Bukan inkonsistensi melainkan konsekuensi akses:
	// akun petugas gate TIDAK BISA memanggil /api/v1/admin/groups - seluruh
	// prefix itu dijaga RequireFullAdmin - jadi ScanPage tidak mungkin
	// memetakan id->nama sendiri.
	//
	// Kosong bila tamu belum bergroup (§2.6) ATAU bila pembacaan group gagal
	// (D9) - kegagalan itu TIDAK PERNAH menggagalkan check-in.
	GroupName string `json:"groupName"`
}

// CheckinSearchItemDTO - satu baris hasil pencarian nama untuk check-in
// manual (tamu yang lupa/kehilangan QR, K3). Tanpa phone/email/token, alasan
// yang sama seperti di atas.
type CheckinSearchItemDTO struct {
	ID             uint64 `json:"id"`
	Name           string `json:"name"`
	Side           string `json:"side"`
	RsvpStatus     string `json:"rsvpStatus"`
	AttendingCount int    `json:"attendingCount"`
	CheckedIn      bool   `json:"checkedIn"`
}

// ArrivalItemDTO - satu baris menu "Tamu Masuk" milik petugas gate
// (docs/plan/scan-checkin-gate/PLAN.md, menu tambahan). Sama seperti dua DTO
// di atas: TANPA phone/email/address/notes/token. Akun petugas tidak pernah
// menerima kredensial undangan tamu mana pun.
type ArrivalItemDTO struct {
	ID             uint64 `json:"id"`
	Name           string `json:"name"`
	Side           string `json:"side"`
	SouvenirType   string `json:"souvenirType"`
	AttendingCount int    `json:"attendingCount"`
	CheckedInAt    string `json:"checkedInAt"`
}

// CheckinSummaryDTO - angka kartu ringkasan di menu "Tamu Masuk".
//
// Arrived* menghitung BARIS TAMU (undangan), satu satuan dengan TotalGuests
// sebagai penyebutnya - jadi "12 dari 80" selalu apple-to-apple.
//
// ArrivedPax berbeda satuan dan sengaja dipisah: ia menjumlahkan
// attending_count, yaitu jumlah orang yang DIJANJIKAN tamu saat RSVP. Sistem
// ini TIDAK merekam hitung kepala sebenarnya di pintu (§3.2 menolak kolom
// checked_in_count), jadi angka ini perkiraan - dan label di UI wajib
// mengatakannya. Jangan pernah menyajikannya sebagai jumlah orang terverifikasi.
type CheckinSummaryDTO struct {
	ArrivedGroom int `json:"arrivedGroom"`
	ArrivedBride int `json:"arrivedBride"`
	ArrivedTotal int `json:"arrivedTotal"`
	ArrivedPax   int `json:"arrivedPax"`
	TotalGuests  int `json:"totalGuests"`
}
