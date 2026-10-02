import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SectionAvailabilityShareDialog } from './SectionAvailabilityShareDialog'
import type { SectionAvailabilityRound } from '../../api/sectionAvailabilityApi'

function makeRound(overrides: Partial<SectionAvailabilityRound> = {}): SectionAvailabilityRound {
  return {
    id: 'round-1',
    sectionId: 'section-1',
    sectionName: 'U13 Boys',
    description: 'Sat 3 - Sun 4 Oct - U13 Boys fixtures',
    firstMatchDate: '2026-10-03',
    firstMatchKickoff: '2026-10-03T09:00:00Z',
    lastMatchDate: '2026-10-04',
    autoClose: true,
    scheduledCloseAt: '2026-10-02T09:00:00Z',
    open: true,
    brackets: [
      {
        dayPart: 'MORNING',
        windowDate: '2026-10-03',
        windowId: 'window-1',
        availableCount: 0,
        unavailableCount: 0,
        unsureCount: 0,
        noResponseCount: 0,
        coveredMatchCount: 0,
      },
      {
        dayPart: 'MORNING',
        windowDate: '2026-10-04',
        windowId: 'window-2',
        availableCount: 0,
        unavailableCount: 0,
        unsureCount: 0,
        noResponseCount: 0,
        coveredMatchCount: 0,
      },
    ],
    ...overrides,
  }
}

describe('SectionAvailabilityShareDialog', () => {
  it('generates invite text embedding the round link when opened', () => {
    render(<SectionAvailabilityShareDialog open onClose={vi.fn()} round={makeRound()} />)

    const textarea = screen.getByLabelText('Invite text') as HTMLTextAreaElement
    expect(textarea.value).toContain(`${window.location.origin}/section-availability/round-1`)
    expect(textarea.value).toContain('U13 Boys')
    expect(textarea.value).toContain('Sat 3 - Sun 4 Oct - U13 Boys fixtures')
  })

  it('lets the admin edit the text, then "Regenerate" rebuilds it back to the fresh version', async () => {
    const user = userEvent.setup()
    render(<SectionAvailabilityShareDialog open onClose={vi.fn()} round={makeRound()} />)

    const textarea = screen.getByLabelText('Invite text') as HTMLTextAreaElement
    const original = textarea.value
    await user.type(textarea, ' EDITED')
    expect(textarea.value).toContain('EDITED')

    await user.click(screen.getByRole('button', { name: /regenerate/i }))
    expect(textarea.value).toBe(original)
  })

  it('calls onClose when Close is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<SectionAvailabilityShareDialog open onClose={onClose} round={makeRound()} />)

    await user.click(screen.getByRole('button', { name: /^close$/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing visible when closed', () => {
    render(<SectionAvailabilityShareDialog open={false} onClose={vi.fn()} round={makeRound()} />)
    expect(screen.queryByLabelText('Invite text')).not.toBeInTheDocument()
  })

  describe('copy to clipboard', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    function mockClipboard(writeText: (text: string) => Promise<void>) {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    }

    it('Copy message copies the full text as shown and the button briefly reads Copied', async () => {
      const user = userEvent.setup()
      const writeText = vi.fn().mockResolvedValue(undefined)
      mockClipboard(writeText)
      render(<SectionAvailabilityShareDialog open onClose={vi.fn()} round={makeRound()} />)

      const textarea = screen.getByLabelText('Invite text') as HTMLTextAreaElement
      await user.click(screen.getByRole('button', { name: 'Copy message' }))

      expect(writeText).toHaveBeenCalledWith(textarea.value)
      expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Message copied.')
    })

    it('Copy link copies just the poll link', async () => {
      const user = userEvent.setup()
      const writeText = vi.fn().mockResolvedValue(undefined)
      mockClipboard(writeText)
      render(<SectionAvailabilityShareDialog open onClose={vi.fn()} round={makeRound()} />)

      await user.click(screen.getByRole('button', { name: 'Copy link' }))

      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/section-availability/round-1`)
      expect(await screen.findByRole('status')).toHaveTextContent('Link copied.')
    })

    it('falls back to execCommand when the clipboard API rejects', async () => {
      const user = userEvent.setup()
      mockClipboard(vi.fn().mockRejectedValue(new Error('denied')))
      const execCommand = vi.fn().mockReturnValue(true)
      document.execCommand = execCommand
      render(<SectionAvailabilityShareDialog open onClose={vi.fn()} round={makeRound()} />)

      await user.click(screen.getByRole('button', { name: 'Copy message' }))

      await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'))
      expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    })

    it('tells the admin to copy manually when both routes fail', async () => {
      const user = userEvent.setup()
      mockClipboard(vi.fn().mockRejectedValue(new Error('denied')))
      document.execCommand = vi.fn().mockReturnValue(false)
      render(<SectionAvailabilityShareDialog open onClose={vi.fn()} round={makeRound()} />)

      await user.click(screen.getByRole('button', { name: 'Copy link' }))

      expect(await screen.findByRole('status')).toHaveTextContent(/copy it manually/i)
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
    })
  })
})
