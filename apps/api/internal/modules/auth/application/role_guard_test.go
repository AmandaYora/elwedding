package application

import (
	"errors"
	"testing"
)

// canDeleteAdmin & canChangeRole diuji sebagai fungsi murni, BUKAN lewat
// method Delete/Update yang menyentuh repo (docs/plan/scan-checkin-gate/
// PLAN.md T11) - Service memegang *infrastructure.Repository konkret.

func TestCanDeleteAdmin(t *testing.T) {
	tests := []struct {
		name           string
		targetRole     string
		fullAdminCount int
		wantErr        error
	}{
		{"admin penuh terakhir ditolak", RoleAdmin, 1, ErrCannotDeleteLastAdmin},
		{"admin penuh saat masih ada 2 boleh", RoleAdmin, 2, nil},
		// INILAH regresi §2.3 yang dijaga: dengan repo.Count() apa adanya,
		// 1 admin + 3 petugas = 4 sehingga admin penuh terakhir lolos
		// dihapus. Kebalikannya juga penting - menghapus PETUGAS tidak boleh
		// pernah terhalang jumlah admin, walau admin penuh tinggal satu.
		{"petugas boleh dihapus walau admin penuh tinggal 1", RoleScanner, 1, nil},
		{"petugas boleh dihapus saat tidak ada admin penuh sama sekali", RoleScanner, 0, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := canDeleteAdmin(tt.targetRole, tt.fullAdminCount)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("canDeleteAdmin(%q, %d) = %v, mau %v", tt.targetRole, tt.fullAdminCount, err, tt.wantErr)
			}
		})
	}
}

func TestCanChangeRole(t *testing.T) {
	tests := []struct {
		name           string
		currentRole    string
		newRole        string
		fullAdminCount int
		wantErr        error
	}{
		// Menurunkan admin penuh terakhir mengunci sistem persis seperti
		// menghapusnya - tidak ada lagi akun yang bisa membuka menu Pengguna.
		{"turunkan admin penuh terakhir ditolak", RoleAdmin, RoleScanner, 1, ErrCannotDemoteLastAdmin},
		{"turunkan admin saat masih ada 2 boleh", RoleAdmin, RoleScanner, 2, nil},
		{"naikkan petugas jadi admin selalu boleh", RoleScanner, RoleAdmin, 1, nil},
		{"naikkan petugas walau belum ada admin penuh", RoleScanner, RoleAdmin, 0, nil},
		{"admin tetap admin boleh", RoleAdmin, RoleAdmin, 1, nil},
		{"petugas tetap petugas boleh", RoleScanner, RoleScanner, 1, nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := canChangeRole(tt.currentRole, tt.newRole, tt.fullAdminCount)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("canChangeRole(%q, %q, %d) = %v, mau %v", tt.currentRole, tt.newRole, tt.fullAdminCount, err, tt.wantErr)
			}
		})
	}
}
