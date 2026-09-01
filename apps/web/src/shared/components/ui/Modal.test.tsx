import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { Modal } from './Modal'

function ControlledModal() {
  const [open, setOpen] = useState(true)
  const [value, setValue] = useState('')
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Form modal">
      <input aria-label="nama" value={value} onChange={(e) => setValue(e.target.value)} />
      <textarea aria-label="catatan" />
    </Modal>
  )
}

test('fokus tidak hilang saat mengetik meski onClose berubah identitas tiap render', () => {
  render(<ControlledModal />)

  const input = screen.getByLabelText('nama')
  input.focus()
  expect(document.activeElement).toBe(input)

  fireEvent.change(input, { target: { value: 'a' } })
  expect(document.activeElement).toBe(input)

  fireEvent.change(input, { target: { value: 'ab' } })
  expect(document.activeElement).toBe(input)

  fireEvent.change(input, { target: { value: 'abc' } })
  expect(document.activeElement).toBe(input)
})

test('Escape tetap menutup modal', () => {
  const onClose = vi.fn()
  render(
    <Modal open onClose={onClose} title="Judul">
      <p>Isi</p>
    </Modal>,
  )

  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('klik langsung di backdrop menutup modal', () => {
  const onClose = vi.fn()
  render(
    <Modal open onClose={onClose} title="Judul">
      <p>Isi</p>
    </Modal>,
  )

  const backdrop = screen.getByRole('dialog').parentElement as HTMLElement
  fireEvent.mouseDown(backdrop)
  fireEvent.click(backdrop)
  expect(onClose).toHaveBeenCalledTimes(1)
})

test('drag dari dalam dialog ke backdrop tidak menutup modal', () => {
  const onClose = vi.fn()
  render(
    <Modal open onClose={onClose} title="Judul">
      <textarea aria-label="catatan" />
    </Modal>,
  )

  const textarea = screen.getByLabelText('catatan')
  const backdrop = screen.getByRole('dialog').parentElement as HTMLElement

  fireEvent.mouseDown(textarea)
  fireEvent.click(backdrop)
  expect(onClose).not.toHaveBeenCalled()
})

test('tombol close (ikon X) menutup modal', () => {
  const onClose = vi.fn()
  render(
    <Modal open onClose={onClose} title="Judul">
      <p>Isi</p>
    </Modal>,
  )

  fireEvent.click(screen.getByLabelText('Tutup'))
  expect(onClose).toHaveBeenCalledTimes(1)
})
