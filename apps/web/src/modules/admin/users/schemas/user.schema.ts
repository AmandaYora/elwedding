import { z } from 'zod'

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
})
export type CreateUserFormValues = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.union([z.literal(''), z.string().min(6, 'Password minimal 6 karakter')]),
})
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>
