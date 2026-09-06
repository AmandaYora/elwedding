package application

import (
	"testing"

	"undangan-digital/internal/modules/guest/infrastructure/sqlc"
)

// Proyeksi catering (docs/plan/guest-pax-quota/PLAN.md T14/§5).
//
// Angka di sini meniru contoh kartu di PLAN.md §5 supaya kalau suatu saat
// hasilnya bergeser, yang gagal adalah test - bukan pesanan catering.

func sideRowsContoh() []sqlc.CountGuestsGroupedBySideRow {
	return []sqlc.CountGuestsGroupedBySideRow{
		{
			Side: sqlc.GuestsSideGroom, Total: 30,
			ConfirmedPax: 38, ExpectedPax: 15,
			ExcludedNotAttending: 5, ExcludedNotExpected: 3,
		},
		{
			Side: sqlc.GuestsSideBride, Total: 35,
			ConfirmedPax: 44, ExpectedPax: 21,
			ExcludedNotAttending: 4, ExcludedNotExpected: 1,
		},
	}
}

func TestBuildSummaryDTO_ProyeksiPaxPerPihak(t *testing.T) {
	got := buildSummaryDTO(nil, nil, nil, sideRowsContoh(), nil, nil)

	cases := []struct {
		field string
		got   int
		want  int
	}{
		{"ConfirmedPaxGroom", got.ConfirmedPaxGroom, 38},
		{"ConfirmedPaxBride", got.ConfirmedPaxBride, 44},
		{"ConfirmedPaxTotal", got.ConfirmedPaxTotal, 82},
		{"ExpectedPaxGroom", got.ExpectedPaxGroom, 15},
		{"ExpectedPaxBride", got.ExpectedPaxBride, 21},
		{"ExpectedPaxTotal", got.ExpectedPaxTotal, 36},
		{"ProjectedPaxGroom", got.ProjectedPaxGroom, 53},
		{"ProjectedPaxBride", got.ProjectedPaxBride, 65},
		{"ProjectedPaxTotal", got.ProjectedPaxTotal, 118},
		{"ExcludedNotAttending", got.ExcludedNotAttending, 9},
		{"ExcludedNotExpected", got.ExcludedNotExpected, 4},
		// Hitungan undangan per pihak (perilaku lama) tidak boleh ikut rusak.
		{"SideGroom", got.SideGroom, 30},
		{"SideBride", got.SideBride, 35},
	}
	for _, c := range cases {
		if c.got != c.want {
			t.Errorf("%s = %d, want %d", c.field, c.got, c.want)
		}
	}
}

// Invariannya, bukan angkanya: proyeksi SELALU jumlah dari fakta + tebakan.
// Kalau suatu saat penjumlahannya dipindah ke SQL atau ke frontend, test ini
// yang menahan agar artinya tidak berubah diam-diam.
func TestBuildSummaryDTO_ProyeksiAdalahKonfirmasiPlusPerkiraan(t *testing.T) {
	got := buildSummaryDTO(nil, nil, nil, sideRowsContoh(), nil, nil)

	if got.ProjectedPaxGroom != got.ConfirmedPaxGroom+got.ExpectedPaxGroom {
		t.Errorf("ProjectedPaxGroom = %d, want %d+%d",
			got.ProjectedPaxGroom, got.ConfirmedPaxGroom, got.ExpectedPaxGroom)
	}
	if got.ProjectedPaxBride != got.ConfirmedPaxBride+got.ExpectedPaxBride {
		t.Errorf("ProjectedPaxBride = %d, want %d+%d",
			got.ProjectedPaxBride, got.ConfirmedPaxBride, got.ExpectedPaxBride)
	}
	if got.ProjectedPaxTotal != got.ProjectedPaxGroom+got.ProjectedPaxBride {
		t.Errorf("ProjectedPaxTotal = %d, want %d+%d",
			got.ProjectedPaxTotal, got.ProjectedPaxGroom, got.ProjectedPaxBride)
	}
}

// PALING PENTING (§T14): sideRows menghitung BARIS YANG SAMA dengan statusRows
// dari sudut pandang lain. Kalau ia ikut menambah Total, jumlah tamu di
// Ringkasan berlipat dua - dan itu jenis bug yang tidak terlihat sampai
// seseorang menghitung manual.
func TestBuildSummaryDTO_SideRowsTidakMenggelembungkanTotal(t *testing.T) {
	statusRows := []sqlc.CountGuestsGroupedByStatusRow{
		{RsvpStatus: sqlc.GuestsRsvpStatusAttending, Total: 30, TotalPax: 82},
		{RsvpStatus: sqlc.GuestsRsvpStatusPending, Total: 35},
	}

	got := buildSummaryDTO(statusRows, nil, nil, sideRowsContoh(), nil, nil)

	if got.Total != 65 {
		t.Fatalf("Total = %d, want 65 (HANYA dari statusRows)", got.Total)
	}
	// AttendingPax lama tidak berubah artinya (D7) - kartu "Akan hadir" yang
	// sudah ada memakainya dan tidak boleh ikut goyang.
	if got.AttendingPax != 82 {
		t.Fatalf("AttendingPax = %d, want 82", got.AttendingPax)
	}
}

// Belum ada tamu sama sekali: seluruh angka pax 0, tidak panic. Ini keadaan
// nyata di hari pertama dashboard dibuka.
func TestBuildSummaryDTO_ProyeksiKosong(t *testing.T) {
	got := buildSummaryDTO(nil, nil, nil, nil, nil, nil)

	if got.ProjectedPaxTotal != 0 || got.ConfirmedPaxTotal != 0 || got.ExpectedPaxTotal != 0 {
		t.Fatalf("proyeksi tanpa tamu harus 0, dapat %+v", got)
	}
	if got.ExcludedNotAttending != 0 || got.ExcludedNotExpected != 0 {
		t.Fatalf("excluded tanpa tamu harus 0, dapat %+v", got)
	}
}

// Hanya satu pihak yang punya tamu (lumrah di awal input). Pihak yang belum
// ada TETAP 0 dan tetap muncul di respons, bukan hilang - V3 admin-ui-redesign.
func TestBuildSummaryDTO_ProyeksiSatuPihakSaja(t *testing.T) {
	sideRows := []sqlc.CountGuestsGroupedBySideRow{
		{Side: sqlc.GuestsSideGroom, Total: 10, ConfirmedPax: 12, ExpectedPax: 4},
	}

	got := buildSummaryDTO(nil, nil, nil, sideRows, nil, nil)

	if got.ConfirmedPaxBride != 0 || got.ExpectedPaxBride != 0 || got.ProjectedPaxBride != 0 {
		t.Errorf("pihak wanita tanpa tamu harus 0, dapat %+v", got)
	}
	// Totalnya tetap terisi dari satu-satunya baris yang ada.
	if got.ProjectedPaxTotal != 16 {
		t.Errorf("ProjectedPaxTotal = %d, want 16", got.ProjectedPaxTotal)
	}
	// Dan groom + bride tetap sama dengan total - invarian yang membuat kartu
	// "Pria | Wanita | Total" selalu konsisten dibaca.
	if got.ProjectedPaxGroom+got.ProjectedPaxBride != got.ProjectedPaxTotal {
		t.Errorf("groom+bride (%d) != total (%d)",
			got.ProjectedPaxGroom+got.ProjectedPaxBride, got.ProjectedPaxTotal)
	}
}
