// Package authmw membungkus handler admin agar wajib membawa
// "Authorization: Bearer <jwt>" yang valid (PLAN.md §1 keputusan #11).
package authmw

import (
	"context"
	"net/http"
	"strings"

	"undangan-digital/internal/shared/jwtutil"
	"undangan-digital/internal/shared/response"
)

type contextKey string

const claimsContextKey contextKey = "authClaims"

func RequireAdmin(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			token, ok := strings.CutPrefix(header, "Bearer ")
			if !ok || token == "" {
				response.Unauthorized(w, "Missing bearer token")
				return
			}
			claims, err := jwtutil.Parse(secret, token)
			if err != nil {
				response.Unauthorized(w, "Invalid or expired token")
				return
			}
			ctx := context.WithValue(r.Context(), claimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RoleScanner adalah satu-satunya peran yang DIBATASI. Sengaja dibandingkan
// dengan cara ini (bukan `!= RoleAdmin`): lihat komentar RequireFullAdmin.
const RoleScanner = "scanner"

// RequireFullAdmin membungkus RequireAdmin lalu MENOLAK akun petugas
// (docs/plan/scan-checkin-gate/PLAN.md T5/D7). RequireAdmin sendiri sengaja
// TIDAK diubah - membalik artinya akan menyentuh seluruh route admin
// sekaligus, sedangkan middleware terpisah membuat perubahan aksesnya
// terbaca satu baris di router.go dan mudah dibatalkan.
//
// Peran KOSONG DITERUSKAN sebagai admin penuh (D8) - JANGAN dibalik menjadi
// "selain admin ditolak". Token yang sudah tersimpan di localStorage admin
// sebelum fitur ini ada tidak punya klaim `role` sama sekali; menolaknya
// akan membuat admin yang sedang login kehilangan seluruh menu tanpa sebab
// yang terlihat. Kolomnya sendiri NOT NULL DEFAULT 'admin' (migration
// 000015), jadi setiap token yang diterbitkan setelah ini selalu berperan
// eksplisit.
//
// INILAH penegakan yang sebenarnya. Penyaringan menu di AdminLayout.tsx
// murni kosmetik dan tidak boleh pernah menjadi satu-satunya pembatas.
func RequireFullAdmin(secret string) func(http.Handler) http.Handler {
	requireAdmin := RequireAdmin(secret)
	return func(next http.Handler) http.Handler {
		gate := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := ClaimsFromContext(r.Context())
			if !ok {
				response.Internal(w, "")
				return
			}
			if claims.Role == RoleScanner {
				// response.Forbidden TIDAK ada (hanya BadRequest/Unauthorized/
				// NotFound/Internal) - pakai Error generik, jangan menambah
				// helper baru untuk satu pemanggil.
				response.Error(w, http.StatusForbidden, "Akses ditolak untuk akun petugas", nil)
				return
			}
			next.ServeHTTP(w, r)
		})
		// RequireAdmin dijalankan LEBIH DULU: dia yang memvalidasi token dan
		// menaruh claims ke context, jadi gate di atas selalu menemukannya.
		return requireAdmin(gate)
	}
}

func ClaimsFromContext(ctx context.Context) (*jwtutil.Claims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(*jwtutil.Claims)
	return claims, ok
}
