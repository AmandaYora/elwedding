// Package infrastructure - tgclient.go adalah SATU-SATUNYA file yang boleh
// mengimpor github.com/gotd/td secara langsung (pola waclient.go milik modul
// whatsapp: application hanya bergantung pada method di TGClient ini, tidak
// pernah pada tipe gotd secara langsung).
//
// Beda dari WAClient yang memegang koneksi persisten: TGClient bekerja
// ONE-SHOT - setiap operasi membuka koneksi MTProto sendiri lewat client.Run,
// memakai ulang sesi di file, lalu menutupnya. Alasannya skala: pengiriman QR
// terjadi puluhan kali per acara, bukan ribuan per menit, sehingga harga
// connect 1-2 detik per kiriman dapat diterima dan tidak ada state koneksi
// yang perlu diawasi supervisor.
package infrastructure

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/gotd/td/session"
	"github.com/gotd/td/telegram"
	"github.com/gotd/td/telegram/auth"
	"github.com/gotd/td/telegram/message"
	"github.com/gotd/td/telegram/message/styling"
	"github.com/gotd/td/telegram/uploader"
	"github.com/gotd/td/tg"
	"github.com/gotd/td/tgerr"
)

// Sentinel yang diterjemahkan service jadi keputusan
// permanen-vs-retryable (pola IsNotConnectedError/IsDatabaseLockedError di
// waclient.go).
var (
	// ErrNotAuthorized berarti belum ada sesi sah - butuh login oleh admin
	// (permanen, menunggu tidak membantu).
	ErrNotAuthorized = errors.New("telegram belum tertaut")
	// ErrAlreadyAuthorized berarti sesi sudah sah - pengiriman kode sia-sia.
	ErrAlreadyAuthorized = errors.New("telegram sudah tertaut")
	// ErrCodeInvalid berarti kode OTP salah/kedaluwarsa - admin mengulang
	// dari login/start.
	ErrCodeInvalid = errors.New("kode OTP salah atau kedaluwarsa")
	// ErrPasswordNeeded berarti akun memakai 2FA - lengkapi password lewat
	// login/complete.
	ErrPasswordNeeded = errors.New("akun memakai verifikasi 2 langkah, kirim password")
	// ErrRecipientNotFound berarti username tidak dikenal Telegram
	// (salah ketik atau akun dihapus) - mengulang tidak membantu.
	ErrRecipientNotFound = errors.New("username Telegram tidak ditemukan")
)

// FloodWaitError membawa jeda yang diminta Telegram sesudah pacing dilanggar.
// Dibungkus dari tgerr.AsFloodWait supaya application tidak perlu mengimpor
// tgerr sendiri.
type FloodWaitError struct {
	After time.Duration
}

func (e *FloodWaitError) Error() string {
	return fmt.Sprintf("dibatasi Telegram, coba lagi dalam %s", e.After.Round(time.Second))
}

// IsFloodWaitError melaporkan apakah err berakar pada FloodWait dan
// mengembalikan jedanya.
func IsFloodWaitError(err error) (time.Duration, bool) {
	var fw *FloodWaitError
	if errors.As(err, &fw) {
		return fw.After, true
	}
	return 0, false
}

// Batas kerja per operasi one-shot. Connect MTProto (termasuk penemuan DC)
// umumnya 1-3 detik; 45 detik memberi ruang untuk jaringan lambat tanpa
// menggantung worker retry (yang memproses berurutan).
const (
	opTimeout   = 45 * time.Second
	authTimeout = 60 * time.Second
)

// TGClient membungkus kredensial userbot. Tidak menyimpan koneksi - setiap
// method membangun telegram.Client baru di atas FileStorage yang sama,
// sehingga aman dipakai dari banyak goroutine tanpa lock.
type TGClient struct {
	appID       int
	appHash     string
	phone       string
	sessionPath string
}

// NewTGClient memvalidasi kredensial lebih dulu: appID/appHash dari
// my.telegram.org, phone nomor akun pengirim. Kegagalan di sini membuat
// telegram.New di telegram.module.go mengembalikan modul nonaktif (pola
// whatsapp.New) - RSVP tetap berjalan tanpa kirim QR Telegram.
func NewTGClient(appID int, appHash, phone, sessionPath string) (*TGClient, error) {
	if appID <= 0 || appHash == "" {
		return nil, fmt.Errorf("TG_API_ID/TG_API_HASH belum terisi")
	}
	if phone == "" {
		return nil, fmt.Errorf("TG_PHONE belum terisi")
	}
	if sessionPath == "" {
		return nil, fmt.Errorf("TG_SESSION_PATH belum terisi")
	}
	if err := os.MkdirAll(filepath.Dir(sessionPath), 0o755); err != nil {
		return nil, fmt.Errorf("gagal membuat folder sesi Telegram: %w", err)
	}
	return &TGClient{appID: appID, appHash: appHash, phone: phone, sessionPath: sessionPath}, nil
}

// Phone mengembalikan nomor akun pengirim untuk ditampilkan di dashboard.
func (c *TGClient) Phone() string {
	return c.phone
}

// HasStoredSession true bila ADA file sesi non-kosong. Ini gerbang
// KEJUJURAN seperti WAClient.HasStoredSession: tanpa file, login ulang oleh
// admin adalah satu-satunya jalan (permanen); dengan file tetapi RPC gagal,
// masalahnya di jaringan (retryable).
func (c *TGClient) HasStoredSession() bool {
	st, err := os.Stat(c.sessionPath)
	if err != nil {
		return false
	}
	return st.Size() > 0
}

// DeleteSession menghapus file sesi lokal. Dipakai Logout SESUDAH RPC
// AuthLogOut dicoba - sesi lokal SELALU bersih apa pun hasil RPC-nya
// (keputusan D2 modul whatsapp).
func (c *TGClient) DeleteSession() error {
	if err := os.Remove(c.sessionPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("gagal menghapus sesi Telegram: %w", err)
	}
	return nil
}

// run membuka koneksi one-shot dan menjalankan fn di dalamnya. Sesi
// dimuat/disimpan otomatis oleh FileStorage; NoUpdates karena klien ini
// hanya mengirim, tidak pernah membaca update.
func (c *TGClient) run(ctx context.Context, fn func(ctx context.Context, api *tg.Client, authClient *auth.Client) error) error {
	client := telegram.NewClient(c.appID, c.appHash, telegram.Options{
		SessionStorage: &session.FileStorage{Path: c.sessionPath},
		NoUpdates:      true,
	})
	return client.Run(ctx, func(ctx context.Context) error {
		return fn(ctx, client.API(), client.Auth())
	})
}

// CheckAuth true bila sesi tersimpan MASIH SAH di server.
func (c *TGClient) CheckAuth(ctx context.Context) (bool, error) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	var authorized bool
	err := c.run(ctx, func(ctx context.Context, _ *tg.Client, authClient *auth.Client) error {
		status, err := authClient.Status(ctx)
		if err != nil {
			return err
		}
		authorized = status.Authorized
		return nil
	})
	if err != nil {
		return false, err
	}
	return authorized, nil
}

// SendCode meminta Telegram mengirim kode OTP ke nomor HP akun dan
// mengembalikan phoneCodeHash untuk dipakai CompleteLogin. Hash-nya TIDAK
// dikembalikan ke browser - service menyimpannya di memori.
func (c *TGClient) SendCode(ctx context.Context) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, authTimeout)
	defer cancel()
	var hash string
	err := c.run(ctx, func(ctx context.Context, _ *tg.Client, authClient *auth.Client) error {
		status, err := authClient.Status(ctx)
		if err != nil {
			return err
		}
		if status.Authorized {
			return ErrAlreadyAuthorized
		}
		sent, err := authClient.SendCode(ctx, c.phone, auth.SendCodeOptions{})
		if err != nil {
			return err
		}
		switch s := sent.(type) {
		case *tg.AuthSentCode:
			hash = s.PhoneCodeHash
			return nil
		case *tg.AuthSentCodeSuccess:
			return ErrAlreadyAuthorized
		default:
			return fmt.Errorf("respons kirim kode tak dikenal (%T)", sent)
		}
	})
	if err != nil {
		return "", err
	}
	if hash == "" {
		return "", fmt.Errorf("Telegram tidak mengembalikan phone code hash")
	}
	return hash, nil
}

// CompleteLogin menukar kode OTP (+ password 2FA bila dibutuhkan) jadi sesi
// sah yang tersimpan di file. Password kosong + akun ber-2FA =
// ErrPasswordNeeded (bukan kegagalan) supaya dashboard tahu field apa yang
// harus diminta berikutnya.
func (c *TGClient) CompleteLogin(ctx context.Context, code, hash, password string) error {
	ctx, cancel := context.WithTimeout(ctx, authTimeout)
	defer cancel()
	return c.run(ctx, func(ctx context.Context, _ *tg.Client, authClient *auth.Client) error {
		_, err := authClient.SignIn(ctx, c.phone, code, hash)
		if err == nil {
			return nil
		}
		if errors.Is(err, auth.ErrPasswordAuthNeeded) {
			if password == "" {
				return ErrPasswordNeeded
			}
			if _, err := authClient.Password(ctx, password); err != nil {
				return mapRPCError(err)
			}
			return nil
		}
		return mapRPCError(err)
	})
}

// Logout mencabut sesi di server; kegagalan RPC-nya DIABAIKAN pemanggil
// (service tetap menghapus sesi lokal - keputusan D2 whatsapp).
func (c *TGClient) Logout(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	return c.run(ctx, func(ctx context.Context, api *tg.Client, _ *auth.Client) error {
		_, err := api.AuthLogOut(ctx)
		return err
	})
}

// SendText mengirim pesan TEKS biasa ke @username. Username TANPA @ juga
// diterima (service selalu menyimpan tanpa @; di sini dipastikan ber-@ untuk
// Resolve). Dipakai jalur undangan manual per tamu - beda dari SendPhoto yang
// dipakai jalur QR otomatis.
func (c *TGClient) SendText(ctx context.Context, username string, text string) error {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	return c.run(ctx, func(ctx context.Context, api *tg.Client, authClient *auth.Client) error {
		status, err := authClient.Status(ctx)
		if err != nil {
			return err
		}
		if !status.Authorized {
			return ErrNotAuthorized
		}
		sender := message.NewSender(api)
		if _, err := sender.Resolve("@"+username).Text(ctx, text); err != nil {
			if d, ok := tgerr.AsFloodWait(err); ok {
				return &FloodWaitError{After: d}
			}
			return mapRPCError(err)
		}
		return nil
	})
}

// SendPhoto mengunggah PNG lalu mengirimnya sebagai foto ke @username
// dengan caption. Username TANPA @ juga diterima (service selalu menyimpan
// tanpa @; di sini dipastikan ber-@ untuk Resolve).
func (c *TGClient) SendPhoto(ctx context.Context, username string, png []byte, caption string) error {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	return c.run(ctx, func(ctx context.Context, api *tg.Client, authClient *auth.Client) error {
		status, err := authClient.Status(ctx)
		if err != nil {
			return err
		}
		if !status.Authorized {
			return ErrNotAuthorized
		}
		u := uploader.NewUploader(api)
		file, err := u.FromBytes(ctx, "qr.png", png)
		if err != nil {
			if d, ok := tgerr.AsFloodWait(err); ok {
				return &FloodWaitError{After: d}
			}
			return fmt.Errorf("gagal unggah gambar: %w", err)
		}
		sender := message.NewSender(api)
		if _, err := sender.Resolve("@"+username).UploadedPhoto(ctx, file, styling.Plain(caption)); err != nil {
			if d, ok := tgerr.AsFloodWait(err); ok {
				return &FloodWaitError{After: d}
			}
			return mapRPCError(err)
		}
		return nil
	})
}

// mapRPCError menerjemahkan error MTProto yang tindak lanjutnya JELAS jadi
// sentinel di atas; sisanya dibungkus apa adanya (service memperlakukannya
// permanen - menandai retryable hanya berujung satu baris failed yang bisa
// dikirim ulang manual, sedangkan salah menandai retryable berujung pesan
// ganda - tabel §5.3.2 whatsapp-connection-resilience).
func mapRPCError(err error) error {
	if err == nil {
		return nil
	}
	var rpcErr *tgerr.Error
	if errors.As(err, &rpcErr) {
		switch rpcErr.Type {
		case "PHONE_CODE_INVALID", "PHONE_CODE_EMPTY", "PHONE_CODE_EXPIRED":
			return ErrCodeInvalid
		case "PASSWORD_HASH_INVALID", "PASSWORD_EMPTY":
			return fmt.Errorf("%w: password 2FA salah", ErrCodeInvalid)
		case "USERNAME_NOT_OCCUPIED", "USERNAME_INVALID", "PEER_ID_INVALID":
			return ErrRecipientNotFound
		case "USER_PRIVACY_RESTRICTED", "USER_IS_BLOCKED", "INPUT_USER_DEACTIVATED":
			return fmt.Errorf("tidak bisa mengirim ke akun itu (%s)", rpcErr.Type)
		case "AUTH_KEY_UNREGISTERED", "SESSION_REVOKED":
			return ErrNotAuthorized
		}
	}
	return err
}
