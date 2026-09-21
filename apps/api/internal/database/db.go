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

// dsnParams adalah parameter koneksi yang ditempelkan ke DSN dari env.
//
// time_zone='+07:00' (docs/plan/timezone-wib/PLAN.md T1/D7) adalah INTI
// perbaikan bug "waktu mundur 7 jam". Tanpa ini, NOW() dan
// DEFAULT CURRENT_TIMESTAMP dievaluasi memakai time_zone SERVER MySQL (di
// elcodelabs = SYSTEM = UTC), sementara loc=Asia/Jakarta di bawah membaca
// hasilnya seolah-olah sudah jam Jakarta - jam UTC dilabeli +07:00, dan
// seluruh waktu di admin tampil mundur 7 jam.
//
// Disetel di DSN, BUKAN di konfigurasi MySQL host (D7): VPS elcodelabs
// dipakai bersama elproof-app dan elkasir-app, jadi mengubah zona server
// akan menggeser makna waktu dua aplikasi yang tidak ada hubungannya.
// Parameter DSN yang tidak dikenal driver dikirim sebagai `SET <param> =
// <val>` di SETIAP koneksi baru (go-sql-driver/mysql connection.go
// handleParams), sehingga seluruh pool konsisten - termasuk koneksi yang
// dibuat ulang setelah SetConnMaxLifetime di bawah.
//
// DITULIS %2B, BUKAN '+'. url.QueryUnescape menerjemahkan '+' menjadi
// SPASI, sehingga DSN dengan '+' literal menghasilkan
// `SET time_zone = ' 07:00'` yang ditolak MySQL saat handshake - dan karena
// itu terjadi di handshake, SETIAP koneksi gagal dan seluruh aplikasi mati.
// Dijaga oleh db_test.go, bukan oleh kewaspadaan.
//
// OFFSET TETAP, bukan nama zona 'Asia/Jakarta' (D8): nama zona hanya dikenali
// MySQL bila tabel mysql.time_zone* sudah di-populate (mysql_tzinfo_to_sql),
// yang pada instalasi default KOSONG - hasilnya "Unknown or incorrect time
// zone" dengan akibat yang sama persis: semua koneksi mati. WIB tidak
// mengenal DST dan tetap UTC+7 sejak 1987, jadi tidak ada informasi yang
// hilang.
const dsnParams = "?parseTime=true&loc=Asia%2FJakarta&time_zone=%27%2B07%3A00%27"

// buildDSN dipisah dari Open supaya bisa diuji tanpa database (db_test.go),
// mengikuti konvensi tes fungsi murni di repo ini.
func buildDSN(base string) string {
	return base + dsnParams
}

func Open(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", buildDSN(dsn))
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
