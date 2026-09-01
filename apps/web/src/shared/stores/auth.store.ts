import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  setToken: (token: string) => void
  logout: () => void
}

/** Sesi admin (PLAN.md keputusan #11) - JWT disimpan di localStorage lewat
 * Zustand persist, dibaca http-client.ts untuk header Authorization. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      logout: () => set({ token: null }),
    }),
    { name: 'admin-auth' },
  ),
)
