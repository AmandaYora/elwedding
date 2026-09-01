import { render, screen } from '@testing-library/react'
import { Badge } from './Badge'
import { STATUS_LABEL } from '@/shared/constants/guests'

test('empat status memetakan ke label Indonesia yang benar', () => {
  render(
    <>
      <Badge status="attending" label={STATUS_LABEL.attending} />
      <Badge status="not_attending" label={STATUS_LABEL.not_attending} />
      <Badge status="remind_later" label={STATUS_LABEL.remind_later} />
      <Badge status="pending" label={STATUS_LABEL.pending} />
    </>,
  )

  expect(screen.getByText('Hadir')).toBeInTheDocument()
  expect(screen.getByText('Tidak hadir')).toBeInTheDocument()
  expect(screen.getByText('Perlu diingatkan')).toBeInTheDocument()
  expect(screen.getByText('Belum jawab')).toBeInTheDocument()
})

test('warna berbeda per status (tidak ada dua status memakai warna teks yang sama)', () => {
  const { container: c1 } = render(<Badge status="attending" label="Hadir" />)
  const { container: c2 } = render(<Badge status="not_attending" label="Tidak hadir" />)
  const { container: c3 } = render(<Badge status="remind_later" label="Perlu diingatkan" />)
  const { container: c4 } = render(<Badge status="pending" label="Belum jawab" />)

  const colors = [c1, c2, c3, c4].map((c) => (c.firstChild as HTMLElement).style.color)
  expect(new Set(colors).size).toBe(4)
})
