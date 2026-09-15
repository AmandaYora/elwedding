package infrastructure

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Test deteksi SQLITE_BUSY store sesi (insiden produksi: "failed to get LID
// for PN ...: database is locked (5)"). Berkas TERPISAH dari waclient_test.go
// supaya tidak bertabrakan dengan pekerjaan paralel di berkas itu.

func TestStoreDSNHasBusyTimeout(t *testing.T) {
	dsn := waStoreDSN("wa.db")
	// busy_timeout>0 MENGUBAH perilaku driver dari gagal-seketika jadi
	// menunggu lock - hilangnya parameter ini diam-diam mengembalikan insiden.
	if !strings.Contains(dsn, "_busy_timeout=5000") {
		t.Errorf("waStoreDSN(%q) tidak memuat busy_timeout: %q", "wa.db", dsn)
	}
	if !strings.Contains(dsn, "_pragma=foreign_keys(1)") {
		t.Errorf("waStoreDSN(%q) kehilangan foreign_keys: %q", "wa.db", dsn)
	}
}

// genuineBusyError menghasilkan SQLITE_BUSY ASLI (bukan stub): koneksi pertama
// menahan write lock (BEGIN IMMEDIATE + INSERT tanpa commit) pada FILE database,
// koneksi kedua - yang SENGAJA tanpa busy_timeout, meniru perilaku driver
// SEBELUM perbaikan - gagal seketika.
//
// WAJIB file, bukan shared-cache memory: shared-cache mengubah konflik lock
// jadi SQLITE_LOCKED + unlock-notify yang MENUNGGU (pernah menggantung test
// ini selamanya), sedangkan produksi memakai file tanpa shared-cache sehingga
// konfliknya berupa SQLITE_BUSY seketika - bentuk yang direproduksi di sini.
//
// *sqlite.Error tidak bisa difabrikasi (field unexported): kontensi sungguhan
// adalah satu-satunya cara jujur menguji detector ini. Deterministik, tanpa
// timing: lock dipegang eksplisit, bukan hasil balapan.
func genuineBusyError(t *testing.T) error {
	t.Helper()
	ctx := context.Background()
	dir := t.TempDir()
	// Didaftarkan DULUAN supaya jalan TERAKHIR (LIFO): semua handle sudah
	// ditutup saat direktori dihapus - kalau tidak, Windows menolak hapus.
	t.Cleanup(func() { _ = os.RemoveAll(dir) })
	db, err := sql.Open("sqlite", filepath.Join(dir, "busy.db"))
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

func TestIsDatabaseLockedError(t *testing.T) {
	busy := genuineBusyError(t)

	if !IsDatabaseLockedError(busy) {
		t.Errorf("IsDatabaseLockedError(%v) = false, mau true", busy)
	}
	// Rantai produksi membungkus error berlapis ("failed to get LID for PN"
	// lalu "gagal kirim pesan") - detector wajib menembus bungkusan via
	// errors.As, bukan perbandingan langsung.
	wrapped := fmt.Errorf("gagal kirim pesan: failed to get LID for PN %s: %w", "628123456789@s.whatsapp.net", busy)
	if !IsDatabaseLockedError(wrapped) {
		t.Errorf("IsDatabaseLockedError(terbungkus) = false, mau true")
	}
	if IsDatabaseLockedError(nil) {
		t.Error("IsDatabaseLockedError(nil) = true, mau false")
	}
	if IsDatabaseLockedError(errors.New("websocket not connected")) {
		t.Error("IsDatabaseLockedError(error biasa) = true, mau false")
	}
	// Error SQLite LAIN (sintaks, Code 1) tidak boleh ikut terdeteksi -
	// detector mengunci kode 5, bukan "semua error database".
	db, _ := sql.Open("sqlite", "file:syntaxcheck?mode=memory&cache=shared")
	defer db.Close()
	_, syntaxErr := db.Exec("THIS IS NOT SQL")
	if syntaxErr == nil {
		t.Fatal("query sintaks salah seharusnya gagal")
	}
	if IsDatabaseLockedError(syntaxErr) {
		t.Errorf("IsDatabaseLockedError(syntax error %v) = true, mau false", syntaxErr)
	}
}
