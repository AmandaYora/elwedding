import { z } from 'zod'

/** Peran akun (docs/plan/scan-checkin-gate/PLAN.md T17/K2) - kembar dengan
 * enum kolom admin_users.role dan validRoles di auth/application/service.go.
 * 'admin' punya akses penuh; 'scanner' HANYA menu Scan. */
export const roleSchema = z.enum(['admin', 'scanner'])
export type UserRole = z.infer<typeof roleSchema>

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  scanner: 'Petugas gate',
}

export const ROLE_DESCRIPTION: Record<UserRole, string> = {
  admin: 'Akses penuh ke seluruh menu dashboard.',
  scanner: 'Hanya bisa membuka menu Scan untuk mencatat kehadiran di pintu.',
}

export const ROLE_OPTIONS: UserRole[] = ['admin', 'scanner']

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: roleSchema,
})
export type CreateUserFormValues = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.union([z.literal(''), z.string().min(6, 'Password minimal 6 karakter')]),
  role: roleSchema,
})
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>
