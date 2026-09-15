package application

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	// Satu-satunya import whatsmeow di luar waclient.go, KHUSUS test: hanya
	// memakai sentinel ErrNotConnected sebagai DATA fixture (tidak ada client,
	// tidak ada koneksi). Graph dependensi produksi tidak berubah - biner test
	// toh sudah me-link whatsmeow secara transitif lewat infrastructure.
	"go.mau.fi/whatsmeow"

	// Blank import KHUSUS test: genuineBusyError membuka DB SQLite langsung
	// untuk memproduksi SQLITE_BUSY asli (lihat komentarnya).
	_ "modernc.org/sqlite"

	"undangan-digital/internal/modules/whatsapp/infrastructure/sqlc"
)

// Menguji normalisasi nomor lokal (08xx) & format +62 ke 62xxxxxxxxxx yang
// dipakai types.NewJID (dashboard-wa-rsvp §9.3/E2).
func TestNormalizePhone(t *testing.T) {
	cases := []struct {
		in     string
		want   string
		wantOK bool
	}{
		{"08123456789", "628123456789", true},
		{"+628123456789", "628123456789", true},
		{"628123456789", "628123456789", true},
		{"0812-3456-789", "628123456789", true},
		{" 08123456789 ", "628123456789", true},
		{"", "", false},
		{"   ", "", false},
	}
	for _, tc := range cases {
		got, ok := normalizePhone(tc.in)
		if ok != tc.wantOK {
			t.Errorf("normalizePhone(%q) ok = %v, want %v", tc.in, ok, tc.wantOK)
			continue
		}
		if ok && got != tc.want {
			t.Errorf("normalizePhone(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

// Menguji substitusi placeholder template pesan (dashboard-wa-rsvp §6.2).
func TestApplyTemplate(t *testing.T) {
	tpl := "Halo {nama}! Kehadiran {jumlah} orang di pernikahan {mempelai} pada {tanggal}."
	got := applyTemplate(tpl, "Budi", 2, "Siti & Budi", "Minggu, 12 Oktober 2026")
	want := "Halo Budi! Kehadiran 2 orang di pernikahan Siti & Budi pada Minggu, 12 Oktober 2026."
	if got != want {
		t.Fatalf("applyTemplate() = %q, want %q", got, want)
	}
}

func TestApplyTemplate_MissingPlaceholdersLeftUntouched(t *testing.T) {
	got := applyTemplate("Pesan statis tanpa placeholder.", "Budi", 1, "A & B", "1 Jan 2026")
	want := "Pesan statis tanpa placeholder."
	if got != want {
		t.Fatalf("applyTemplate() = %q, want %q", got, want)
	}
}

// timeoutError meniru net.Error timeout supaya os.IsTimeout mengenalinya,
// tanpa koneksi jaringan apa pun.
type timeoutError struct{}

func (timeoutError) Error() string   { return "i/o timeout" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

// genuineBusyError menghasilkan SQLITE_BUSY ASLI untuk TestClassifySendError:
// koneksi pertama menahan write lock pada FILE database, koneksi kedua
// (tanpa busy_timeout) gagal seketika. WAJIB file, bukan shared-cache memory
// (shared-cache mengubah konflik jadi SQLITE_LOCKED + tunggu-selamanya).
// *sqlite.Error tidak bisa difabrikasi (field unexported), jadi kontensi
// sungguhan adalah satu-satunya cara jujur. Deterministik, tanpa timing
// (pola yang sama dengan wabusy_test.go di infrastructure).
func genuineBusyError(t *testing.T) error {
	t.Helper()
	ctx := context.Background()
	dir := t.TempDir()
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	db, err := sql.Open("sqlite", filepath.Join(dir, "classifybusy.db"))
	if err != nil {
		t.Fatalf("sql.Open: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if _, err := db.ExecContext(ctx, "CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)"); err != nil {
		t.Fatalf("CREATE TABLE: %v", err)
	}
	holder, err := db.Conn(ctx)
	if err != nil {
		t.Fatalf("Conn holder: %v", err)
	}
	t.Cleanup(func() { _ = holder.Close() })
	if _, err := holder.ExecContext(ctx, "BEGIN IMMEDIATE"); err != nil {
		t.Fatalf("BEGIN IMMEDIATE: %v", err)
	}
	if _, err := holder.ExecContext(ctx, "INSERT INTO t (v) VALUES ('x')"); err != nil {
		t.Fatalf("INSERT holder: %v", err)
	}

	contender, err := db.Conn(ctx)
	if err != nil {
		t.Fatalf("Conn contender: %v", err)
	}
	t.Cleanup(func() { _ = contender.Close() })
	_, err = contender.ExecContext(ctx, "INSERT INTO t (v) VALUES ('y')")
	if err == nil {
		t.Fatal("kontensi seharusnya gagal dengan SQLITE_BUSY, malah sukses")
	}
	return err
}

// U1: klasifikasi retryable vs permanen (§5.3.2). Default WAJIB permanen -
// error tak dikenal tidak boleh memicu kirim ulang (risiko pesan ganda).
func TestClassifySendError(t *testing.T) {
	wrappedNotConnected := fmt.Errorf("gagal unggah gambar: %w", whatsmeow.ErrNotConnected)
	// Rantai persis insiden produksi: LID-resolve gagal di store sesi.
	wrappedBusy := fmt.Errorf("gagal kirim pesan: failed to get LID for PN %s: %w",
		"628123456789@s.whatsapp.net", genuineBusyError(t))
	cases := []struct {
		name  string
		err   error
		retry bool
	}{
		{"ErrNotConnected terbungkus -> retryable", wrappedNotConnected, true},
		{"SQLITE_BUSY store sesi terbungkus -> retryable", wrappedBusy, true},
		{"DeadlineExceeded -> retryable", context.DeadlineExceeded, true},
		{"DeadlineExceeded terbungkus -> retryable", fmt.Errorf("upload: %w", context.DeadlineExceeded), true},
		{"timeout jaringan -> retryable", timeoutError{}, true},
		{"error validasi biasa -> permanen", errors.New("phone number too short"), false},
		{"context dibatalkan -> permanen", context.Canceled, false},
		{"nil -> permanen", nil, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := classifySendError(tc.err); got != tc.retry {
				t.Errorf("classifySendError(%v) = %v, want %v", tc.err, got, tc.retry)
			}
		})
	}
}

// U2: tabel backoff 1m, 5m, 15m, 60m, 180m; retryCount >= maxRetry terminal.
func TestNextRetryDelay(t *testing.T) {
	want := []time.Duration{time.Minute, 5 * time.Minute, 15 * time.Minute, time.Hour, 3 * time.Hour}
	for i, w := range want {
		if got := nextRetryDelay(i); got != w {
			t.Errorf("nextRetryDelay(%d) = %v, want %v", i, got, w)
		}
	}
	// Di luar tabel: dijepit ke entri terakhir, tidak pernah nol/negatif.
	if got := nextRetryDelay(99); got != 3*time.Hour {
		t.Errorf("nextRetryDelay(99) = %v, want %v", got, 3*time.Hour)
	}
	if got := nextRetryDelay(-1); got != time.Minute {
		t.Errorf("nextRetryDelay(-1) = %v, want %v", got, time.Minute)
	}
	// Tabel WAJIB sepanjang maxRetry: indeks valid = [0, maxRetry), dan
	// scheduleRetry memfinalkan failed tepat saat retryCount+1 > maxRetry.
	if len(retryBackoff) != maxRetry {
		t.Errorf("len(retryBackoff) = %d, want maxRetry = %d", len(retryBackoff), maxRetry)
	}
}

// U3: penantian kesiapan - true sejak awal, true saat berubah di tengah,
// false saat timeout habis, false saat context dibatalkan. Varian timeout
// disuntik singkat supaya suite tidak menunggu 20 detik penuh.
func TestWaitUntilReady(t *testing.T) {
	t.Run("siap sejak awal", func(t *testing.T) {
		if !waitUntilReadyWithTimeout(context.Background(), func() bool { return true }, time.Second, time.Millisecond) {
			t.Error("want true saat isReady sudah benar sejak awal")
		}
	})

	t.Run("siap di tengah penantian", func(t *testing.T) {
		var ready atomic.Bool
		go func() {
			time.Sleep(20 * time.Millisecond)
			ready.Store(true)
		}()
		if !waitUntilReadyWithTimeout(context.Background(), ready.Load, time.Second, time.Millisecond) {
			t.Error("want true saat isReady berubah benar di tengah penantian")
		}
	})

	t.Run("timeout habis", func(t *testing.T) {
		start := time.Now()
		if waitUntilReadyWithTimeout(context.Background(), func() bool { return false }, 50*time.Millisecond, time.Millisecond) {
			t.Error("want false saat timeout habis")
		}
		if elapsed := time.Since(start); elapsed > 5*time.Second {
			t.Errorf("menunggu %v, seharusnya ~50ms", elapsed)
		}
	})

	t.Run("context dibatalkan", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		go func() {
			time.Sleep(20 * time.Millisecond)
			cancel()
		}()
		if waitUntilReadyWithTimeout(ctx, func() bool { return false }, time.Minute, time.Millisecond) {
			t.Error("want false saat context dibatalkan")
		}
	})
}

// U4: perakitan DTO status - kombinasi loggedIn/connected/pairing, dan
// lastConnectedAt nil -> string kosong.
func TestBuildStatusDTO(t *testing.T) {
	now := time.Date(2026, 9, 15, 10, 0, 0, 0, time.UTC)
	got := buildStatusDTO(true, true, false, "", "", &now, "")
	if !got.LoggedIn || !got.Connected || got.Pairing {
		t.Errorf("siap: got %+v", got)
	}
	if got.LastConnectedAt != now.Format(time.RFC3339) {
		t.Errorf("LastConnectedAt = %q, want %q", got.LastConnectedAt, now.Format(time.RFC3339))
	}
	if got.LastError != "" {
		t.Errorf("LastError = %q, want kosong", got.LastError)
	}

	got = buildStatusDTO(true, false, false, "", "", nil, "koneksi WhatsApp terputus")
	if !got.LoggedIn || got.Connected {
		t.Errorf("terputus: got %+v", got)
	}
	if got.LastConnectedAt != "" {
		t.Errorf("LastConnectedAt nil = %q, want string kosong", got.LastConnectedAt)
	}
	if got.LastError != "koneksi WhatsApp terputus" {
		t.Errorf("LastError = %q", got.LastError)
	}

	got = buildStatusDTO(false, false, true, "2@qr", "", nil, "")
	if got.LoggedIn || got.Connected || !got.Pairing || got.PairingQR != "2@qr" {
		t.Errorf("pairing: got %+v", got)
	}
}

// U6: invarian anti-kirim-ganda (§3.1). Gagal di CI bila kelak ada yang
// menaikkan sendAttemptTimeout tanpa menaikkan stalePendingAfter.
func TestResilienceTimeoutInvariant(t *testing.T) {
	if stalePendingAfter <= readyWaitTimeout+sendAttemptTimeout {
		t.Errorf("INVARIAN RUSAK: stalePendingAfter (%v) harus > readyWaitTimeout (%v) + sendAttemptTimeout (%v)",
			stalePendingAfter, readyWaitTimeout, sendAttemptTimeout)
	}
}

// ErrNotPaired (Reconnect tanpa sesi) -> 400; ErrSocketDown murni internal
// dan TIDAK BOLEH masuk pemetaan (ia tidak pernah dikembalikan ke handler).
func TestStatusHTTPCodeResilience(t *testing.T) {
	if got := StatusHTTPCode(ErrNotPaired); got != 400 {
		t.Errorf("StatusHTTPCode(ErrNotPaired) = %d, want 400", got)
	}
	if got := StatusHTTPCode(ErrSocketDown); got == 400 || got == 404 {
		t.Errorf("StatusHTTPCode(ErrSocketDown) = %d, tidak boleh 400/404 (internal)", got)
	}
}

// --- regresi perbaikan pasca-verifikasi implementasi ---

// Temuan 2: pembukuan status log WAJIB tetap tertulis walau ctx pemanggil sudah
// mati (admin menutup tab saat Resend). Tanpa pelepasan pembatalan, tulisan DB
// ikut dibatalkan dan baris log menggantung di keadaan lamanya.
func TestBookkeepingContextSurvivesCancelledParent(t *testing.T) {
	parent, cancel := context.WithCancel(context.Background())
	cancel()
	if parent.Err() == nil {
		t.Fatal("prasyarat: parent seharusnya sudah dibatalkan")
	}

	ctx, release := bookkeeping(parent)
	defer release()

	if err := ctx.Err(); err != nil {
		t.Fatalf("ctx pembukuan tidak boleh ikut dibatalkan, dapat: %v", err)
	}
	deadline, ok := ctx.Deadline()
	if !ok {
		t.Fatal("ctx pembukuan wajib punya deadline sendiri agar tidak menggantung selamanya")
	}
	if remaining := time.Until(deadline); remaining <= 0 || remaining > bookkeepingTimeout {
		t.Fatalf("deadline di luar dugaan: sisa %v, bookkeepingTimeout %v", remaining, bookkeepingTimeout)
	}
}

// Temuan 3 & 4: hanya jalur SendQR (goroutine detached milik guest) yang boleh
// menunggu koneksi di tempat. Resend (HTTP sinkron) dan worker retry wajib
// memutuskan seketika - antrian retry sudah jadi jaring pengamannya.
func TestSendJobReadyRespectsWaitInline(t *testing.T) {
	neverReady := func() bool { return false }

	t.Run("waitInline=false memutuskan seketika", func(t *testing.T) {
		start := time.Now()
		if got := (sendJob{waitInline: false}).ready(context.Background(), neverReady); got {
			t.Fatal("ready() harus false saat koneksi mati")
		}
		if elapsed := time.Since(start); elapsed > time.Second {
			t.Fatalf("jalur sinkron tidak boleh menunggu, menghabiskan %v", elapsed)
		}
	})

	t.Run("waitInline=false tetap benar saat sudah siap", func(t *testing.T) {
		if got := (sendJob{waitInline: false}).ready(context.Background(), func() bool { return true }); !got {
			t.Fatal("ready() harus true saat koneksi siap")
		}
	})

	t.Run("waitInline=true menunggu sampai ctx dibatalkan", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		if got := (sendJob{waitInline: true}).ready(ctx, neverReady); got {
			t.Fatal("ready() harus false saat ctx sudah mati")
		}
	})
}

// jobFromLog wajib memindahkan SELURUH snapshot baris log - satu field yang
// terlewat berarti pesan retry terkirim dengan data yang salah.
func TestJobFromLogCarriesWholeSnapshot(t *testing.T) {
	row := sqlc.WhatsappSendLog{
		ID: 7, Phone: "08123456789", GuestName: "Budi", QrPayload: "ELW1:tok",
		CoupleName: "Siti & Budi", EventDateLabel: "Minggu, 12 Oktober 2026",
		AttendingCount: 3, RetryCount: 2,
	}
	job := jobFromLog(row, int(row.RetryCount), false)

	switch {
	case job.logID != row.ID:
		t.Errorf("logID = %d, want %d", job.logID, row.ID)
	case job.phone != row.Phone:
		t.Errorf("phone = %q, want %q", job.phone, row.Phone)
	case job.guestName != row.GuestName:
		t.Errorf("guestName = %q, want %q", job.guestName, row.GuestName)
	case job.qrPayload != row.QrPayload:
		t.Errorf("qrPayload = %q, want %q", job.qrPayload, row.QrPayload)
	case job.coupleName != row.CoupleName:
		t.Errorf("coupleName = %q, want %q", job.coupleName, row.CoupleName)
	case job.eventDateLabel != row.EventDateLabel:
		t.Errorf("eventDateLabel = %q, want %q", job.eventDateLabel, row.EventDateLabel)
	case job.attendingCount != int(row.AttendingCount):
		t.Errorf("attendingCount = %d, want %d", job.attendingCount, row.AttendingCount)
	case job.retryCount != int(row.RetryCount):
		t.Errorf("retryCount = %d, want %d", job.retryCount, row.RetryCount)
	case job.waitInline:
		t.Error("waitInline wajib false untuk jalur log (Resend & worker retry)")
	}
}
