import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PollShareDialog } from './PollShareDialog'
import type { Match } from '../../api/matchApi'

function makeMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'match-1',
    clubId: 'club-1',
    homeTeamId: 'team-1',
    homeTeamName: null,
    awayTeamId: null,
    awayTeamName: 'Riverside CC',
    leagueId: null,
    seasonId: 'season-1',
    matchDate: '2026-10-04T09:00:00Z',
    venue: 'Central Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    updatedBy: null,
    ...overrides,
  }
}

describe('PollShareDialog', () => {
  it('generates invite text embedding the poll link when opened', () => {
    render(
      <PollShareDialog open onClose={vi.fn()} match={makeMatch()} teamName="Home Firsts" pollId="poll-123" />,
    )

    const textarea = screen.getByLabelText('Invite text') as HTMLTextAreaElement
    expect(textarea.value).toContain(`${window.location.origin}/poll/poll-123`)
    expect(textarea.value).toContain('Riverside CC')
    expect(textarea.value).toContain('Central Oval')
  })

  it('highlights the close time in WhatsApp bold when the poll auto-closes', () => {
    const closeAt = new Date(2026, 9, 2, 20, 0).toISOString()
    render(
      <PollShareDialog
        open
        onClose={vi.fn()}
        match={makeMatch()}
        teamName="Home Firsts"
        pollId="poll-123"
        autoClose
        scheduledCloseAt={closeAt}
      />,
    )

    const text = (screen.getByLabelText('Invite text') as HTMLTextAreaElement).value
    expect(text).toContain('⏰ *Please reply by Fri 2 Oct, 20:00*')
    expect(text).toContain('🏏 *Availability: Home Firsts vs Riverside CC*')
    expect(text).toContain('Central Oval')
  })

  it('omits the close line without an automatic close time', () => {
    render(
      <PollShareDialog open onClose={vi.fn()} match={makeMatch()} teamName="Home Firsts" pollId="poll-123" autoClose={false} scheduledCloseAt={null} />,
    )

    expect((screen.getByLabelText('Invite text') as HTMLTextAreaElement).value).not.toContain('Please reply by')
  })

  it('lets the admin edit the text, then "Regenerate" rebuilds it back to the fresh version', async () => {
    const user = userEvent.setup()
    render(
      <PollShareDialog open onClose={vi.fn()} match={makeMatch()} teamName="Home Firsts" pollId="poll-123" />,
    )

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
    render(<PollShareDialog open onClose={onClose} match={makeMatch()} teamName="Home Firsts" pollId="poll-123" />)

    await user.click(screen.getByRole('button', { name: /^close$/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing visible when closed', () => {
    render(<PollShareDialog open={false} onClose={vi.fn()} match={makeMatch()} teamName="Home Firsts" pollId="poll-123" />)
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
      render(<PollShareDialog open onClose={vi.fn()} match={makeMatch()} teamName="Home Firsts" pollId="poll-123" />)

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
      render(<PollShareDialog open onClose={vi.fn()} match={makeMatch()} teamName="Home Firsts" pollId="poll-123" />)

      await user.click(screen.getByRole('button', { name: 'Copy link' }))

      expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/poll/poll-123`)
      expect(await screen.findByRole('status')).toHaveTextContent('Link copied.')
    })

    it('falls back to execCommand when the clipboard API rejects', async () => {
      const user = userEvent.setup()
      mockClipboard(vi.fn().mockRejectedValue(new Error('denied')))
      const execCommand = vi.fn().mockReturnValue(true)
      document.execCommand = execCommand
      render(<PollShareDialog open onClose={vi.fn()} match={makeMatch()} teamName="Home Firsts" pollId="poll-123" />)

      await user.click(screen.getByRole('button', { name: 'Copy message' }))

      await waitFor(() => expect(execCommand).toHaveBeenCalledWith('copy'))
      expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()
    })

    it('tells the admin to copy manually when both routes fail', async () => {
      const user = userEvent.setup()
      mockClipboard(vi.fn().mockRejectedValue(new Error('denied')))
      document.execCommand = vi.fn().mockReturnValue(false)
      render(<PollShareDialog open onClose={vi.fn()} match={makeMatch()} teamName="Home Firsts" pollId="poll-123" />)

      await user.click(screen.getByRole('button', { name: 'Copy link' }))

      expect(await screen.findByRole('status')).toHaveTextContent(/copy it manually/i)
      expect(screen.getByRole('button', { name: 'Copy link' })).toBeInTheDocument()
    })
  })
})
