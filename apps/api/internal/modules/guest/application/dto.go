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
	// PaxQuota - JATAH kursi undangan ini, diisi ADMIN (docs/plan/
	// guest-pax-quota/PLAN.md D1). Jangan tertukar dengan AttendingCount di
	// atasnya: itu JANJI tamu, diisi TAMU saat RSVP. Dua kolom, dua pemilik,
	// dan AttendingCount tidak pernah boleh melebihi PaxQuota.
	PaxQuota int `json:"paxQuota"`
	// ContactedAt - kapan admin membuka WhatsApp lewat tombol "Kirim Undangan"
	// (docs/plan/reservation-reset-contacted-flag/PLAN.md D6). `null` = belum
	// pernah dihubungi, pola RsvpRespondedAt di atas.
	//
	// BUKAN bukti pesan terkirim: wa.me tidak bisa melaporkan balik apa pun,
	// jadi yang tercatat hanyalah "admin membuka WhatsApp untuk tamu ini" -
	// itulah sebabnya namanya `contacted`, bukan `sent`. Label di UI wajib
	// ikut mengatakannya.
	ContactedAt *string `json:"contactedAt"`
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
	// PaxQuota WAJIB 1..20 (docs/plan/guest-pax-quota/PLAN.md D3), ditegakkan
	// validatePaxQuota lewat validateProfileFields - jadi Create & Update
	// memakai penjaga yang sama. 0 = tidak dikirim klien, dan ditolak sama
	// seperti GroupID 0 di atasnya.
	PaxQuota int `json:"paxQuota"`
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
// PaxQuota ikut disertakan (docs/plan/guest-pax-quota/PLAN.md D5): tanpa ini
// halaman RSVP tidak tahu sampai angka berapa tamu boleh memilih, dan batas
// jatah tidak bisa ditampilkan ("Undangan ini berlaku untuk N orang", K2).
// BUKAN data sensitif - ini jatah milik tamu itu sendiri, alasan yang sama
// persis dengan AttendingCount di atasnya. Phone/email/address tetap TIDAK
// disertakan.
type GuestSessionDTO struct {
	Name           string `json:"name"`
	Side           string `json:"side"`
	RsvpStatus     string `json:"rsvpStatus"`
	AttendingCount int    `json:"attendingCount"`
	PaxQuota       int    `json:"paxQuota"`
	// HasWish/WishMessage - ucapan milik tamu itu sendiri (docs/plan/
	// wedding-wish/PLAN.md T7). Menumpang endpoint by-token yang sudah pasti
	// dipanggil, supaya frontend tahu form atau kartu "Ucapan Anda" yang
	// ditampilkan - tanpa satu pun permintaan tambahan. Bukan data sensitif,
	// alasan yang sama persis dengan AttendingCount/PaxQuota di atasnya.
	HasWish     bool   `json:"hasWish"`
	WishMessage string `json:"wishMessage"`
}

// PublicWishDTO - satu ucapan di slider undangan (docs/plan/wedding-wish/
// PLAN.md §3.3). Nama pengirim ikut dari JOIN, bukan snapshot - perbaikan nama
// di admin langsung tercermin. Waktu RFC3339, konvensi seluruh modul ini.
type PublicWishDTO struct {
	ID        uint64 `json:"id"`
	GuestName string `json:"guestName"`
	GuestSide string `json:"guestSide"`
	Message   string `json:"message"`
	CreatedAt string `json:"createdAt"`
}

// WishAdminDTO - satu baris menu Ucapan (ditambah GuestID & IsHidden dibanding
// versi publik: admin mengelola, bukan sekadar melihat).
type WishAdminDTO struct {
	ID        uint64 `json:"id"`
	GuestID   uint64 `json:"guestId"`
	GuestName string `json:"guestName"`
	GuestSide string `json:"guestSide"`
	Message   string `json:"message"`
	IsHidden  bool   `json:"isHidden"`
	CreatedAt string `json:"createdAt"`
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

	// --- Proyeksi catering (docs/plan/guest-pax-quota/PLAN.md T14/§5) ---
	//
	// Ketiganya berSATUAN ORANG, bukan undangan - beda satuan dengan
	// Total/SideGroom/SideBride di atas. Jangan pernah menyandingkannya
	// sebagai "X dari Y" dengan angka undangan.
	//
	// ConfirmedPax = FAKTA (tamu sudah menjawab hadir, angkanya dari mulut
	// tamu sendiri). ExpectedPax = TEBAKAN (tamu belum menjawab, angkanya
	// jatah yang admin duga akan terpakai). ProjectedPax menjumlahkan
	// keduanya - dan justru KARENA ia campuran fakta + tebakan, UI WAJIB
	// menampilkan ketiga baris, bukan cuma ProjectedPax. Satu angka telanjang
	// membuat admin tidak bisa menilai seberapa besar risikonya.
	ConfirmedPaxGroom int `json:"confirmedPaxGroom"`
	ConfirmedPaxBride int `json:"confirmedPaxBride"`
	ConfirmedPaxTotal int `json:"confirmedPaxTotal"`
	ExpectedPaxGroom  int `json:"expectedPaxGroom"`
	ExpectedPaxBride  int `json:"expectedPaxBride"`
	ExpectedPaxTotal  int `json:"expectedPaxTotal"`
	ProjectedPaxGroom int `json:"projectedPaxGroom"`
	ProjectedPaxBride int `json:"projectedPaxBride"`
	ProjectedPaxTotal int `json:"projectedPaxTotal"`

	// Excluded* berSATUAN UNDANGAN (bukan orang) dan sengaja TIDAK dipecah
	// per pihak: baris "tidak dihitung" di kartu memang tidak dipecah. Ia ada
	// supaya tidak ada tamu yang hilang diam-diam dari total - kalau angkanya
	// terasa terlalu besar, admin langsung curiga ada yang salah set.
	ExcludedNotAttending int `json:"excludedNotAttending"`
	ExcludedNotExpected  int `json:"excludedNotExpected"`
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
// (docs/plan/guest-groups/PLAN.md T4). Isi satu group: nama + deskripsi +
// DefaultPax. Warna & nomor meja tetap ditolak (K3 guest-groups); kuota TIDAK
// lagi ditolak sejak docs/plan/guest-pax-quota/PLAN.md D2 - pembalikan K3 yang
// dicatat, bukan disamarkan (§2 plan itu).
//
// DefaultPax bukan kuota yang MENGIKAT anggota group. Ia semata angka awal
// yang mengisi form saat admin menambah tamu baru di group ini; yang mengikat
// adalah GuestDTO.PaxQuota per tamu. Group "Keluarga" berdefault 4 tetap bisa
// berisi Paman Budi (6) dan Bulek Sri (1).
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
	DefaultPax  int    `json:"defaultPax"`
	CreatedAt   string `json:"createdAt"`
}

type GuestGroupInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	DefaultPax  int    `json:"defaultPax"`
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
