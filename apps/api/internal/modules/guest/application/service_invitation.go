package application

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	tgContracts "undangan-digital/internal/modules/telegram/contracts"
	waContracts "undangan-digital/internal/modules/whatsapp/contracts"
)

// Kanal undangan manual per tamu (tombol kirim di menu Tamu). String bebas di
// query/body lalu divalidasi ketat di service - nilai selain keduanya ditolak
// 400, bukan didiamkan (pola ErrInvalidContactedFilter).
const (
	InvitationChannelWA = "wa"
	InvitationChannelTG = "tg"
)

var (
	// ErrInvalidInvitationChannel dipakai saat channel bukan wa/tg.
	//
	// KEDUA error undangan di bawah WAJIB terdaftar di cabang 400/503
	// StatusHTTPCode. Error domain yang lupa didaftarkan jatuh ke `default`
	// dan dibalas 500, sehingga salah klik admin tampak seperti server rusak.
	ErrInvalidInvitationChannel = errors.New("Kanal undangan tidak valid (pilih wa atau tg)")
	// ErrChannelUnavailable dipakai saat modul pengirim tidak aktif (sender
	// nil karena whatsapp/telegram.New gagal saat boot). Ini 503, bukan 400:
	// admin tidak salah apa-apa, servernya yang belum dikonfigurasi.
	ErrChannelUnavailable = errors.New("Modul pengirim tidak aktif di server ini")
	// ErrInvitationNoTarget dipakai saat tamu tidak punya alamat di kanal
	// itu (nomor HP / username Telegram kosong). Frontend menonaktifkan
	// tombolnya lebih dulu; ini lapis kedua untuk pemanggil langsung.
	ErrInvitationNoTarget = errors.New("Tamu belum punya nomor HP / username Telegram untuk kanal ini")
	// ErrInvitationFailed membungkus alasan gagal dari modul pengirim
	// (template kosong, belum tertaut, koneksi belum siap, FloodWait, ...).
	// Pesan aslinya dipertahankan supaya tampil apa adanya di modal.
	ErrInvitationFailed = errors.New("gagal mengirim undangan")
)

// InvitationPreviewDTO - respons GET .../invitation-preview. Text di-render
// modul pengirim dari template miliknya (source of truth); Target alamat
// kirim apa adanya dari baris tamu (validasi format final tetap di pengirim
// saat SendInvitation).
type InvitationPreviewDTO struct {
	Channel string `json:"channel"`
	Target  string `json:"target"`
	Text    string `json:"text"`
}

// PreviewInvitation menyusun preview undangan TANPA menyentuh koneksi dan
// tanpa efek samping. Link dibangun dari origin host admin (pola origin di
// router og_meta: satu host menyajikan admin + undangan publik).
func (s *Service) PreviewInvitation(ctx context.Context, id uint64, channel, origin string) (InvitationPreviewDTO, error) {
	row, err := s.requireGuestExists(ctx, id)
	if err != nil {
		return InvitationPreviewDTO{}, err
	}
	coupleName, eventDateLabel, err := s.invitationNames(ctx)
	if err != nil {
		return InvitationPreviewDTO{}, err
	}
	link := origin + "/?guest=" + row.Token
	switch channel {
	case InvitationChannelWA:
		if strings.TrimSpace(row.Phone) == "" {
			return InvitationPreviewDTO{}, ErrInvitationNoTarget
		}
		if s.sender == nil {
			return InvitationPreviewDTO{}, ErrChannelUnavailable
		}
		text, err := s.sender.PreviewInvitation(ctx, waContracts.PreviewInvitationInput{
			GuestName: row.Name, Link: link, CoupleName: coupleName, EventDateLabel: eventDateLabel,
		})
		if err != nil {
			return InvitationPreviewDTO{}, fmt.Errorf("%w: %s", ErrInvitationFailed, err.Error())
		}
		return InvitationPreviewDTO{Channel: channel, Target: strings.TrimSpace(row.Phone), Text: text}, nil
	case InvitationChannelTG:
		if strings.TrimSpace(row.UsernameTelegram) == "" {
			return InvitationPreviewDTO{}, ErrInvitationNoTarget
		}
		if s.tgSender == nil {
			return InvitationPreviewDTO{}, ErrChannelUnavailable
		}
		text, err := s.tgSender.PreviewInvitation(ctx, tgContracts.PreviewInvitationInput{
			GuestName: row.Name, TelegramUsername: row.UsernameTelegram,
			Link: link, CoupleName: coupleName, EventDateLabel: eventDateLabel,
		})
		if err != nil {
			return InvitationPreviewDTO{}, fmt.Errorf("%w: %s", ErrInvitationFailed, err.Error())
		}
		return InvitationPreviewDTO{Channel: channel, Target: "@" + strings.TrimSpace(row.UsernameTelegram), Text: text}, nil
	default:
		return InvitationPreviewDTO{}, ErrInvalidInvitationChannel
	}
}

// SendInvitation mengirim undangan manual per tamu secara SINKRON lewat modul
// pengirim, lalu menandai contacted_at bila sukses (keputusan: tanpa
// send_logs - undangan bukan QR).
//
// Beda dari jalur QR pasca-RSVP (goroutine detached + antrean retry): ini
// request admin yang menunggu jawaban. Gagal = error langsung untuk modal;
// admin menekan Kirim ulang bila ingin mencoba lagi.
func (s *Service) SendInvitation(ctx context.Context, id uint64, channel, origin string) error {
	row, err := s.requireGuestExists(ctx, id)
	if err != nil {
		return err
	}
	coupleName, eventDateLabel, err := s.invitationNames(ctx)
	if err != nil {
		return err
	}
	link := origin + "/?guest=" + row.Token
	switch channel {
	case InvitationChannelWA:
		if strings.TrimSpace(row.Phone) == "" {
			return ErrInvitationNoTarget
		}
		if s.sender == nil {
			return ErrChannelUnavailable
		}
		if err := s.sender.SendInvitation(ctx, waContracts.SendInvitationInput{
			GuestID: row.ID, GuestName: row.Name, Phone: row.Phone,
			Link: link, CoupleName: coupleName, EventDateLabel: eventDateLabel,
		}); err != nil {
			return fmt.Errorf("%w: %s", ErrInvitationFailed, err.Error())
		}
	case InvitationChannelTG:
		if strings.TrimSpace(row.UsernameTelegram) == "" {
			return ErrInvitationNoTarget
		}
		if s.tgSender == nil {
			return ErrChannelUnavailable
		}
		if err := s.tgSender.SendInvitation(ctx, tgContracts.SendInvitationInput{
			GuestID: row.ID, GuestName: row.Name, TelegramUsername: row.UsernameTelegram,
			Link: link, CoupleName: coupleName, EventDateLabel: eventDateLabel,
		}); err != nil {
			return fmt.Errorf("%w: %s", ErrInvitationFailed, err.Error())
		}
	default:
		return ErrInvalidInvitationChannel
	}
	// Pesan SUDAH terkirim pada titik ini. Kegagalan menandai contacted
	// dicatat saja - mengembalikannya sebagai error akan membuat admin
	// mengira pesan gagal lalu mengirim ganda, padahal tamu sudah
	// menerimanya. Penandanya bisa diperbaiki manual dari daftar tamu.
	if err := s.repo.MarkContacted(ctx, id); err != nil {
		log.Printf("guest: undangan %s untuk tamu %d terkirim tetapi penanda gagal disimpan: %v", channel, id, err)
	}
	return nil
}

// invitationNames membaca nama mempelai + label tanggal dari modul content
// lewat kontrak (keputusan #19) - SATU-SATUNYA cara modul ini boleh tahu isi
// undangan. Gagal di sini menggagalkan preview/kirim: tanpa keduanya teks
// tidak bisa disusun, dan jalur admin sinkron ini memang menunggu - beda dari
// jalur QR pasca-RSVP yang sengaja melewatkan kirim saat info gagal dibaca.
func (s *Service) invitationNames(ctx context.Context) (coupleName, eventDateLabel string, err error) {
	info, err := s.invitationInfo.GetQRInfo(ctx)
	if err != nil {
		return "", "", err
	}
	return info.GroomName + " & " + info.BrideName, info.WeddingDateLabel, nil
}
