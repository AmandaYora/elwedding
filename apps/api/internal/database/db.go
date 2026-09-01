// Package database membuka koneksi *sql.DB tunggal yang dipakai seluruh
// modul (tiap modul tetap hanya boleh query tabel miliknya sendiri - lihat
// backend-modular-monolith.md; ini hanya berbagi connection pool, bukan
// berbagi akses tabel lintas modul).
package database

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

func Open(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn+"?parseTime=true&loc=Asia%2FJakarta")
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(time.Hour)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}
	return db, nil
}
