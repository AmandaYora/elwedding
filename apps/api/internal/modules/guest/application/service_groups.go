package application

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"undangan-digital/internal/modules/guest/infrastructure/sqlc"
	"undangan-digital/internal/shared/pagination"
)

// CRUD group tamu - docs/plan/guest-groups/PLAN.md T5.
//
// Berkas TERPISAH dari service.go (pola service_lists.go milik modul content),
// tapi TETAP di modul & Service yang sama: guest_groups dimiliki modul guest
// (D1), jadi ini bukan modul baru dan tidak butuh contracts/ apa pun.

// Batas kedua kolom, dikunci migration 000016. Divalidasi di sini supaya
// admin menerima 400 yang menjelaskan batasnya, bukan 500 dari MySQL strict
// mode (atau - lebih buruk - pemotongan diam-diam di mode non-strict).
const (
	groupNameMaxLen        = 100
	groupDescriptionMaxLen = 255
)

// Batas jatah kursi (docs/plan/guest-pax-quota/PLAN.md D3), dipakai BERSAMA
// oleh guests.pax_quota dan guest_groups.default_pax.
//
// Kolomnya TINYINT UNSIGNED yang muat sampai 255. Batas atas 20 bukan
// keterbatasan teknis melainkan penjaga salah ketik: tanpa itu, mengetik 200
// alih-alih 20 diam-diam meledakkan proyeksi catering dan tidak ada yang
// menyadarinya sampai vendor menagih. 20 sudah sangat longgar untuk "keluarga
// besar" di pernikahan intimate.
//
// KEMBAR LINTAS BAHASA dengan guest.schema.ts & group.schema.ts di frontend -
// browser tidak bisa memanggil konstanta Go. Yang di frontend hanya memberi
// pesan lebih cepat; penegakan sebenarnya di sini. Ubah keduanya bersamaan.
const (
	paxQuotaMin = 1
	paxQuotaMax = 20
)

// validatePaxQuota FUNGSI MURNI (diuji tanpa DB - pax_quota_test.go), pola
// validateGroupName di bawah. Dipakai DUA jalur: validateProfileFields untuk
// guests.pax_quota, dan CreateGroup/UpdateGroup untuk guest_groups.default_pax.
//
// 0 = field tidak dikirim klien, ditolak sama seperti GroupID 0 dan seperti
// string kosong pada enum wajib.
func validatePaxQuota(quota int) error {
	if quota < paxQuotaMin || quota > paxQuotaMax {
		return ErrInvalidPaxQuota
	}
	return nil
}

// canLowerPaxQuota FUNGSI MURNI (D10), dipisahkan dari Update supaya penjaga
// ini bisa diuji tanpa DB - pola canDeleteGroup di bawah.
//
// Tamu yang sudah berjanji 6 orang lalu jatahnya diturunkan admin jadi 4
// menghasilkan baris yang TIDAK KOHEREN: proyeksi catering tetap menghitung 6
// (karena jawaban tamu yang dipakai untuk status 'attending'), sementara
// jatahnya berkata 4. Ditolak lebih baik daripada menyimpan keadaan yang tidak
// bisa dijelaskan ke siapa pun.
//
// Angkanya IKUT di pesan, sama seperti canDeleteGroup yang menyebut "masih
// dipakai N tamu": admin ditolak sambil diberi tahu angka yang harus ia hadapi,
// bukan sekadar "gagal".
//
// HANYA berlaku untuk status 'attending'. Tamu 'pending'/'remind_later' belum
// berjanji apa pun, dan 'not_attending' tidak menempati kursi - jatah keduanya
// bebas diturunkan.
func canLowerPaxQuota(status string, attendingCount, newQuota int) error {
	if status == "attending" && newQuota < attendingCount {
		return fmt.Errorf("%w karena tamu sudah mengonfirmasi %d orang", ErrPaxQuotaBelowConfirmed, attendingCount)
	}
	return nil
}

// validateGroupName FUNGSI MURNI (diuji tanpa DB - group_test.go). Trim
// dilakukan di dalam supaya nama berisi spasi saja ditolak sama seperti nama
// kosong; pemanggil menyimpan versi ter-trim yang sama.
func validateGroupName(name string) error {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return ErrGroupNameRequired
	}
	// Dihitung per RUNE, bukan per byte: huruf beraksen memakai 2 byte di
	// UTF-8 sedangkan VARCHAR(100) MySQL menghitung KARAKTER. Memakai len()
	// akan menolak nama yang sebenarnya masih muat di kolomnya.
	if len([]rune(trimmed)) > groupNameMaxLen {
		return ErrGroupNameTooLong
	}
	return nil
}

// validateGroupDescription - deskripsi BOLEH kosong (K3: kolomnya NOT NULL
// DEFAULT string kosong), yang dibatasi hanya panjangnya.
func validateGroupDescription(description string) error {
	if len([]rune(strings.TrimSpace(description))) > groupDescriptionMaxLen {
		return ErrGroupDescriptionTooLong
	}
	return nil
}

// canDeleteGroup FUNGSI MURNI (K4), dipisahkan dari DeleteGroup supaya penjaga
// hapus bisa diuji tanpa DB - pola canDeleteAdmin di modul auth.
//
// Jumlahnya IKUT di pesan, dan itu inti K4: admin ditolak sambil diberi tahu
// berapa tamu yang harus dipindahkan lebih dulu, bukan sekadar "gagal".
func canDeleteGroup(guestCount int) error {
	if guestCount > 0 {
		return fmt.Errorf("%w karena masih dipakai %d tamu", ErrGroupInUse, guestCount)
	}
	return nil
}

func toGroupDTO(g sqlc.GuestGroup, guestCount int) GuestGroupDTO {
	return GuestGroupDTO{
		ID:          g.ID,
		Name:        g.Name,
		Description: g.Description,
		GuestCount:  guestCount,
		DefaultPax:  int(g.DefaultPax),
		CreatedAt:   g.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// ListGroups - 3 query TETAP, berapa pun jumlah group-nya (§6): ListGroups +
// CountGroups untuk paginasi, lalu SATU CountGroupedByGroup yang dipetakan ke
// map di memori.
//
// JANGAN menghitung tamu per baris di dalam loop - itu bentuk N+1 yang paling
// mudah muncul di fitur ini.
func (s *Service) ListGroups(ctx context.Context, p pagination.Params) ([]GuestGroupDTO, int, error) {
	total, err := s.repo.CountGroups(ctx)
	if err != nil {
		return nil, 0, err
	}
	rows, err := s.repo.ListGroups(ctx, int32(p.Limit), int32(p.Offset()))
	if err != nil {
		return nil, 0, err
	}
	countRows, err := s.repo.CountGroupedByGroup(ctx)
	if err != nil {
		return nil, 0, err
	}
	counts := make(map[uint64]int, len(countRows))
	for _, r := range countRows {
		if !r.GroupID.Valid {
			continue
		}
		counts[uint64(r.GroupID.Int64)] = int(r.Total)
	}

	out := make([]GuestGroupDTO, 0, len(rows))
	for _, r := range rows {
		// Group tanpa tamu tidak punya baris di hasil GROUP BY - zero value
		// map-nya (0) memang jawaban yang benar, jadi tidak perlu cabang.
		out = append(out, toGroupDTO(r, counts[r.ID]))
	}
	return out, int(total), nil
}

// CreateGroup - nama dicek UNIQUE lebih dulu (D5) supaya admin menerima
// "nama sudah dipakai" yang enak dibaca alih-alih error duplicate key mentah
// dari MySQL. Preseden: ErrUsernameTaken di modul auth.
func (s *Service) CreateGroup(ctx context.Context, in GuestGroupInput) (GuestGroupDTO, error) {
	name := strings.TrimSpace(in.Name)
	description := strings.TrimSpace(in.Description)
	if err := validateGroupName(name); err != nil {
		return GuestGroupDTO{}, err
	}
	if err := validateGroupDescription(description); err != nil {
		return GuestGroupDTO{}, err
	}
	if err := validatePaxQuota(in.DefaultPax); err != nil {
		return GuestGroupDTO{}, err
	}
	if _, err := s.repo.GetGroupByName(ctx, name); err == nil {
		return GuestGroupDTO{}, ErrGroupNameTaken
	} else if !errors.Is(err, sql.ErrNoRows) {
		return GuestGroupDTO{}, err
	}

	id, err := s.repo.CreateGroup(ctx, sqlc.CreateGuestGroupParams{
		Name: name, Description: description, DefaultPax: uint8(in.DefaultPax),
	})
	if err != nil {
		return GuestGroupDTO{}, err
	}
	row, err := s.repo.GetGroupByID(ctx, uint64(id))
	if err != nil {
		return GuestGroupDTO{}, err
	}
	// Group yang baru dibuat pasti 0 tamu - tidak perlu query hitung.
	return toGroupDTO(row, 0), nil
}

// UpdateGroup memastikan group-nya ADA lebih dulu (T5). Tanpa itu, UPDATE
// pada id yang tidak ada hanya menyentuh 0 baris dan endpoint membalas 200
// seolah berhasil - persis alasan modul auth memanggil GetByID dulu di Delete.
//
// Nama yang sama milik DIRINYA SENDIRI tetap boleh (bandingkan ID) - kalau
// tidak, admin tidak bisa menyunting deskripsi tanpa ikut mengganti nama.
func (s *Service) UpdateGroup(ctx context.Context, id uint64, in GuestGroupInput) error {
	name := strings.TrimSpace(in.Name)
	description := strings.TrimSpace(in.Description)
	if err := validateGroupName(name); err != nil {
		return err
	}
	if err := validateGroupDescription(description); err != nil {
		return err
	}
	if err := validatePaxQuota(in.DefaultPax); err != nil {
		return err
	}
	if _, err := s.repo.GetGroupByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrGroupNotFound
		}
		return err
	}
	if existing, err := s.repo.GetGroupByName(ctx, name); err == nil {
		if existing.ID != id {
			return ErrGroupNameTaken
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	return s.repo.UpdateGroup(ctx, sqlc.UpdateGuestGroupParams{
		Name: name, Description: description, DefaultPax: uint8(in.DefaultPax), ID: id,
	})
}

// DeleteGroup - urutannya WAJIB: GetGroupByID -> CountGuestsByGroupID ->
// canDeleteGroup -> Delete (K4).
//
// COUNT dijalankan tepat sebelum hapus supaya angkanya sesegar mungkin. FK
// RESTRICT (D7) adalah lapis KEDUA yang menjaga jalur lain (skrip, query
// manual), bukan pengganti penjaga ini - hanya di sini pesannya bisa
// menyebutkan jumlah tamunya.
func (s *Service) DeleteGroup(ctx context.Context, id uint64) error {
	if _, err := s.repo.GetGroupByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrGroupNotFound
		}
		return err
	}
	guestCount, err := s.repo.CountGuestsByGroupID(ctx, id)
	if err != nil {
		return err
	}
	if err := canDeleteGroup(int(guestCount)); err != nil {
		return err
	}
	return s.repo.DeleteGroup(ctx, id)
}

// validateGroupID menegakkan "tamu WAJIB bergroup" DI BACKEND (D4), bukan
// cuma di form. Ini pola rumah yang sudah ada: validGenders mewajibkan gender
// saat Create/Update PADAHAL kolomnya nullable di database - K2 adalah
// situasi yang identik, jadi penegakannya mengikuti pola yang sama persis.
// Form yang mewajibkan tanpa backend yang menegakkan hanya menahan pengguna
// yang sopan.
//
// 0 = field tidak dikirim klien, ditolak sama seperti string kosong pada enum.
func (s *Service) validateGroupID(ctx context.Context, id uint64) error {
	if id == 0 {
		return ErrGroupNotFound
	}
	if _, err := s.repo.GetGroupByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrGroupNotFound
		}
		return err
	}
	return nil
}

// parseGroupIDFilter menerjemahkan query param `group_id` jadi argumen narg.
//
// String kosong = TANPA filter: zero value sql.NullInt64 (Valid:false) berarti
// NULL, yang oleh klausa `IS NULL OR ...` diartikan "abaikan filter ini" -
// persis pola status/invitation_type/souvenir_type di query yang sama (§2.3).
//
// Nilai non-numerik adalah permintaan yang salah bentuk, BUKAN "tanpa filter":
// mendiamkannya membuat filter yang rusak terlihat seperti berhasil.
func parseGroupIDFilter(groupID string) (sql.NullInt64, error) {
	if groupID == "" {
		return sql.NullInt64{}, nil
	}
	id, err := strconv.ParseUint(groupID, 10, 64)
	if err != nil || id == 0 {
		return sql.NullInt64{}, ErrInvalidGroupID
	}
	return sql.NullInt64{Int64: int64(id), Valid: true}, nil
}
