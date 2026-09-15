package infrastructure

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
)

// newTestClient membuat WAClient di store SQLite sementara. Direktorinya
// DIBERSIHKAN secara best-effort, bukan lewat t.TempDir(): di Windows berkas
// SQLite masih dipegang container sampai proses berakhir, sehingga pembersihan
// t.TempDir() menggagalkan test yang sebenarnya lulus.
func newTestClient(t *testing.T) *WAClient {
	t.Helper()
	dir, err := os.MkdirTemp("", "wa-store-test")
	if err != nil {
		t.Fatalf("MkdirTemp: %v", err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(dir) })

	w, err := NewWAClient(context.Background(), filepath.Join(dir, "wa.db"))
	if err != nil {
		t.Fatalf("NewWAClient: %v", err)
	}
	t.Cleanup(w.Disconnect)
	return w
}

func (w *WAClient) generation() uint64 {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.gen
}

func TestSessionAlreadyGone(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"nil bukan 'sudah hilang'", nil, false},
		{"device sudah dihapus whatsmeow (jalur L2)", store.ErrDeviceDeleted, true},
		{"device belum pernah pairing (JID nil)", sqlstore.ErrDeviceIDMustBeSet, true},
		{"terbungkus tetap dikenali", errors.Join(errors.New("ctx"), sqlstore.ErrDeviceIDMustBeSet), true},
		{"kegagalan DB sungguhan tetap error", errors.New("disk I/O error"), false},
	}
	for _, tc := range cases {
		if got := sessionAlreadyGone(tc.err); got != tc.want {
			t.Errorf("%s: sessionAlreadyGone(%v) = %v, want %v", tc.name, tc.err, got, tc.want)
		}
	}
}

// REGRESI: ResetSession pada device tanpa JID - keadaan client tepat sesudah
// logout sukses, maupun sesudah perangkat dilepas dari HP - WAJIB berhasil dan
// TETAP membangun ulang client. Sebelum perbaikan, Container.DeleteDevice
// menolak dengan ErrDeviceIDMustBeSet, ResetSession mengembalikan error, dan
// Service.Logout meneruskannya menjadi 500 sehingga admin melihat lagi
// "Gagal memutus WhatsApp." (docs/plan/whatsapp-connection-resilience §2.3).
func TestResetSessionOnUnpairedDeviceSucceedsAndRebuilds(t *testing.T) {
	w := newTestClient(t)
	if w.HasStoredSession() {
		t.Fatal("prasyarat: device baru seharusnya belum punya JID")
	}
	before := w.generation()

	if err := w.ResetSession(context.Background()); err != nil {
		t.Fatalf("ResetSession pada device tanpa JID harus berhasil, dapat: %v", err)
	}
	if after := w.generation(); after <= before {
		t.Fatalf("client wajib dibangun ulang: generasi %d -> %d", before, after)
	}
}

// Logout yang ditekan dua kali (mis. dua tab admin, atau UI yang masih basi
// dalam jendela polling) tidak boleh menggagalkan yang kedua.
func TestResetSessionIsIdempotent(t *testing.T) {
	w := newTestClient(t)
	for i := 1; i <= 3; i++ {
		if err := w.ResetSession(context.Background()); err != nil {
			t.Fatalf("ResetSession ke-%d gagal: %v", i, err)
		}
	}
	if w.generation() < 4 {
		t.Fatalf("setiap ResetSession wajib membangun ulang client, generasi akhir=%d", w.generation())
	}
}

// Context pemanggil yang sudah dibatalkan (admin menutup tab saat Logout
// berjalan) tidak boleh meninggalkan client teracuni: apa pun hasil Delete,
// client baru wajib terpasang supaya admin bisa langsung pairing ulang.
func TestResetSessionRebuildsEvenWhenCallerContextCancelled(t *testing.T) {
	w := newTestClient(t)
	before := w.generation()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_ = w.ResetSession(ctx)

	if after := w.generation(); after <= before {
		t.Fatalf("client wajib tetap dibangun ulang walau ctx dibatalkan: generasi %d -> %d", before, after)
	}
}
