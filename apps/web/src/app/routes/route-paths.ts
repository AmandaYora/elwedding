export const ROUTE_PATHS = {
  login: '/login',
  dashboard: '/',
  sections: '/sections',
  content: '/content',
  guests: '/guests',
  // Group tamu (docs/plan/guest-groups/PLAN.md T14). SENGAJA TIDAK masuk
  // SCANNER_ALLOWED_PATHS di bawah: petugas gate MELIHAT group di hasil scan
  // tapi tidak mengelolanya (D10), sama seperti menu Tamu & Pengguna.
  groups: '/groups',
  reservations: '/reservations',
  whatsapp: '/whatsapp',
  users: '/users',
  settings: '/settings',
  // Dua rute yang boleh dibuka akun petugas gate
  // (docs/plan/scan-checkin-gate/PLAN.md T13 + menu Tamu Masuk).
  scan: '/scan',
  arrivals: '/arrivals',
} as const

/** Rute yang boleh diakses akun petugas gate. Dipakai bersama oleh
 * ProtectedRoute (pengalihan) dan AdminLayout (penyaringan menu) supaya
 * keduanya tidak bisa berbeda pendapat - dulu aturannya ditulis dua kali dan
 * itu cara paling gampang menambah menu yang muncul di sidebar tapi langsung
 * memantul balik saat diklik.
 *
 * KOSMETIK. Penegakan aksesnya ada di authmw.RequireFullAdmin di backend. */
export const SCANNER_ALLOWED_PATHS: readonly string[] = [ROUTE_PATHS.scan, ROUTE_PATHS.arrivals]
