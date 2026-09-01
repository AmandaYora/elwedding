import { httpClient } from '@/shared/services/http-client'

interface LoginResponse {
  success: boolean
  data: { token: string }
}

export async function login(username: string, password: string): Promise<string> {
  const res = await httpClient.post<LoginResponse>('/api/v1/auth/login', { username, password })
  return res.data.data.token
}
