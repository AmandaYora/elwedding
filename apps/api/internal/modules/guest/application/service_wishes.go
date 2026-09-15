package application

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	"github.com/go-sql-driver/mysql"

	"undangan-digital/internal/modules/guest/infrastructure/sqlc"
	"undangan-digital/internal/shared/pagination"
)

// Ucapan tamu (docs/plan/wedding-wish/PLAN.md T8/T9).
//
// Berkas TERPISAH dari service.go, preseden service_groups.go: satu berkas per
// bidang, tapi TETAP di modul & Service yang sama - wedding_wishes dimiliki
// modul guest (D5), jadi bukan modul baru dan tidak butuh contracts/ apa pun.
const (
	// publicWishLimit mengunci keputusan D7 (30 terbaru di slider) agar tidak
	// berubah diam-diam - pola publicWishLimit di wish_test.go (U3).
	publicWishLimit = 30
	// maxWishLength SAMA dengan VARCHAR(500) di migration 000020. Divalidasi
	// di sini supaya tamu menerima 400 yang menjelaskan batasnya, bukan 500
	// dari MySQL strict mode (pola groupNameMaxLen di service_groups.go).
	maxWishLength = 500
)

// normalizeWishMessage FUNGSI MURNI (diuji tanpa DB - wish_test.go U1), pola
// validateGroupName di service_groups.go. Trim dilakukan di dalam supaya
// pesan berisi spasi saja ditolak sama seperti kosong; pemanggil menyimpan
// versi ter-trim yang sama. Panjang dihitung per RUNE, bukan per byte:
// VARCHAR(500) MySQL menghitung KARAKTER.
func normalizeWishMessage(raw string) (string, error) {
	msg := strings.TrimSpace(raw)
	if msg == "" {
		return "", ErrWishEmpty
	}
	if len([]rune(msg)) > maxWishLength {
		return "", ErrWishTooLong
	}
	return msg, nil
}

// isDuplicateKeyError mendeteksi tabrakan UNIQUE(guest_id) dari
// CreateWeddingWish. Pengecekan "sudah pernah" SEBELUM tulis bukan jaminan
// saat dua permintaan tiba bersamaan (dua tab, klik ganda, skrip) - UNIQUE di
// DB adalah lapis kedua yang menutup celah itu, dan di sinilah tabrakannya
// diterjemahkan kembali jadi ErrWishAlreadySubmitted yang enak dibaca (FASE 2
// diagram sekuens).
func isDuplicateKeyError(err error) bool {
	var mysqlErr *mysql.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == 1062
}

// SubmitWish menyimpan SATU ucapan untuk tamu pemilik token. Nama pengirim
// TIDAK diterima dari klien (D3) - diambil dari baris guests, sehingga tidak
// ada yang bisa mengaku sebagai tamu lain.
func (s *Service) SubmitWish(ctx context.Context, token, message string) error {
	row, err := s.repo.GetByToken(ctx, token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	msg, err := normalizeWishMessage(message)
	if err != nil {
		return err
	}
	if _, err := s.repo.GetWishByGuestID(ctx, row.ID); err == nil {
		return ErrWishAlreadySubmitted
	} else if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if _, err := s.repo.CreateWish(ctx, sqlc.CreateWeddingWishParams{
		GuestID: row.ID, Message: msg,
	}); err != nil {
		if isDuplicateKeyError(err) {
			return ErrWishAlreadySubmitted
		}
		return err
	}
	return nil
}

// ListPublicWishes mengembalikan maksimal publicWishLimit ucapan terbaru yang
// tidak disembunyikan. Token DIVERIFIKASI lebih dulu lewat GetByToken - tanpa
// itu penyarangan by-token/ hanya hiasan URL dan daftar nama tamu undangan
// bisa dipanen siapa pun (§3.5).
func (s *Service) ListPublicWishes(ctx context.Context, token string) ([]PublicWishDTO, error) {
	if _, err := s.repo.GetByToken(ctx, token); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	rows, err := s.repo.ListPublicWishes(ctx, publicWishLimit)
	if err != nil {
		return nil, err
	}
	out := make([]PublicWishDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, PublicWishDTO{
			ID: r.ID, GuestName: r.GuestName, GuestSide: string(r.GuestSide),
			Message: r.Message, CreatedAt: r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	return out, nil
}

// ListWishesAdmin - admin melihat SEMUA termasuk yang disembunyikan, pola
// identik ListLogs/ListGroups (Count + List + Meta di handler).
func (s *Service) ListWishesAdmin(ctx context.Context, p pagination.Params) ([]WishAdminDTO, int, error) {
	total, err := s.repo.CountWishes(ctx)
	if err != nil {
		return nil, 0, err
	}
	rows, err := s.repo.ListWishesAdmin(ctx, sqlc.ListWeddingWishesAdminParams{
		Limit: int32(p.Limit), Offset: int32(p.Offset()),
	})
	if err != nil {
		return nil, 0, err
	}
	out := make([]WishAdminDTO, 0, len(rows))
	for _, r := range rows {
		out = append(out, WishAdminDTO{
			ID: r.ID, GuestID: r.GuestID, GuestName: r.GuestName, GuestSide: string(r.GuestSide),
			Message: r.Message, IsHidden: r.IsHidden,
			CreatedAt: r.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		})
	}
	return out, int(total), nil
}

// SetWishHidden menyembunyikan/menampilkan kembali ucapan (D2). Baris dipastikan
// ADA lebih dulu supaya id yang tidak ada dibalas 404, bukan 200 palsu.
func (s *Service) SetWishHidden(ctx context.Context, id uint64, hidden bool) error {
	if _, err := s.repo.GetWishByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrWishNotFound
		}
		return err
	}
	return s.repo.SetWishHidden(ctx, sqlc.SetWeddingWishHiddenParams{
		IsHidden: hidden, ID: id,
	})
}

// DeleteWish menghapus permanen. guest_id bebas kembali sehingga tamu itu
// boleh mengisi ulang - tidak seperti hapus group yang ditolak saat dipakai.
func (s *Service) DeleteWish(ctx context.Context, id uint64) error {
	if _, err := s.repo.GetWishByID(ctx, id); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ErrWishNotFound
		}
		return err
	}
	return s.repo.DeleteWish(ctx, id)
}
