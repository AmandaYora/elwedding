import { z } from 'zod'

/**
 * Group tamu (docs/plan/guest-groups/PLAN.md T11). Isinya nama + deskripsi +
 * defaultPax. Warna & nomor meja tetap ditolak (K3 guest-groups); kuota TIDAK
 * lagi ditolak sejak docs/plan/guest-pax-quota/PLAN.md D2.
 *
 * `defaultPax` bukan batas keras yang mengunci seluruh anggota group - ia
 * hanya angka AWAL yang mengisi form saat admin menambah tamu baru di group
 * ini. Yang mengikat adalah `paxQuota` per tamu (guest.schema.ts). Itu sebabnya
 * label di GroupsPage berbunyi "Jumlah tamu", bukan "Maks. tamu".
 *
 * Batas 100/255 adalah KEMBAR LINTAS BAHASA dari VARCHAR(100)/VARCHAR(255) di
 * migration 000016 dan groupNameMaxLen/groupDescriptionMaxLen di
 * guest/application/service_groups.go; batas 1/20 kembar dengan
 * paxQuotaMin/paxQuotaMax di berkas Go yang sama. Yang di sini hanya memberi
 * pesan lebih cepat - penegakan sebenarnya tetap di backend.
 */
export const groupSchema = z.object({
  name: z.string().trim().min(1, 'Nama group wajib diisi').max(100, 'Nama group maksimal 100 karakter'),
  description: z.string().trim().max(255, 'Deskripsi maksimal 255 karakter'),
  defaultPax: z
    .number({ message: 'Jumlah tamu wajib diisi' })
    .int('Jumlah tamu harus bilangan bulat')
    .min(1, 'Jumlah tamu minimal 1')
    .max(20, 'Jumlah tamu maksimal 20'),
})

export type GroupFormValues = z.infer<typeof groupSchema>
