// Package jwtutil adalah utilitas teknis murni (encode/decode token) yang
// dipakai modul `auth` (menerbitkan token saat login) maupun middleware
// router (memvalidasi token di route admin) - bukan domain logic, jadi
// tempatnya di shared/ (backend-modular-monolith.md).
package jwtutil

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Role membawa peran akun di dalam token (docs/plan/scan-checkin-gate/
// PLAN.md T4/D8): "admin" (akses penuh) atau "scanner" (HANYA menu Scan).
//
// Peran KOSONG diperlakukan sebagai admin penuh oleh authmw.RequireFullAdmin,
// bukan sebagai petugas - token yang sudah tersimpan di localStorage admin
// sebelum fitur ini ada tidak punya klaim `role`, dan membalik artinya akan
// membuat admin yang sedang login kehilangan seluruh menu tanpa sebab yang
// terlihat.
type Claims struct {
	AdminUserID uint64 `json:"admin_user_id"`
	Username    string `json:"username"`
	Role        string `json:"role"`
	jwt.RegisteredClaims
}

func Generate(secret string, expiresIn time.Duration, adminUserID uint64, username, role string) (string, error) {
	claims := Claims{
		AdminUserID: adminUserID,
		Username:    username,
		Role:        role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(expiresIn)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func Parse(secret, tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}
