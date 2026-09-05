import { z } from 'zod'

/**
 * Group tamu (docs/plan/guest-groups/PLAN.md T11). Isinya sengaja hanya nama
 * + deskripsi (K3): tanpa warna, nomor meja, maupun kuota.
 *
 * Batas 100/255 adalah KEMBAR LINTAS BAHASA dari VARCHAR(100)/VARCHAR(255) di
 * migration 000016 dan groupNameMaxLen/groupDescriptionMaxLen di
 * guest/application/service_groups.go. Yang di sini hanya memberi pesan lebih
 * cepat - penegakan sebenarnya tetap di backend.
 */
export const groupSchema = z.object({
  name: z.string().trim().min(1, 'Nama group wajib diisi').max(100, 'Nama group maksimal 100 karakter'),
  description: z.string().trim().max(255, 'Deskripsi maksimal 255 karakter'),
})

export type GroupFormValues = z.infer<typeof groupSchema>
