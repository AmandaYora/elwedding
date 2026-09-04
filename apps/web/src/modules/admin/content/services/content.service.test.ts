import { httpClient } from '@/shared/services/http-client'
import { prepareImageForUpload } from '@/shared/lib/image-compress'
import { uploadImageBase64 } from './content.service'

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
  expect(mockedCompress).toHaveBeenCalledWith(file, 1920)
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

  expect(mockedCompress).toHaveBeenCalledWith(expect.any(File), 1920)
})
