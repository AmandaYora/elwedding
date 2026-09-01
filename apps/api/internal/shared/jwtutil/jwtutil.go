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

type Claims struct {
	AdminUserID uint64 `json:"admin_user_id"`
	Username    string `json:"username"`
	jwt.RegisteredClaims
}

func Generate(secret string, expiresIn time.Duration, adminUserID uint64, username string) (string, error) {
	claims := Claims{
		AdminUserID: adminUserID,
		Username:    username,
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
