import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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
})
