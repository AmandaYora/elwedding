package application

import (
	"reflect"
	"testing"

	"undangan-digital/internal/modules/guest/infrastructure/sqlc"
)

// GuestSummaryDTO sekarang memuat slice (RecentResponses), jadi tidak bisa
// dibandingkan dengan != langsung - dipakai reflect.DeepEqual di seluruh
// file ini.

// Menguji keputusan #11 & temuan V3 (admin-ui-redesign/PLAN.md): baris
// GROUP BY yang tidak lengkap (mis. belum ada tamu "remind_later") harus
// tetap menghasilkan DTO dengan field itu bernilai 0, bukan field yang
// hilang dari respons.
func TestBuildSummaryDTO_IncompleteGroupBy(t *testing.T) {
	statusRows := []sqlc.CountGuestsGroupedByStatusRow{
		{RsvpStatus: sqlc.GuestsRsvpStatusAttending, Total: 5, TotalPax: 8},
		{RsvpStatus: sqlc.GuestsRsvpStatusPending, Total: 3},
		// not_attending & remind_later sengaja TIDAK ada baris sama sekali
	}

got := buildSummaryDTO(statusRows, nil, nil, nil, nil, nil)

	want := GuestSummaryDTO{Total: 8, Attending: 5, NotAttending: 0, RemindLater: 0, Pending: 3, AttendingPax: 8, RecentResponses: []RecentResponseDTO{}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("buildSummaryDTO() = %+v, want %+v", got, want)
	}
}

func TestBuildSummaryDTO_Empty(t *testing.T) {
	got := buildSummaryDTO(nil, nil, nil, nil, nil, nil)
	// mapRecentResponses(nil) mengembalikan slice non-nil kosong (make([]T,0,0))
	// - dipertahankan sengaja supaya JSON envelope selalu "[]", bukan "null".
	want := GuestSummaryDTO{RecentResponses: []RecentResponseDTO{}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("buildSummaryDTO(nil) = %+v, want zero value %+v", got, want)
	}
}

func TestBuildSummaryDTO_AllFourStatuses(t *testing.T) {
	statusRows := []sqlc.CountGuestsGroupedByStatusRow{
		{RsvpStatus: sqlc.GuestsRsvpStatusAttending, Total: 10, TotalPax: 15},
		{RsvpStatus: sqlc.GuestsRsvpStatusNotAttending, Total: 2},
		{RsvpStatus: sqlc.GuestsRsvpStatusRemindLater, Total: 1},
		{RsvpStatus: sqlc.GuestsRsvpStatusPending, Total: 7},
	}

	got := buildSummaryDTO(statusRows, nil, nil, nil, nil, nil)

	want := GuestSummaryDTO{Total: 20, Attending: 10, NotAttending: 2, RemindLater: 1, Pending: 7, AttendingPax: 15, RecentResponses: []RecentResponseDTO{}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("buildSummaryDTO() = %+v, want %+v", got, want)
	}
}

// TestBuildSummaryDTO_BreakdownsDoNotInflateTotal menguji dashboard-wa-rsvp
// §buildSummaryDTO: invitationRows, souvenirRows, sideRows, genderRows
// menghitung BARIS YANG SAMA dari sudut pandang lain, jadi Total harus tetap
// sama dengan jumlah dari statusRows saja - bukan berlipat.
func TestBuildSummaryDTO_BreakdownsDoNotInflateTotal(t *testing.T) {
	statusRows := []sqlc.CountGuestsGroupedByStatusRow{
		{RsvpStatus: sqlc.GuestsRsvpStatusAttending, Total: 6, TotalPax: 9},
		{RsvpStatus: sqlc.GuestsRsvpStatusPending, Total: 4},
	}
	invitationRows := []sqlc.CountGuestsGroupedByInvitationTypeRow{
		{InvitationType: sqlc.GuestsInvitationTypeOnline, Total: 7},
		{InvitationType: sqlc.GuestsInvitationTypePhysical, Total: 3},
	}
	souvenirRows := []sqlc.CountGuestsGroupedBySouvenirTypeRow{
		{SouvenirType: sqlc.GuestsSouvenirTypeRegular, Total: 8},
		{SouvenirType: sqlc.GuestsSouvenirTypeVip, Total: 2},
	}
	sideRows := []sqlc.CountGuestsGroupedBySideRow{
		{Side: sqlc.GuestsSideGroom, Total: 6},
		{Side: sqlc.GuestsSideBride, Total: 4},
	}
	genderRows := []sqlc.CountGuestsGroupedByGenderRow{
		{Gender: sqlc.NullGuestsGender{GuestsGender: sqlc.GuestsGenderMale, Valid: true}, Total: 5},
		{Gender: sqlc.NullGuestsGender{GuestsGender: sqlc.GuestsGenderFemale, Valid: true}, Total: 5},
	}

	got := buildSummaryDTO(statusRows, invitationRows, souvenirRows, sideRows, genderRows, nil)

	want := GuestSummaryDTO{
		Total: 10, Attending: 6, Pending: 4, AttendingPax: 9,
		InvitationOnline: 7, InvitationPhysical: 3,
		SouvenirRegular: 8, SouvenirVip: 2,
		SideGroom: 6, SideBride: 4,
		GenderMale: 5, GenderFemale: 5,
		RecentResponses: []RecentResponseDTO{},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("buildSummaryDTO() = %+v, want %+v (Total harus 10, BUKAN berlipat)", got, want)
	}
}

// TestBuildSummaryDTO_MissingCategoryDefaultsZero menguji bahwa kategori
// yang belum punya tamu tetap 0, bukan hilang dari respons (konsisten
// dengan perilaku status - PLAN.md V3).
func TestBuildSummaryDTO_MissingCategoryDefaultsZero(t *testing.T) {
	invitationRows := []sqlc.CountGuestsGroupedByInvitationTypeRow{
		{InvitationType: sqlc.GuestsInvitationTypeOnline, Total: 5},
		// physical sengaja tidak ada baris sama sekali
	}

	got := buildSummaryDTO(nil, invitationRows, nil, nil, nil, nil)

	want := GuestSummaryDTO{InvitationOnline: 5, InvitationPhysical: 0, RecentResponses: []RecentResponseDTO{}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("buildSummaryDTO() = %+v, want %+v", got, want)
	}
}

// TestBuildSummaryDTO_GenderRowWithoutValidValueIgnored menguji bahwa baris
// gender yang NULL (tamu belum mengisi gender) tidak menyumbang ke
// GenderMale/GenderFemale manapun - query CountGuestsGroupedByGender
// sendiri sudah memfilter WHERE gender IS NOT NULL, tapi buildSummaryDTO
// tetap menjaga baris NULL yang lolos tidak menimbulkan panic/silent bug.
func TestBuildSummaryDTO_GenderRowWithoutValidValueIgnored(t *testing.T) {
	genderRows := []sqlc.CountGuestsGroupedByGenderRow{
		{Gender: sqlc.NullGuestsGender{Valid: false}, Total: 99},
	}

	got := buildSummaryDTO(nil, nil, nil, nil, genderRows, nil)

	want := GuestSummaryDTO{RecentResponses: []RecentResponseDTO{}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("buildSummaryDTO() = %+v, want %+v (baris gender invalid harus diabaikan)", got, want)
	}
}

// TestBuildSummaryDTO_RecentResponsesMapped menguji kartu "Aktivitas RSVP
// terbaru" (dashboard-wa-rsvp §3.2).
func TestBuildSummaryDTO_RecentResponsesMapped(t *testing.T) {
	recentRows := []sqlc.ListRecentRsvpResponsesRow{
		{Name: "Budi", RsvpStatus: sqlc.GuestsRsvpStatusAttending, AttendingCount: 2},
		{Name: "Sari", RsvpStatus: sqlc.GuestsRsvpStatusNotAttending, AttendingCount: 1},
	}

	got := buildSummaryDTO(nil, nil, nil, nil, nil, recentRows)

	if len(got.RecentResponses) != 2 {
		t.Fatalf("len(RecentResponses) = %d, want 2", len(got.RecentResponses))
	}
	if got.RecentResponses[0].Name != "Budi" || got.RecentResponses[0].AttendingCount != 2 {
		t.Fatalf("RecentResponses[0] = %+v, want Name=Budi AttendingCount=2", got.RecentResponses[0])
	}
}
