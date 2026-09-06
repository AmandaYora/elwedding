import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AdminRole } from '@/modules/admin/auth/services/auth.service'

interface AuthState {
  token: string | null
  role: AdminRole | null
  /** Username akun yang sedang login, dipakai AdminLayout untuk menampilkan
   * SIAPA yang login. Diisi dari form login (bukan dari respons backend, yang
   * memang tidak mengirimnya) - nilainya sama persis karena login baru
   * berhasil dengan username itu. `null` untuk sesi LAMA yang sudah tersimpan
   * sebelum field ini ada; AdminLayout menyediakan teks cadangan. */
  username: string | null
  setSession: (token: string, role: AdminRole, username: string) => void
  logout: () => void
}

/** Sesi admin (PLAN.md keputusan #11) - JWT disimpan di localStorage lewat
 * Zustand persist, dibaca http-client.ts untuk header Authorization.
 *
 * `role` (docs/plan/scan-checkin-gate T12) menyertainya untuk memilih halaman
 * awal & menyaring menu. Sesi LAMA yang sudah tersimpan tidak punya field ini
 * dan ter-rehydrate sebagai null - diperlakukan sebagai admin penuh (D8),
 * sama seperti klaim `role` kosong di sisi backend. Penyaringan menu ini
 * kosmetik; penegakan sebenarnya ada di authmw.RequireFullAdmin. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      username: null,
      setSession: (token, role, username) => set({ token, role, username }),
      logout: () => set({ token: null, role: null, username: null }),
    }),
    { name: 'admin-auth' },
  ),
)

/** isScannerRole memusatkan aturan "peran kosong/null = admin penuh" supaya
 * tidak ditulis ulang berbeda-beda di tiap komponen. */
export function isScannerRole(role: AdminRole | null): boolean {
  return role === 'scanner'
}
