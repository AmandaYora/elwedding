import { z } from 'zod'

/**
 * 9 field tamu (guest-fields-admin-layout). Wajib: name, gender,
 * invitationType, side, souvenirType (jawaban user Step 0 #2). Opsional:
 * email (divalidasi formatnya HANYA bila diisi), phone, address, notes.
 * isExpectedAttending (dashboard-wa-rsvp keputusan #1/#2) - toggle dugaan
 * admin, terpisah dari rsvp_status milik tamu.
 */
export const guestSchema = z.object({
  name: z.string().min(1, 'Nama wajib diisi'),
  gender: z.enum(['male', 'female'], { message: 'Gender wajib dipilih' }),
  invitationType: z.enum(['online', 'physical'], { message: 'Jenis undangan wajib dipilih' }),
  side: z.enum(['groom', 'bride'], { message: 'Pihak wajib dipilih' }),
  souvenirType: z.enum(['regular', 'vip'], { message: 'Jenis souvenir wajib dipilih' }),
  email: z.union([z.literal(''), z.string().email('Format email tidak valid')]),
  phone: z.string(),
  address: z.string(),
  notes: z.string(),
  isExpectedAttending: z.boolean(),
})

export type GuestFormValues = z.infer<typeof guestSchema>
