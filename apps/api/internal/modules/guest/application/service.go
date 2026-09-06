package application

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"log"
	"strings"

	contentContracts "undangan-digital/internal/modules/content/contracts"
	"undangan-digital/internal/modules/guest/infrastructure"
	"undangan-digital/internal/modules/guest/infrastructure/sqlc"
	waContracts "undangan-digital/internal/modules/whatsapp/contracts"
	"undangan-digital/internal/shared/pagination"
)

var (
	ErrNotFound              = errors.New("guest not found")
	ErrInvalidSide           = errors.New("side must be 'groom' or 'bride'")
	ErrInvalidStatus         = errors.New("invalid rsvp status")
	ErrInvalidGender         = errors.New("gender must be 'male' or 'female'")
	ErrInvalidInvitationType = errors.New("invitation type must be 'online' or 'physical'")
	ErrInvalidSouvenirType   = errors.New("souvenir type must be 'regular' or 'vip'")
	ErrInvalidAttendingCount = errors.New("attending count must be 1 or 2")
	ErrInvalidCheckinCode    = errors.New("QR tidak dikenali")

	// Group tamu (docs/plan/guest-groups/PLAN.md T5/T6). Pesannya berbahasa
	// Indonesia dan LAYAK DIBACA ADMIN - GroupsPage menampilkan pesan dari
	// respons backend apa adanya, tidak menulis ulang sendiri (T13). Pola yang
	// sama sudah dipakai ErrInvalidCheckinCode di atas.
	ErrGroupNameRequired       = errors.New("Nama group wajib diisi")
	ErrGroupNameTooLong        = errors.New("Nama group maksimal 100 karakter")
	ErrGroupDescriptionTooLong = errors.New("Deskripsi group maksimal 255 karakter")
	ErrGroupNameTaken          = errors.New("Nama group sudah dipakai")
	ErrGroupNotFound           = errors.New("Group tidak ditemukan")
	ErrGroupInUse              = errors.New("Group tidak bisa dihapus")
	ErrInvalidGroupID          = errors.New("Filter group tidak valid")
)

var validSides = map[string]bool{"groom": true, "bride": true}

// validStatuses cocok dengan enum kolom guests.rsvp_status (migration
// 000002) dan dengan RsvpChoice di frontend (RsvpConfirmation.tsx) -
// PLAN.md keputusan #3 & §5.4.
var validStatuses = map[string]bool{
	"pending": true, "attending": true, "not_attending": true, "remind_later": true,
}

// validGenders/validInvitationTypes/validSouvenirTypes (guest-fields-admin-
// layout keputusan #2/#9): wajib diisi saat Create/Update - string kosong
// TIDAK ada di map ini sehingga otomatis ditolak sebagai ErrInvalid*, meski
// kolom gender sendiri nullable di database (baris lama sebelum migration
// 000006 tetap NULL sampai disunting lewat form yang mewajibkannya).
var validGenders = map[string]bool{"male": true, "female": true}
var validInvitationTypes = map[string]bool{"online": true, "physical": true}
var validSouvenirTypes = map[string]bool{"regular": true, "vip": true}

// Service - sender & invitationInfo diterima lewat contracts modul lain
// (PLAN.md dashboard-wa-rsvp keputusan #8/#19), TIDAK PERNAH lewat tipe
// konkret modul whatsapp/content. sender boleh nil (deployment tanpa
// WhatsApp) - wajib dicek nil sebelum dipanggil.
type Service struct {
	repo           *infrastructure.Repository
	sender         waContracts.Sender
	invitationInfo contentContracts.InvitationInfoProvider
}

func NewService(repo *infrastructure.Repository, sender waContracts.Sender, invitationInfo contentContracts.InvitationInfoProvider) *Service {
	return &Service{repo: repo, sender: sender, invitationInfo: invitationInfo}
}

func generateToken() (string, error) {
	b := make([]byte, 16) // 128 bit - tidak bisa ditebak, dipakai di URL publik
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// escapeLike membungkus sebuah kata pencarian bebas jadi pola LIKE yang
// aman (admin-ui-redesign/PLAN.md keputusan #10). Tanpa ini, mengetik "%"
// di kotak pencarian mengembalikan SELURUH tabel - dibuktikan lewat MySQL
// sungguhan di PLAN.md §1.3 ("Bukti runtime": cari "%" mentah -> 3 baris,
// cari "50%" ter-escape -> 1 baris). Sejak guest-fields-admin-layout, hasil
// escape ini juga dipakai untuk mencocokkan kolom email (keputusan #13).
func escapeLike(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)
	return "%" + r.Replace(s) + "%"
}

func toDTO(g sqlc.Guest) GuestDTO {
	var respondedAt *string
	if g.RsvpRespondedAt.Valid {
		s := g.RsvpRespondedAt.Time.Format("2006-01-02T15:04:05Z07:00")
		respondedAt = &s
	}
	var gender *string
	if g.Gender.Valid {
		s := string(g.Gender.GuestsGender)
		gender = &s
	}
	var address, notes string
	if g.Address.Valid {
		address = g.Address.String
	}
	if g.Notes.Valid {
		notes = g.Notes.String
	}
	// GroupID mengikuti pola Gender di atas: NULL -> nil, terisi -> pointer.
	// Kolomnya BIGINT UNSIGNED NULL tapi sqlc memilih sql.NullInt64 untuk itu,
	// jadi cast eksplisit ke uint64 memang dibutuhkan di sini.
	var groupID *uint64
	if g.GroupID.Valid {
		v := uint64(g.GroupID.Int64)
		groupID = &v
	}
	return GuestDTO{
		ID: g.ID, Name: g.Name, Phone: g.Phone,
		Side: string(g.Side), Token: g.Token,
		RsvpStatus:          string(g.RsvpStatus),
		RsvpRespondedAt:     respondedAt,
		CreatedAt:           g.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Gender:              gender,
		InvitationType:      string(g.InvitationType),
		SouvenirType:        string(g.SouvenirType),
		Email:               g.Email,
		Address:             address,
		Notes:               notes,
		AttendingCount:      int(g.AttendingCount),
		IsExpectedAttending: g.IsExpectedAttending,
		GroupID:             groupID,
	}
}

// validateProfileFields memvalidasi 3 enum wajib yang ditambahkan
// guest-fields-admin-layout. Dipakai bersama oleh Create & Update supaya
// keduanya konsisten.
func validateProfileFields(in GuestInput) error {
	if !validSides[in.Side] {
		return ErrInvalidSide
	}
	if !validGenders[in.Gender] {
		return ErrInvalidGender
	}
	if !validInvitationTypes[in.InvitationType] {
		return ErrInvalidInvitationType
	}
	if !validSouvenirTypes[in.SouvenirType] {
		return ErrInvalidSouvenirType
	}
	return nil
}

func nullableText(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}

func (s *Service) Create(ctx context.Context, in GuestInput) (GuestDTO, error) {
	if err := validateProfileFields(in); err != nil {
		return GuestDTO{}, err
	}
	// Group WAJIB ditegakkan di backend, bukan cuma di form (D4) - lihat
	// validateGroupID di service_groups.go.
	if err := s.validateGroupID(ctx, in.GroupID); err != nil {
		return GuestDTO{}, err
	}
	token, err := generateToken()
	if err != nil {
		return GuestDTO{}, err
	}
	id, err := s.repo.Create(ctx, sqlc.CreateGuestParams{
		Name:                in.Name,
		Phone:               in.Phone,
		Side:                sqlc.GuestsSide(in.Side),
		GroupID:             sql.NullInt64{Int64: int64(in.GroupID), Valid: true},
		Token:               token,
		Gender:              sqlc.NullGuestsGender{GuestsGender: sqlc.GuestsGender(in.Gender), Valid: true},
		InvitationType:      sqlc.GuestsInvitationType(in.InvitationType),
		SouvenirType:        sqlc.GuestsSouvenirType(in.SouvenirType),
		Email:               in.Email,
		Address:             nullableText(in.Address),
		Notes:               nullableText(in.Notes),
		IsExpectedAttending: in.IsExpectedAttending,
	})
	if err != nil {
		return GuestDTO{}, err
	}
	row, err := s.repo.GetByID(ctx, uint64(id))
	if err != nil {
		return GuestDTO{}, err
	}
	return toDTO(row), nil
}

// Update TIDAK menyentuh AttendingCount (dashboard-wa-rsvp keputusan #11) -
// kolom itu hanya diisi TAMU lewat UpdateRsvpStatus, bukan admin.
func (s *Service) Update(ctx context.Context, id uint64, in GuestInput) error {
	// Keberadaan barisnya dicek PALING DULU: id di URL yang tidak ada harus
	// dibalas "guest not found", bukan keluhan tentang isi body (mis. "Group
	// tidak ditemukan") yang menyesatkan admin ke masalah yang salah.
	if err := s.requireGuestExists(ctx, id); err != nil {
		return err
	}
	if err := validateProfileFields(in); err != nil {
		return err
	}
	// Sama seperti Create - D4 berlaku di KEDUA jalur, kalau tidak, tamu bisa
	// dilepas dari group-nya lewat Update.
	if err := s.validateGroupID(ctx, in.GroupID); err != nil {
		return err
	}
	return s.repo.Update(ctx, sqlc.UpdateGuestParams{
		Name:                in.Name,
		Phone:               in.Phone,
		Side:                sqlc.GuestsSide(in.Side),
		GroupID:             sql.NullInt64{Int64: int64(in.GroupID), Valid: true},
		Gender:              sqlc.NullGuestsGender{GuestsGender: sqlc.GuestsGender(in.Gender), Valid: true},
		InvitationType:      sqlc.GuestsInvitationType(in.InvitationType),
		SouvenirType:        sqlc.GuestsSouvenirType(in.SouvenirType),
		Email:               in.Email,
		Address:             nullableText(in.Address),
		Notes:               nullableText(in.Notes),
		IsExpectedAttending: in.IsExpectedAttending,
		ID:                  id,
	})
}

func (s *Service) Delete(ctx context.Context, id uint64) error {
	if err := s.requireGuestExists(ctx, id); err != nil {
		return err
	}
	return s.repo.Delete(ctx, id)
}

// requireGuestExists memastikan barisnya ADA sebelum Update/Delete menyentuh
// database.
//
// Tanpa ini, UPDATE/DELETE pada id yang tidak ada hanya menyentuh 0 baris dan
// endpoint membalas 200 "Guest updated/deleted successfully" - admin yang
// bekerja dari daftar basi (tamu sudah dihapus di tab atau perangkat lain)
// diberi tahu bahwa perubahannya tersimpan padahal tidak ada yang berubah.
// Alasan dan pola yang sama persis dengan UpdateGroup/DeleteGroup di
// service_groups.go dan Delete di modul auth.
func (s *Service) requireGuestExists(ctx context.Context, id uint64) error {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// List mengembalikan tamu dgn paginasi wajib (PLAN.md admin-backend §3),
// filter status, jenis undangan, souvenir, DAN pencarian nama/telepon/email
// digabung dalam satu query (admin-ui-redesign keputusan #9, diperluas
// guest-fields-admin-layout keputusan #13).
func (s *Service) List(ctx context.Context, status, q, invitationType, souvenirType, groupID string, respondedOnly bool, p pagination.Params) ([]GuestDTO, int, error) {
	var statusArg sqlc.NullGuestsRsvpStatus
	if status != "" {
		if !validStatuses[status] {
			return nil, 0, ErrInvalidStatus
		}
		statusArg = sqlc.NullGuestsRsvpStatus{GuestsRsvpStatus: sqlc.GuestsRsvpStatus(status), Valid: true}
	}

	var invitationTypeArg sqlc.NullGuestsInvitationType
	if invitationType != "" {
		if !validInvitationTypes[invitationType] {
			return nil, 0, ErrInvalidInvitationType
		}
		invitationTypeArg = sqlc.NullGuestsInvitationType{GuestsInvitationType: sqlc.GuestsInvitationType(invitationType), Valid: true}
	}

	var souvenirTypeArg sqlc.NullGuestsSouvenirType
	if souvenirType != "" {
		if !validSouvenirTypes[souvenirType] {
			return nil, 0, ErrInvalidSouvenirType
		}
		souvenirTypeArg = sqlc.NullGuestsSouvenirType{GuestsSouvenirType: sqlc.GuestsSouvenirType(souvenirType), Valid: true}
	}

	// Filter group TIDAK butuh JOIN sama sekali (§2.3): group_id ada di baris
	// `guests` itu sendiri dan ber-index idx_guests_group_id, jadi ini cuma
	// satu klausa narg tambahan - persis seperti tiga filter di atasnya.
	groupIDArg, err := parseGroupIDFilter(groupID)
	if err != nil {
		return nil, 0, err
	}

	var qArg sql.NullString
	if q != "" {
		qArg = sql.NullString{String: escapeLike(q), Valid: true}
	}

	// RespondedOnly digenerate sqlc sebagai int64, bukan bool - MySQL engine
	// sqlc tidak bisa infer tipe bool dari ekspresi CAST(?, AS UNSIGNED) = 0
	// (dicoba dulu `= FALSE` polos, hasilnya malah interface{} - guest-
	// reservation-split keputusan implementasi). 1/0 dikonversi di sini
	// supaya signature Service.List tetap bool, bukan bocor ke pemanggil.
	var respondedOnlyArg int64
	if respondedOnly {
		respondedOnlyArg = 1
	}

	total, err := s.repo.CountFiltered(ctx, sqlc.CountGuestsFilteredParams{
		Status: statusArg, RespondedOnly: respondedOnlyArg, InvitationType: invitationTypeArg, SouvenirType: souvenirTypeArg, GroupID: groupIDArg, Q: qArg,
	})
	if err != nil {
		return nil, 0, err
	}
	rows, err := s.repo.ListFiltered(ctx, sqlc.ListGuestsFilteredParams{
		Status: statusArg, RespondedOnly: respondedOnlyArg, InvitationType: invitationTypeArg, SouvenirType: souvenirTypeArg, GroupID: groupIDArg, Q: qArg,
		Limit: int32(p.Limit), Offset: int32(p.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}
	return mapDTOs(rows), int(total), nil
}

func mapDTOs(rows []sqlc.Guest) []GuestDTO {
	out := make([]GuestDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, toDTO(r))
	}
	return out
}

// Summary membangun kontrak GET /api/v1/admin/guests/summary. 6 query
// GROUP BY/LIST (status+pax, jenis undangan, jenis souvenir, pihak, gender,
// aktivitas terbaru - dashboard-wa-rsvp §3.4), bukan panggilan Count/List
// berkali-kali. Kategori yang tidak muncul di hasil (karena belum ada tamu
// berkategori itu) di-default 0, BUKAN dihilangkan dari respons - PLAN.md V3.
func (s *Service) Summary(ctx context.Context) (GuestSummaryDTO, error) {
	statusRows, err := s.repo.CountGroupedByStatus(ctx)
	if err != nil {
		return GuestSummaryDTO{}, err
	}
	invitationRows, err := s.repo.CountGroupedByInvitationType(ctx)
	if err != nil {
		return GuestSummaryDTO{}, err
	}
	souvenirRows, err := s.repo.CountGroupedBySouvenirType(ctx)
	if err != nil {
		return GuestSummaryDTO{}, err
	}
	sideRows, err := s.repo.CountGroupedBySide(ctx)
	if err != nil {
		return GuestSummaryDTO{}, err
	}
	genderRows, err := s.repo.CountGroupedByGender(ctx)
	if err != nil {
		return GuestSummaryDTO{}, err
	}
	recentRows, err := s.repo.ListRecentRsvpResponses(ctx)
	if err != nil {
		return GuestSummaryDTO{}, err
	}
	return buildSummaryDTO(statusRows, invitationRows, souvenirRows, sideRows, genderRows, recentRows), nil
}

// buildSummaryDTO diisolasi dari Summary supaya bisa diuji tanpa koneksi
// database nyata (guest_summary_test.go) - murni agregasi, tidak
// menyentuh repo/DB. Kategori yang tidak muncul di parameter manapun
// (karena belum ada tamu berkategori itu) TETAP 0 lewat zero-value
// GuestSummaryDTO, bukan dihilangkan dari hasil (PLAN.md V3).
//
// PENTING: Total HANYA diakumulasi dari statusRows. invitationRows,
// souvenirRows, sideRows, genderRows menghitung BARIS YANG SAMA dari sudut
// pandang lain - kalau ikut ditambahkan ke Total, angkanya akan berlipat
// dari total tamu sesungguhnya. AttendingPax juga diambil dari statusRows
// (baris rsvp_status='attending' saja), BUKAN dijumlah dari seluruh baris,
// supaya tidak ikut menghitung attending_count tamu yang belum/tidak hadir.
func buildSummaryDTO(
	statusRows []sqlc.CountGuestsGroupedByStatusRow,
	invitationRows []sqlc.CountGuestsGroupedByInvitationTypeRow,
	souvenirRows []sqlc.CountGuestsGroupedBySouvenirTypeRow,
	sideRows []sqlc.CountGuestsGroupedBySideRow,
	genderRows []sqlc.CountGuestsGroupedByGenderRow,
	recentRows []sqlc.ListRecentRsvpResponsesRow,
) GuestSummaryDTO {
	var out GuestSummaryDTO
	for _, row := range statusRows {
		n := int(row.Total)
		switch row.RsvpStatus {
		case sqlc.GuestsRsvpStatusAttending:
			out.Attending = n
			out.AttendingPax = int(row.TotalPax)
		case sqlc.GuestsRsvpStatusNotAttending:
			out.NotAttending = n
		case sqlc.GuestsRsvpStatusRemindLater:
			out.RemindLater = n
		case sqlc.GuestsRsvpStatusPending:
			out.Pending = n
		}
		out.Total += n
	}
	for _, row := range invitationRows {
		n := int(row.Total)
		switch row.InvitationType {
		case sqlc.GuestsInvitationTypeOnline:
			out.InvitationOnline = n
		case sqlc.GuestsInvitationTypePhysical:
			out.InvitationPhysical = n
		}
	}
	for _, row := range souvenirRows {
		n := int(row.Total)
		switch row.SouvenirType {
		case sqlc.GuestsSouvenirTypeRegular:
			out.SouvenirRegular = n
		case sqlc.GuestsSouvenirTypeVip:
			out.SouvenirVip = n
		}
	}
	for _, row := range sideRows {
		n := int(row.Total)
		switch row.Side {
		case sqlc.GuestsSideGroom:
			out.SideGroom = n
		case sqlc.GuestsSideBride:
			out.SideBride = n
		}
	}
	for _, row := range genderRows {
		if !row.Gender.Valid {
			continue
		}
		n := int(row.Total)
		switch row.Gender.GuestsGender {
		case sqlc.GuestsGenderMale:
			out.GenderMale = n
		case sqlc.GuestsGenderFemale:
			out.GenderFemale = n
		}
	}
	out.RecentResponses = mapRecentResponses(recentRows)
	return out
}

func mapRecentResponses(rows []sqlc.ListRecentRsvpResponsesRow) []RecentResponseDTO {
	out := make([]RecentResponseDTO, 0, len(rows))
	for _, r := range rows {
		var respondedAt string
		if r.RsvpRespondedAt.Valid {
			respondedAt = r.RsvpRespondedAt.Time.Format("2006-01-02T15:04:05Z07:00")
		}
		out = append(out, RecentResponseDTO{
			Name:           r.Name,
			RsvpStatus:     string(r.RsvpStatus),
			AttendingCount: int(r.AttendingCount),
			RespondedAt:    respondedAt,
		})
	}
	return out
}

// ResolveByToken adalah endpoint publik (PLAN.md §5.4) yang dipakai
// useGuestSession di frontend untuk mengenali identitas tamu dari
// ?guest=<token> - menggantikan ?to=<nama bebas> lama.
func (s *Service) ResolveByToken(ctx context.Context, token string) (GuestSessionDTO, error) {
	row, err := s.repo.GetByToken(ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return GuestSessionDTO{}, ErrNotFound
		}
		return GuestSessionDTO{}, err
	}
	return GuestSessionDTO{Name: row.Name, Side: string(row.Side), RsvpStatus: string(row.RsvpStatus), AttendingCount: int(row.AttendingCount)}, nil
}

// resolveAttendingCount memvalidasi & menormalisasi jumlah tamu (dashboard-
// wa-rsvp keputusan #2/§9.3) - fungsi murni, diuji tanpa DB
// (service_test.go). attending_count hanya bermakna untuk status
// 'attending' (harus 1 atau 2); status lain diabaikan dan dinetralkan ke 1
// (default kolom) - tidak pernah ikut dihitung pax manapun karena
// buildSummaryDTO hanya membaca TotalPax dari baris rsvp_status='attending'.
func resolveAttendingCount(status string, requested int) (int, error) {
	if status != "attending" {
		return 1, nil
	}
	if requested != 1 && requested != 2 {
		return 0, ErrInvalidAttendingCount
	}
	return requested, nil
}

// checkinCodePrefix menandai QR terbitan sistem ini (docs/plan/
// scan-checkin-gate/PLAN.md D1). Berprefiks, BUKAN URL: URL membuat token
// tamu tercatat di riwayat browser siapa pun yang memindainya, sedangkan
// prefiks berversi membuat pemindai bisa menolak QR asing SEBELUM menembak
// API dan memudahkan ganti format kelak.
//
// KEMBAR LINTAS BAHASA (D10): nilai yang sama diketik ulang di
// RsvpConfirmation.tsx (composeLocalQrPayload) karena browser tidak bisa
// memanggil konstanta Go. Mengubah salah satu saja memutus rantai antara QR
// yang diterbitkan dan pemindai di gate - ubah keduanya.
const checkinCodePrefix = "ELW1:"

// buildQRPayload menyusun ISI QR tamu: prefiks + token tamu.
//
// Sebelum docs/plan/scan-checkin-gate isinya teks yang dibaca manusia
// (nama/status/jumlah/tanggal), dan itu SECARA TEKNIS TIDAK BISA dipakai
// untuk identifikasi (§2.1): hasil pindaian tidak bisa dipetakan balik ke
// baris tamu, nama kembar lumrah di daftar tamu pernikahan, dan siapa pun
// bisa mengetik teks yang sama lalu membuat QR-nya sendiri. Kolom `token`
// sudah ada, UNIQUE, dan selalu dibuat server-side - jadi ini memakai ulang
// identitas yang sudah terbukti, bukan menciptakan yang baru.
//
// Informasi yang dulu dititipkan di dalam QR tidak hilang: kartu masuk sudah
// menampilkan nama, jumlah orang, dan tanggal sebagai teks di kartunya
// sendiri.
func buildQRPayload(token string) string {
	return checkinCodePrefix + token
}

// parseCheckinCode adalah FUNGSI MURNI (diuji tanpa DB - checkin_test.go).
// TrimSpace dulu: pembaca QR kadang menyisipkan newline di ujung. Selain
// prefiks yang benar dengan sisa tidak kosong, semuanya ditolak - termasuk
// QR format LAMA, yang memang sengaja tidak diberi jalur kompatibilitas (K1)
// dan lebih baik ditolak dengan pesan jelas daripada dicocokkan lewat nama.
func parseCheckinCode(code string) (string, bool) {
	token, ok := strings.CutPrefix(strings.TrimSpace(code), checkinCodePrefix)
	if !ok || token == "" {
		return "", false
	}
	return token, true
}

// UpdateRsvpStatus adalah endpoint publik (PLAN.md §5.4/fitur #6, diperluas
// dashboard-wa-rsvp §6.5/§9.3) yang dipanggil RsvpConfirmation saat tamu
// memilih salah satu dari 3 status. Untuk status 'attending', attendingCount
// WAJIB 1 atau 2 (opsi 1/2 tamu - keputusan #2), qrPayload dikembalikan, dan
// pengiriman WhatsApp dipicu di GOROUTINE terpisah (keputusan #7 - RSVP
// TIDAK menunggu WhatsApp).
func (s *Service) UpdateRsvpStatus(ctx context.Context, token, status string, attendingCount int) (string, error) {
	if !validStatuses[status] || status == "pending" {
		return "", ErrInvalidStatus
	}
	finalCount, err := resolveAttendingCount(status, attendingCount)
	if err != nil {
		return "", err
	}

	row, err := s.repo.GetByToken(ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}

	if err := s.repo.UpdateRsvpStatusByToken(ctx, sqlc.UpdateGuestRsvpStatusByTokenParams{
		RsvpStatus: sqlc.GuestsRsvpStatus(status), AttendingCount: uint8(finalCount), Token: token,
	}); err != nil {
		return "", err
	}

	if status != "attending" {
		return "", nil
	}

	// Payload dihitung SEBELUM GetQRInfo, dan cabang gagal di bawah
	// mengembalikan nilai yang SAMA (docs/plan/scan-checkin-gate D9/§2.4).
	// Dulu cabang itu mengembalikan teks minimal tanpa identitas, dan itu
	// benar untuk payload lama. Begitu QR berisi token, cabang tersebut jadi
	// jebakan: gangguan sesaat pada tabel invitation_content akan diam-diam
	// memberi tamu QR TANPA identitas yang ditolak di gate - padahal
	// token-nya tersedia sepanjang waktu di row.Token dan tidak bergantung
	// pada `info` sama sekali.
	qrPayload := buildQRPayload(row.Token)

	info, err := s.invitationInfo.GetQRInfo(ctx)
	if err != nil {
		// Kegagalan membaca info undangan TIDAK membuat RSVP gagal - QR-nya
		// tetap sah dan tetap bisa dipindai di gate; hanya pengiriman
		// WhatsApp yang dilewati (butuh CoupleName/EventDateLabel yang gagal
		// diambil).
		log.Printf("guest: gagal membaca info undangan untuk QR tamu %d: %v", row.ID, err)
		return qrPayload, nil
	}

	if s.sender != nil {
		guestID, guestName, phone := row.ID, row.Name, row.Phone
		coupleName := info.GroomName + " & " + info.BrideName
		eventDateLabel := info.WeddingDateLabel
		go func() {
			err := s.sender.SendQR(context.Background(), waContracts.SendQRInput{
				GuestID: guestID, GuestName: guestName, Phone: phone, QRPayload: qrPayload,
				CoupleName: coupleName, EventDateLabel: eventDateLabel, AttendingCount: finalCount,
			})
			if err != nil {
				log.Printf("guest: gagal kirim QR WhatsApp untuk tamu %d: %v", guestID, err)
			}
		}()
	}

	return qrPayload, nil
}

// --- check-in di gate (docs/plan/scan-checkin-gate/PLAN.md T7) ---

// CheckinByCode adalah jalur pindai QR. Kode yang bukan terbitan sistem ini
// ditolak SEBELUM menyentuh database.
func (s *Service) CheckinByCode(ctx context.Context, code string) (CheckinResultDTO, error) {
	token, ok := parseCheckinCode(code)
	if !ok {
		return CheckinResultDTO{}, ErrInvalidCheckinCode
	}
	row, err := s.repo.GetByToken(ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CheckinResultDTO{}, ErrNotFound
		}
		return CheckinResultDTO{}, err
	}
	return s.markAndBuildResult(ctx, row)
}

// CheckinByID adalah jalur check-in MANUAL: petugas mencari nama tamu yang
// lupa atau kehilangan QR-nya, lalu menekan tombol check-in pada barisnya
// (K3). Hasilnya sengaja sama persis dengan jalur pindai.
func (s *Service) CheckinByID(ctx context.Context, id uint64) (CheckinResultDTO, error) {
	row, err := s.repo.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return CheckinResultDTO{}, ErrNotFound
		}
		return CheckinResultDTO{}, err
	}
	return s.markAndBuildResult(ctx, row)
}

// markAndBuildResult menandai kehadiran lalu menyusun hasil untuk layar
// petugas.
//
// STATUS RSVP TIDAK MEMBLOKIR CHECK-IN: tamu ber-status 'pending' atau
// 'not_attending' yang tetap datang harus bisa dicatat. RsvpStatus ikut
// dikembalikan supaya petugas melihatnya sendiri di layar - jangan
// menambahkan penolakan berbasis status di sini.
func (s *Service) markAndBuildResult(ctx context.Context, row sqlc.Guest) (CheckinResultDTO, error) {
	rows, err := s.repo.MarkCheckedIn(ctx, row.ID)
	if err != nil {
		return CheckinResultDTO{}, err
	}

	out := CheckinResultDTO{
		ID:             row.ID,
		Name:           row.Name,
		Side:           string(row.Side),
		InvitationType: string(row.InvitationType),
		SouvenirType:   string(row.SouvenirType),
		RsvpStatus:     string(row.RsvpStatus),
		AttendingCount: int(row.AttendingCount),
	}

	// LETAKNYA DI SINI DAN TIDAK BOLEH PINDAH (T7): sesudah `out` tersusun,
	// SEBELUM percabangan rows di bawah. Kedua cabang itu sama-sama
	// `return out, nil` - cabang rows == 1 keluar lebih awal, jadi tidak ada
	// titik temu sesudahnya. Menaruhnya di dalam salah satu cabang membuat
	// group hilang pada pemindaian PERTAMA atau pada pemindaian KEDUA saja -
	// bug yang lolos pengujian sepintas karena separuh kasusnya tetap benar.
	//
	// Error-nya DI-LOG LALU DIABAIKAN, tidak pernah di-return (D9): tamu yang
	// berdiri di pintu harus tetap tercatat masuk walau nama group-nya gagal
	// dibaca. Kolom group-nya saja yang kosong.
	if row.GroupID.Valid {
		group, err := s.repo.GetGroupByID(ctx, uint64(row.GroupID.Int64))
		if err != nil {
			log.Printf("guest: gagal membaca group tamu %d: %v", row.ID, err)
		} else {
			out.GroupName = group.Name
		}
	}

	if rows == 1 {
		// Baru saja datang. Jam kedatangan diambil dari baris yang baru
		// ditulis, bukan dari time.Now() lokal, supaya yang ditampilkan
		// persis sama dengan yang tersimpan (NOW() milik MySQL).
		fresh, err := s.repo.GetByID(ctx, row.ID)
		if err != nil {
			return CheckinResultDTO{}, err
		}
		out.CheckedInAt = formatCheckedInAt(fresh.CheckedInAt)
		return out, nil
	}

	// rows == 0: sudah pernah check-in. Barisnya DIBACA ULANG - `row` yang
	// kita pegang bisa saja terbaca sebelum petugas lain menandainya, jadi
	// checked_in_at di dalamnya belum tentu yang asli (D5/§7 butir 5).
	current, err := s.repo.GetByID(ctx, row.ID)
	if err != nil {
		return CheckinResultDTO{}, err
	}
	out.AlreadyCheckedIn = true
	out.CheckedInAt = formatCheckedInAt(current.CheckedInAt)
	return out, nil
}

func formatCheckedInAt(t sql.NullTime) string {
	if !t.Valid {
		return ""
	}
	return t.Time.Format("2006-01-02T15:04:05Z07:00")
}

// SearchForCheckin mencari tamu berdasarkan nama untuk check-in manual.
//
// DIBATASI, BUKAN DIPAGINASI (T7): petugas mencari SATU tamu, bukan meramban
// daftar, jadi halaman kedua tidak ada gunanya. Tanpa paginasi tidak perlu
// CountFiltered, sehingga tiap ketikan hanya menghasilkan SATU query, bukan
// dua - dan responsnya tidak pernah tumbuh mengikuti besar tabel. Karena
// tidak berpaginasi, amplopnya juga tanpa `meta` (api-standard.md mewajibkan
// meta hanya untuk respons berpaginasi).
//
// Query & escaping DIPAKAI ULANG apa adanya dari List - yang baru hanya
// pemetaan DTO-nya.
func (s *Service) SearchForCheckin(ctx context.Context, q string) ([]CheckinSearchItemDTO, error) {
	rows, err := s.repo.ListFiltered(ctx, sqlc.ListGuestsFilteredParams{
		Q:      sql.NullString{String: escapeLike(q), Valid: true},
		Limit:  checkinSearchLimit,
		Offset: 0,
	})
	if err != nil {
		return nil, err
	}
	out := make([]CheckinSearchItemDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, CheckinSearchItemDTO{
			ID:             r.ID,
			Name:           r.Name,
			Side:           string(r.Side),
			RsvpStatus:     string(r.RsvpStatus),
			AttendingCount: int(r.AttendingCount),
			CheckedIn:      r.CheckedInAt.Valid,
		})
	}
	return out, nil
}

const checkinSearchLimit = 20

// ListArrivals mengembalikan tamu yang SUDAH tiba, terbaru di atas, dengan
// paginasi standar - menu "Tamu Masuk" milik petugas gate.
//
// BERPAGINASI (beda dari SearchForCheckin yang dibatasi keras 20 tanpa meta):
// ini daftar untuk DIRAMBAN, bukan pencarian satu tamu, dan panjangnya tumbuh
// sepanjang acara sampai sebesar daftar tamu. Karena itu ia memang butuh
// CountFiltered-nya sendiri dan mengikuti amplop `meta` di api-standard.md.
func (s *Service) ListArrivals(ctx context.Context, p pagination.Params) ([]ArrivalItemDTO, int, error) {
	total, err := s.repo.CountCheckedIn(ctx)
	if err != nil {
		return nil, 0, err
	}
	rows, err := s.repo.ListCheckedIn(ctx, int32(p.Limit), int32(p.Offset()))
	if err != nil {
		return nil, 0, err
	}
	out := make([]ArrivalItemDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, ArrivalItemDTO{
			ID:             r.ID,
			Name:           r.Name,
			Side:           string(r.Side),
			SouvenirType:   string(r.SouvenirType),
			AttendingCount: int(r.AttendingCount),
			CheckedInAt:    formatCheckedInAt(r.CheckedInAt),
		})
	}
	return out, int(total), nil
}

// CheckinSummary mengembalikan angka kartu ringkasan gate - SATU query
// agregat, bukan 4 COUNT terpisah.
func (s *Service) CheckinSummary(ctx context.Context) (CheckinSummaryDTO, error) {
	row, err := s.repo.CheckinSummary(ctx)
	if err != nil {
		return CheckinSummaryDTO{}, err
	}
	return buildCheckinSummaryDTO(row), nil
}

// buildCheckinSummaryDTO diisolasi supaya bisa diuji tanpa DB (pola sama
// seperti buildSummaryDTO). Pemetaannya sepele TAPI mudah tertukar: menukar
// groom<->bride di sini menghasilkan angka yang tetap terlihat masuk akal di
// layar, jadi justru itu yang perlu dikunci tes.
func buildCheckinSummaryDTO(row sqlc.GetCheckinSummaryRow) CheckinSummaryDTO {
	return CheckinSummaryDTO{
		ArrivedGroom: int(row.ArrivedGroom),
		ArrivedBride: int(row.ArrivedBride),
		ArrivedTotal: int(row.ArrivedTotal),
		ArrivedPax:   int(row.ArrivedPax),
		TotalGuests:  int(row.TotalGuests),
	}
}

// statusHTTPCode memetakan error domain ke status HTTP - dipakai presentation.
func StatusHTTPCode(err error) int {
	switch {
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrGroupNotFound):
		return 404
	case errors.Is(err, ErrInvalidSide), errors.Is(err, ErrInvalidStatus),
		errors.Is(err, ErrInvalidGender), errors.Is(err, ErrInvalidInvitationType), errors.Is(err, ErrInvalidSouvenirType),
		errors.Is(err, ErrInvalidAttendingCount), errors.Is(err, ErrInvalidCheckinCode),
		errors.Is(err, ErrGroupNameRequired), errors.Is(err, ErrGroupNameTooLong),
		errors.Is(err, ErrGroupDescriptionTooLong), errors.Is(err, ErrGroupNameTaken),
		errors.Is(err, ErrGroupInUse), errors.Is(err, ErrInvalidGroupID):
		return 400
	default:
		return 500
	}
}
