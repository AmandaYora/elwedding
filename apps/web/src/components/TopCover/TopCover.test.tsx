import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GuestSessionState } from '@/hooks/useGuestSession'
import TopCover from './TopCover'
import type { InvitationContent } from '@/types/api'

// Yang di-mock adalah HOOK-nya, bukan HTTP-nya - test ini menguji pemetaan
// state sesi -> teks sapaan, bukan jalur jaringannya.
const mockSession = vi.fn<() => GuestSessionState>()
vi.mock('@/hooks/useGuestSession', () => ({
  useGuestSession: () => mockSession(),
}))

const BASE_SESSION: GuestSessionState = {
  name: 'Tamu Undangan',
  side: null,
  status: 'pending',
  token: null,
  attendingCount: 1,
  resolved: false,
}

const content = { brideName: 'Ariana', groomName: 'Adrian' } as InvitationContent

function greetingText(container: HTMLElement): string {
  return container.querySelector('.details p')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

describe('TopCover', () => {
  beforeEach(() => mockSession.mockReset())

  it('tanpa token: tetap "Dear Mr/Mrs/Ms" persis seperti sebelumnya (K7)', () => {
    mockSession.mockReturnValue({ ...BASE_SESSION })
    const { container } = render(<TopCover content={content} />)
    expect(greetingText(container)).toBe('Dear Mr/Mrs/Ms')
  })

  it('token ter-resolve: menampilkan nama tamu, bukan Mr/Mrs/Ms', () => {
    mockSession.mockReturnValue({ ...BASE_SESSION, name: 'Budi Santoso', token: 'tok-1', resolved: true })
    const { container } = render(<TopCover content={content} />)
    const text = greetingText(container)
    expect(text).toBe('Dear Budi Santoso')
    expect(text).not.toContain('Mr/Mrs/Ms')
  })

  it('token ADA tapi belum resolve: tetap "Dear Mr/Mrs/Ms", TIDAK pernah "Tamu Undangan"', () => {
    // Jendela nyata: token ada, fetch by-token belum selesai, sehingga
    // session.name masih DEFAULT_SESSION.name. Mencetak session.name apa
    // adanya di sini akan memunculkan "Dear Tamu Undangan" sekejap.
    mockSession.mockReturnValue({ ...BASE_SESSION, token: 'tok-1', resolved: false })
    const { container } = render(<TopCover content={content} />)
    const text = greetingText(container)
    expect(text).toBe('Dear Mr/Mrs/Ms')
    expect(text).not.toContain('Tamu Undangan')
  })
})
