import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { League } from '../../../api/leagueApi'
import { LeagueCard } from './LeagueCard'
import { LeagueTable } from './LeagueTable'

// docs/specs/122-league-sharing.md (Entry points): the league card has a labelled Share button, the list row an icon button;
// both hand the league to the page, which owns the one dialog. Neither shows Share when the page gave no handler.
const league = {
  id: 'league-1', clubId: 'club-1', name: 'Riverside Premier League', source: 'INTERNAL', maxPlayingXiSize: 11, minAge: null, maxAge: null,
  ageCutoffMonth: null, ageCutoffDay: null, active: true, createdAt: '', updatedAt: '', updatedBy: null, currentSeasonTeamCount: 0,
  currentSeasonLabel: null, currentSeasonPlayingConditionsUrl: null, matchCount: 0, playedCount: 0, firstMatchDate: null, lastMatchDate: null,
  nextMatchDate: null, teams: [], format: null, logoUrl: null, phone: null, website: null, email: null, socialLinks: [],
} as League

describe('LeagueCard Share', () => {
  it('shows a labelled Share button that passes the league on', async () => {
    const onShare = vi.fn()
    render(<MemoryRouter><LeagueCard league={league} onShare={onShare} /></MemoryRouter>)

    const button = screen.getByRole('button', { name: 'Share Riverside Premier League' })
    expect(button).toHaveTextContent('Share')
    await userEvent.click(button)
    expect(onShare).toHaveBeenCalledWith(league)
  })

  it('has no Share button without a handler', () => {
    render(<MemoryRouter><LeagueCard league={league} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /^Share / })).not.toBeInTheDocument()
  })
})

describe('LeagueTable Share', () => {
  it('shows an icon button per row that passes that league on', async () => {
    const onShare = vi.fn()
    const other = { ...league, id: 'league-2', name: 'Cup' }
    render(<MemoryRouter><LeagueTable leagues={[league, other]} onShare={onShare} /></MemoryRouter>)

    await userEvent.click(screen.getByRole('button', { name: 'Share Cup' }))
    expect(onShare).toHaveBeenCalledTimes(1)
    expect(onShare).toHaveBeenCalledWith(other)
    expect(screen.getByRole('button', { name: 'Share Riverside Premier League' })).toBeInTheDocument()
  })

  it('has no Share button without a handler', () => {
    render(<MemoryRouter><LeagueTable leagues={[league]} /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /^Share / })).not.toBeInTheDocument()
  })
})
