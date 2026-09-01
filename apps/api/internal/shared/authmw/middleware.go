// Package authmw membungkus handler admin agar wajib membawa
// "Authorization: Bearer <jwt>" yang valid (PLAN.md §1 keputusan #11).
package authmw

import (
	"context"
	"net/http"
	"strings"

	"undangan-ariana-adrian/internal/shared/jwtutil"
	"undangan-ariana-adrian/internal/shared/response"
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

func ClaimsFromContext(ctx context.Context) (*jwtutil.Claims, bool) {
	claims, ok := ctx.Value(claimsContextKey).(*jwtutil.Claims)
	return claims, ok
}
