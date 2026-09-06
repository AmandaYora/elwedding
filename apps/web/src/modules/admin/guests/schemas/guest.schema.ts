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
  // Group WAJIB (docs/plan/guest-groups/PLAN.md T15/K2): 0 = belum dipilih dan
  // ditolak di sini. Penegakan sebenarnya tetap di backend (validateGroupID,
  // D4) - yang di sini hanya memberi pesan lebih cepat, pola yang sama dengan
  // enum wajib di atasnya.
  groupId: z.number().int().positive('Group wajib dipilih'),
  // Jatah kursi (docs/plan/guest-pax-quota/PLAN.md T19). Batas 1/20 adalah
  // KEMBAR LINTAS BAHASA dengan paxQuotaMin/paxQuotaMax di
  // guest/application/service_groups.go - browser tidak bisa memanggil
  // konstanta Go. Yang di sini hanya memberi pesan lebih cepat; penegakan
  // sebenarnya (termasuk penjaga "tidak boleh turun di bawah jumlah yang sudah
  // dikonfirmasi tamu") tetap di backend.
  paxQuota: z
    .number({ message: 'Jatah kursi wajib diisi' })
    .int('Jatah kursi harus bilangan bulat')
    .min(1, 'Jatah kursi minimal 1')
    .max(20, 'Jatah kursi maksimal 20'),
  souvenirType: z.enum(['regular', 'vip'], { message: 'Jenis souvenir wajib dipilih' }),
  email: z.union([z.literal(''), z.string().email('Format email tidak valid')]),
  phone: z.string(),
  address: z.string(),
  notes: z.string(),
  isExpectedAttending: z.boolean(),
})

export type GuestFormValues = z.infer<typeof guestSchema>
