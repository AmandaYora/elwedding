import { httpClient } from '@/shared/services/http-client'

/** Peran akun (docs/plan/scan-checkin-gate/PLAN.md T12/K2): 'admin' punya
 * akses penuh, 'scanner' HANYA menu Scan. Kembar dengan enum kolom
 * admin_users.role di backend. */
export type AdminRole = 'admin' | 'scanner'

interface LoginResponse {
  success: boolean
  data: { token: string; role?: AdminRole }
}

export interface LoginResult {
  token: string
  role: AdminRole
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const res = await httpClient.post<LoginResponse>('/api/v1/auth/login', { username, password })
  // Peran kosong = admin penuh, sama seperti authmw.RequireFullAdmin di
  // backend (D8) - jangan dibalik jadi 'scanner'.
  return { token: res.data.data.token, role: res.data.data.role || 'admin' }
}
