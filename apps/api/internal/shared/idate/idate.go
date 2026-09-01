// Package idate memformat time.Time menjadi label tanggal (mis.
// "Saturday, 16 May 2026"), dipakai untuk weddingDateLabel (PLAN.md §5.2) -
// label ini hanya untuk tampilan/teks QR, BUKAN untuk dihitung ulang di
// frontend (lihat keputusan #16, weddingDateUnix adalah satu-satunya sumber
// untuk countdown). Bahasa Inggris dipakai supaya konsisten dengan
// mayoritas teks template ("The Day Is!", "Save the Date", dst - lihat
// Agenda.tsx/SaveTheDate.tsx) - bukan Bahasa Indonesia yang sebelumnya
// hanya dipakai satu tempat (RsvpConfirmation.tsx lama).
package idate

import "time"

var days = [...]string{"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"}

var months = [...]string{
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
}

func FormatLong(t time.Time) string {
	day := days[int(t.Weekday())]
	month := months[int(t.Month())-1]
	return day + ", " + itoa(t.Day()) + " " + month + " " + itoa(t.Year())
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	neg := n < 0
	if neg {
		n = -n
	}
	var buf [8]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	if neg {
		i--
		buf[i] = '-'
	}
	return string(buf[i:])
}
