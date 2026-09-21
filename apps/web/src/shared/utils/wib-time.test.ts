import { formatWibDateTime, formatWibTime } from './wib-time'

/**
 * Tes formatter WIB (docs/plan/timezone-wib/PLAN.md T8/§7.2).
 *
 * Nilai tes ini justru terletak pada apa yang TIDAK dibutuhkannya: ia lulus
 * tanpa bergantung pada zona mesin yang menjalankannya. Sebelum perbaikan,
 * kasus pertama menghasilkan jam 04 di mesin UTC dan jam 11 di mesin WIB -
 * persis cacat yang sedang ditutup.
 *
 * Locale id-ID menulis jam dengan pemisah titik ("11.00"). Yang WAJIB benar
 * adalah angka jamnya; kalau data ICU runner menghasilkan pemisah lain,
 * sesuaikan literalnya - jangan melonggarkan asersi jamnya.
 */

// 04:00 UTC = 11:00 WIB. Selisih 7 jam itu yang sedang diuji.
const UTC_0400 = '2026-05-16T04:00:00Z'
// Instant yang sama, ditulis dengan offset WIB. Harus menghasilkan jam yang
// sama persis - kalau berbeda, berarti ada konversi ganda.
const WIB_1100 = '2026-05-16T11:00:00+07:00'
// 23:30 UTC = 06:30 WIB tanggal BERIKUTNYA (17 Mei).
const UTC_2330 = '2026-05-16T23:30:00Z'

test('formatWibTime mengonversi UTC ke WIB, bukan mengambil jamnya apa adanya', () => {
  expect(formatWibTime(UTC_0400)).toBe('11.00')
})

test('formatWibTime tidak menggeser dua kali saat masukan sudah ber-offset WIB', () => {
  expect(formatWibTime(WIB_1100)).toBe('11.00')
  expect(formatWibTime(WIB_1100)).toBe(formatWibTime(UTC_0400))
})

// Pergantian hari adalah kasus yang paling mudah lolos dari mata: jam bisa
// terlihat benar sementara tanggalnya meleset satu hari.
test('formatWibTime menangani pergantian hari', () => {
  expect(formatWibTime(UTC_2330)).toBe('06.30')
})

test('formatWibTime mengembalikan fallback untuk masukan kosong & tak valid', () => {
  expect(formatWibTime('')).toBe('')
  expect(formatWibTime('bukan tanggal')).toBe('')
  expect(formatWibTime('', '-')).toBe('-')
  expect(formatWibTime('bukan tanggal', '-')).toBe('-')
})

test('formatWibDateTime memakai tanggal & jam WIB', () => {
  const out = formatWibDateTime(UTC_0400)
  expect(out).toContain('16')
  expect(out).toContain('11')
})

// Penjaga pergantian hari untuk tanggal lengkap: 23:30 UTC 16 Mei sudah
// tanggal 17 di WIB. Tanpa timeZone yang dipatok, mesin UTC akan menulis 16.
test('formatWibDateTime ikut berpindah hari', () => {
  const out = formatWibDateTime(UTC_2330)
  expect(out).toContain('17')
})

test('formatWibDateTime mengembalikan fallback untuk masukan kosong & tak valid', () => {
  expect(formatWibDateTime('')).toBe('')
  expect(formatWibDateTime('bukan tanggal')).toBe('')
  expect(formatWibDateTime('', '-')).toBe('-')
})
