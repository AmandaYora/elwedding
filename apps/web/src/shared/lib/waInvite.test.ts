import { normalizePhoneForWa, applyInvitationTemplate, buildWaMeUrl } from './waInvite'

// Cerminan normalizePhone di apps/api/.../whatsapp/application/service.go
// (D14). Nilai harapan di sini disamakan dengan perilaku Go itu: untuk
// "08123456789" Go menghasilkan "62" + p[1:] = "628123456789" (angka 8 TETAP
// ada - yang dibuang hanya "0" di depan).
test('normalizePhoneForWa: nomor lokal 08xx jadi 62xx, tanda hubung & spasi dibuang', () => {
  expect(normalizePhoneForWa('0812-3456-789')).toBe('628123456789')
  expect(normalizePhoneForWa('0812 3456 789')).toBe('628123456789')
})

test('normalizePhoneForWa: awalan +62 jadi 62 tanpa tanda plus', () => {
  expect(normalizePhoneForWa('+62 812 345')).toBe('62812345')
})

test('normalizePhoneForWa: nomor yang sudah 62 dibiarkan (idempoten)', () => {
  expect(normalizePhoneForWa('62812345')).toBe('62812345')
  // Idempoten sungguhan: menjalankan dua kali tidak menambah 62 lagi.
  expect(normalizePhoneForWa(normalizePhoneForWa('0812345') as string)).toBe('62812345')
})

test('normalizePhoneForWa: kosong / hanya spasi / tanpa digit -> null', () => {
  expect(normalizePhoneForWa('')).toBeNull()
  expect(normalizePhoneForWa('   ')).toBeNull()
  expect(normalizePhoneForWa('-- --')).toBeNull()
})

// Perbedaan yang disengaja dari versi Go: nomor di sini datang dari data admin
// yang diketik manual, jadi karakter non-digit lain ikut dibuang.
test('normalizePhoneForWa: kurung dan titik dari input manual ikut dibuang', () => {
  expect(normalizePhoneForWa('(0812) 3456.789')).toBe('628123456789')
})

const VALUES = {
  nama: 'Budi',
  mempelai: 'Ariana & Adrian',
  tanggal: 'Sabtu, 16 Mei 2026',
  link: 'https://elwedding.elcodelabs.com/?guest=abc123',
}

test('applyInvitationTemplate mengganti keempat placeholder', () => {
  const out = applyInvitationTemplate(
    'Halo {nama}, undangan {mempelai} pada {tanggal}: {link}',
    VALUES,
  )
  expect(out).toBe(
    'Halo Budi, undangan Ariana & Adrian pada Sabtu, 16 Mei 2026: https://elwedding.elcodelabs.com/?guest=abc123',
  )
})

test('applyInvitationTemplate mengganti placeholder yang muncul dua kali', () => {
  expect(applyInvitationTemplate('{nama}, sekali lagi {nama}!', VALUES)).toBe('Budi, sekali lagi Budi!')
})

// Mengunci K5: {jumlah} memang TIDAK didukung di template undangan, karena
// saat undangan dikirim tamu belum RSVP. Dibiarkan UTUH (bukan dihapus)
// supaya salah tulis terlihat admin di pratinjau WhatsApp, bukan hilang senyap.
test('applyInvitationTemplate membiarkan {jumlah} dan placeholder tak dikenal apa adanya', () => {
  expect(applyInvitationTemplate('Halo {nama}, {jumlah} orang, {salahketik}', VALUES)).toBe(
    'Halo Budi, {jumlah} orang, {salahketik}',
  )
})

test('buildWaMeUrl berawalan https://wa.me/<nomor>?text=', () => {
  expect(buildWaMeUrl('628123456789', 'halo')).toBe('https://wa.me/628123456789?text=halo')
})

// encodeURIComponent WAJIB. Diassert lewat decode - mencocokkan string
// ter-encode secara harfiah rapuh terhadap perbedaan encoding yang sah.
test('buildWaMeUrl meng-encode spasi, baris baru, ? dan & sehingga pesan utuh saat didecode', () => {
  const pesan = 'Halo Budi & keluarga,\nundangan: https://elwedding.elcodelabs.com/?guest=abc123&x=1'
  const url = buildWaMeUrl('628123456789', pesan)

  const textPart = url.slice(url.indexOf('?text=') + '?text='.length)
  expect(decodeURIComponent(textPart)).toBe(pesan)

  // Karakter yang bermakna bagi URL TIDAK boleh lolos mentah ke bagian text -
  // tanpa encoding pesan terpotong di '?' atau '&' pertama, yang justru
  // datang dari URL undangan itu sendiri.
  expect(textPart).not.toContain(' ')
  expect(textPart).not.toContain('\n')
  expect(textPart).not.toContain('&')
  expect(textPart).not.toContain('?')
})

// Menyamai strings.NewReplacer di jalur QR Go: substitusi SATU lintasan, jadi
// nilai hasil ganti tidak ikut diganti lagi.
test('applyInvitationTemplate tidak mensubstitusi ulang nilai hasil ganti', () => {
  const out = applyInvitationTemplate('{nama}', { ...VALUES, nama: 'Budi {link}' })
  expect(out).toBe('Budi {link}')
})
