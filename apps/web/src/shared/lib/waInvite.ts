/**
 * Perakitan pesan & link `wa.me` untuk tombol "Kirim Undangan" di daftar tamu -
 * docs/plan/og-share-image-dinamis/PLAN.md Bagian B (D10/D13/D14).
 *
 * Ketiga fungsi di sini MURNI: tidak menyentuh DOM, jaringan, maupun state.
 * Itu disengaja - `wa.me` adalah redirect klien, jadi TIDAK ada alur backend
 * sama sekali dalam pengiriman undangan, dan bagian yang paling mudah salah
 * (normalisasi nomor & encoding pesan) harus bisa dites tanpa apa pun.
 *
 * Jalur ini TIDAK berhubungan dengan modul WhatsApp (whatsmeow) yang mengirim
 * QR otomatis: tidak ada `Sender`, tidak ada `whatsapp_send_logs`, dan
 * `is_enabled` pada konfigurasi WhatsApp TIDAK mengatur tombol ini.
 */

/**
 * Menyeragamkan nomor tamu ke bentuk `62xxxxxxxxxx` yang diminta `wa.me`
 * (internasional, TANPA tanda `+`). `null` bila nomornya kosong atau tidak
 * menyisakan digit apa pun.
 *
 * CERMINAN `normalizePhone` di
 * `apps/api/internal/modules/whatsapp/application/service.go`. Aturan nomor
 * kini hidup di DUA bahasa karena browser tidak bisa memanggil fungsi Go itu -
 * duplikasi ini tidak bisa dihindari, jadi ditandai eksplisit di kedua sisi:
 * kalau aturannya berubah, UBAH KEDUANYA (docs/plan/og-share-image-dinamis/
 * PLAN.md D14).
 *
 * Satu perbedaan yang disengaja: versi ini membuang SEMUA karakter non-digit
 * (kurung, titik, dan sebagainya), bukan hanya spasi & tanda hubung seperti
 * versi Go. Nomor di sini datang langsung dari data admin yang diketik
 * manual, sedangkan jalur Go menerimanya sesudah tervalidasi form.
 */
export function normalizePhoneForWa(phone: string): string | null {
  const trimmed = phone.trim()
  if (trimmed === '') return null

  // Tanda `+` awal ditangkap SEBELUM karakter non-digit dibuang - setelahnya
  // "+62..." dan "62..." tidak lagi bisa dibedakan.
  const hadPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (digits === '') return null

  if (hadPlus) {
    // "+62812..." -> "62812...". Nomor internasional lain dibiarkan apa
    // adanya; memaksanya ke 62 justru akan merusak nomor luar negeri.
    return digits
  }
  if (digits.startsWith('0')) {
    return '62' + digits.slice(1)
  }
  return digits
}

/** Nilai placeholder Template Pesan Undangan. TANPA `jumlah` (K5): saat
 * undangan dikirim tamu belum RSVP, jadi angka hadir selalu menyesatkan. */
export interface InvitationTemplateValues {
  nama: string
  mempelai: string
  tanggal: string
  link: string
}

/**
 * Mengganti `{nama}`, `{mempelai}`, `{tanggal}`, `{link}` pada template.
 * Setiap placeholder diganti pada SEMUA kemunculannya.
 *
 * Placeholder yang tidak dikenal (mis. `{jumlah}` atau salah ketik
 * `{namaa}`) sengaja DIBIARKAN UTUH, bukan dihapus - dengan begitu admin
 * melihat kesalahannya di pratinjau WhatsApp sebelum menekan kirim, alih-alih
 * kehilangan sepotong kalimat tanpa tahu kenapa.
 */
export function applyInvitationTemplate(tpl: string, v: InvitationTemplateValues): string {
  // SATU kali lintasan (regex global), bukan rantai replace per placeholder.
  // Ini menyamai perilaku strings.NewReplacer di jalur QR Go: nilai hasil
  // substitusi TIDAK ikut disubstitusi lagi, jadi nama tamu yang kebetulan
  // memuat "{link}" tidak berubah jadi URL undangan.
  return tpl.replace(/\{(nama|mempelai|tanggal|link)\}/g, (_match, key: keyof InvitationTemplateValues) => v[key])
}

/**
 * Menyusun URL `wa.me` yang membuka WhatsApp dengan pesan sudah terisi.
 *
 * `encodeURIComponent` WAJIB: pesannya memuat spasi, baris baru, dan - yang
 * paling menentukan - tanda `?` serta `&` yang datang dari URL undangan itu
 * sendiri (`/?guest=<token>`). Tanpa encoding, pesan terpotong tepat di
 * karakter pertama yang bermakna bagi URL, sehingga tamu menerima pesan
 * separuh tanpa link.
 */
export function buildWaMeUrl(normalizedPhone: string, text: string): string {
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`
}
