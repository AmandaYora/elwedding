import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { Switch } from './Switch'

function ControlledSwitch({ initial = false }: { initial?: boolean }) {
  const [checked, setChecked] = useState(initial)
  return <Switch checked={checked} onChange={setChecked} label="Diperkirakan hadir" />
}

test('role="switch" dengan aria-checked sesuai state', () => {
  render(<ControlledSwitch initial={false} />)

  const el = screen.getByRole('switch')
  expect(el).toHaveAttribute('aria-checked', 'false')
})

test('klik mengubah aria-checked', () => {
  render(<ControlledSwitch initial={false} />)

  const el = screen.getByRole('switch')
  fireEvent.click(el)

  expect(el).toHaveAttribute('aria-checked', 'true')
})

test('label ditampilkan dan terasosiasi dengan switch', () => {
  render(<ControlledSwitch />)

  expect(screen.getByText('Diperkirakan hadir')).toBeInTheDocument()
})
