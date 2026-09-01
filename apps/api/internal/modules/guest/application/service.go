package application

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"strings"

	contentContracts "undangan-ariana-adrian/internal/modules/content/contracts"
	"undangan-ariana-adrian/internal/modules/guest/infrastructure"
	"undangan-ariana-adrian/internal/modules/guest/infrastructure/sqlc"
	waContracts "undangan-ariana-adrian/internal/modules/whatsapp/contracts"
	"undangan-ariana-adrian/internal/shared/pagination"
)

var (
	ErrNotFound              = errors.New("guest not found")
	ErrInvalidSide           = errors.New("side must be 'groom' or 'bride'")
	ErrInvalidStatus         = errors.New("invalid rsvp status")
	ErrInvalidGender         = errors.New("gender must be 'male' or 'female'")
	ErrInvalidInvitationType = errors.New("invitation type must be 'online' or 'physical'")
	ErrInvalidSouvenirType   = errors.New("souvenir type must be 'regular' or 'vip'")
	ErrInvalidAttendingCount = errors.New("attending count must be 1 or 2")
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
	token, err := generateToken()
	if err != nil {
		return GuestDTO{}, err
	}
	id, err := s.repo.Create(ctx, sqlc.CreateGuestParams{
		Name:                in.Name,
		Phone:               in.Phone,
		Side:                sqlc.GuestsSide(in.Side),
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
	if err := validateProfileFields(in); err != nil {
		return err
	}
	return s.repo.Update(ctx, sqlc.UpdateGuestParams{
		Name:                in.Name,
		Phone:               in.Phone,
		Side:                sqlc.GuestsSide(in.Side),
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
	return s.repo.Delete(ctx, id)
}

// List mengembalikan tamu dgn paginasi wajib (PLAN.md admin-backend §3),
// filter status, jenis undangan, souvenir, DAN pencarian nama/telepon/email
// digabung dalam satu query (admin-ui-redesign keputusan #9, diperluas
// guest-fields-admin-layout keputusan #13).
func (s *Service) List(ctx context.Context, status, q, invitationType, souvenirType string, respondedOnly bool, p pagination.Params) ([]GuestDTO, int, error) {
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
		Status: statusArg, RespondedOnly: respondedOnlyArg, InvitationType: invitationTypeArg, SouvenirType: souvenirTypeArg, Q: qArg,
	})
	if err != nil {
		return nil, 0, err
	}
	rows, err := s.repo.ListFiltered(ctx, sqlc.ListGuestsFilteredParams{
		Status: statusArg, RespondedOnly: respondedOnlyArg, InvitationType: invitationTypeArg, SouvenirType: souvenirTypeArg, Q: qArg,
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

// buildQRPayload menyusun teks QR dari nama tamu (tabel guest sendiri) +
// info undangan (lewat contract content, keputusan #19) + jumlah tamu.
func buildQRPayload(guestName string, info contentContracts.QRInfo, attendingCount int) string {
	return fmt.Sprintf(
		"Wedding Invitation - %s & %s\nNama Tamu: %s\nStatus: Akan Hadir\nJumlah Tamu: %d\nTanggal: %s",
		info.BrideName, info.GroomName, guestName, attendingCount, info.WeddingDateLabel,
	)
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

	info, err := s.invitationInfo.GetQRInfo(ctx)
	if err != nil {
		// Kegagalan membaca info undangan TIDAK membuat RSVP gagal - qrPayload
		// minimal tetap dikembalikan, pengiriman WhatsApp dilewati (butuh
		// CoupleName/EventDateLabel yang gagal diambil).
		log.Printf("guest: gagal membaca info undangan untuk QR tamu %d: %v", row.ID, err)
		return fmt.Sprintf("Nama Tamu: %s\nStatus: Akan Hadir\nJumlah Tamu: %d", row.Name, finalCount), nil
	}

	qrPayload := buildQRPayload(row.Name, info, finalCount)

	if s.sender != nil {
		guestID, guestName, phone := row.ID, row.Name, row.Phone
		coupleName := info.BrideName + " & " + info.GroomName
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

// statusHTTPCode memetakan error domain ke status HTTP - dipakai presentation.
func StatusHTTPCode(err error) int {
	switch {
	case errors.Is(err, ErrNotFound):
		return 404
	case errors.Is(err, ErrInvalidSide), errors.Is(err, ErrInvalidStatus),
		errors.Is(err, ErrInvalidGender), errors.Is(err, ErrInvalidInvitationType), errors.Is(err, ErrInvalidSouvenirType),
		errors.Is(err, ErrInvalidAttendingCount):
		return 400
	default:
		return 500
	}
}
