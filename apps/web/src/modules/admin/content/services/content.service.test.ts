import { httpClient } from '@/shared/services/http-client'
import { prepareImageForUpload } from '@/shared/lib/image-compress'
import { uploadImageBase64, uploadAudioFile, AudioUploadError, MAX_AUDIO_BYTES } from './content.service'

vi.mock('@/shared/services/http-client', () => ({
  httpClient: { post: vi.fn() },
}))

vi.mock('@/shared/lib/image-compress', () => ({
  prepareImageForUpload: vi.fn(),
}))

const mockedPost = vi.mocked(httpClient.post)
const mockedCompress = vi.mocked(prepareImageForUpload)

afterEach(() => {
  mockedPost.mockReset()
  mockedCompress.mockReset()
})

test('uploadImageBase64 mem-POST ke /api/v1/admin/uploads/base64 dengan filename & data hasil kompresi', async () => {
  mockedCompress.mockResolvedValueOnce({ base64: 'QUFB', filename: 'foto.webp' })
  mockedPost.mockResolvedValueOnce({ data: { data: { url: '/uploads/images/foto.webp' } } })

  const file = new File(['dummy'], 'foto.png', { type: 'image/png' })
  const url = await uploadImageBase64(file, 1920)

  expect(url).toBe('/uploads/images/foto.webp')
  expect(mockedCompress).toHaveBeenCalledWith(file, 1920, 'lossy')
  expect(mockedPost).toHaveBeenCalledWith(
    '/api/v1/admin/uploads/base64',
    { filename: 'foto.webp', data: 'QUFB' },
    expect.objectContaining({ timeout: 120000 }),
  )
})

test('data yang dikirim tidak berawalan "data:" (prefix sudah dibuang oleh compressImageToBase64)', async () => {
  mockedCompress.mockResolvedValueOnce({ base64: 'QUFB', filename: 'foto.webp' })
  mockedPost.mockResolvedValueOnce({ data: { data: { url: '/uploads/images/foto.webp' } } })

  await uploadImageBase64(new File(['dummy'], 'foto.png'))

  const payload = mockedPost.mock.calls[0][1] as { data: string }
  expect(payload.data.startsWith('data:')).toBe(false)
})

test('maxDim default 1920 dipakai bila tidak diberikan', async () => {
  mockedCompress.mockResolvedValueOnce({ base64: 'QUFB', filename: 'foto.webp' })
  mockedPost.mockResolvedValueOnce({ data: { data: { url: '/uploads/images/foto.webp' } } })

  await uploadImageBase64(new File(['dummy'], 'foto.png'))

  expect(mockedCompress).toHaveBeenCalledWith(expect.any(File), 1920, 'lossy')
})

// --- uploadAudioFile: musik latar (multipart) ---

// Berkas musik dikirim APA ADANYA tanpa kompresi, jadi 6 MB pun lewat kabel
// penuh. Dengan timeout default 30 detik, unggahan pada koneksi rumahan yang
// lambat dibatalkan axios di tengah jalan - di layar admin itu tidak bisa
// dibedakan dari "berkas ditolak". Test ini mengunci timeout panjangnya.
test('uploadAudioFile mem-POST multipart dengan timeout panjang, bukan default 30 detik', async () => {
  mockedPost.mockResolvedValueOnce({ data: { data: { url: '/uploads/audio/lagu.mp3' } } })

  const file = new File(['x'], 'lagu.mp3', { type: 'audio/mpeg' })
  const url = await uploadAudioFile(file)

  expect(url).toBe('/uploads/audio/lagu.mp3')
  const [path, body, config] = mockedPost.mock.calls[0]
  expect(path).toBe('/api/v1/admin/uploads')
  expect(body).toBeInstanceOf(FormData)
  expect((body as FormData).get('file')).toBe(file)
  expect(config).toEqual(expect.objectContaining({ timeout: 300000 }))
})

test('uploadAudioFile menerima .wav dan .ogg, dan tidak peduli huruf besar-kecil ekstensi', async () => {
  for (const name of ['lagu.wav', 'lagu.ogg', 'LAGU.MP3']) {
    mockedPost.mockResolvedValueOnce({ data: { data: { url: '/uploads/audio/x' } } })
    await expect(uploadAudioFile(new File(['x'], name))).resolves.toBe('/uploads/audio/x')
  }
})

// Ditolak SEBELUM menyentuh jaringan - kalau tidak, admin menunggu unggahan
// panjang hanya untuk menerima 415 dari server.
test('uploadAudioFile menolak format yang backend memang tidak terima, tanpa mengirim request', async () => {
  for (const name of ['lagu.m4a', 'lagu.aac', 'lagu.flac', 'lagu']) {
    await expect(uploadAudioFile(new File(['x'], name))).rejects.toBeInstanceOf(AudioUploadError)
  }
  expect(mockedPost).not.toHaveBeenCalled()
})

test('uploadAudioFile menolak berkas di atas 10 MB dengan pesan yang menyebut ukurannya', async () => {
  const tooBig = new File([new Uint8Array(MAX_AUDIO_BYTES + 1)], 'lagu.mp3', { type: 'audio/mpeg' })

  await expect(uploadAudioFile(tooBig)).rejects.toThrow(/10 MB/)
  expect(mockedPost).not.toHaveBeenCalled()
})

// 6 MB adalah kasus nyata yang dilaporkan user: BUKAN terlalu besar, jadi
// harus benar-benar terkirim, bukan ditolak di klien.
test('uploadAudioFile TIDAK menolak MP3 6 MB - itu di bawah batas dan wajib terkirim', async () => {
  mockedPost.mockResolvedValueOnce({ data: { data: { url: '/uploads/audio/lagu.mp3' } } })
  const file = new File([new Uint8Array(6 * 1024 * 1024)], 'lagu.mp3', { type: 'audio/mpeg' })

  await expect(uploadAudioFile(file)).resolves.toBe('/uploads/audio/lagu.mp3')
  expect(mockedPost).toHaveBeenCalledTimes(1)
})
