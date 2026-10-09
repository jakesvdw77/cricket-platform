import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MatchTable } from './MatchTable'
import { groupPoll, makeMatch, makeTeam, makeTeams, squadPoll } from './matchTestUtils'
import type { Match } from '../../../api/matchApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'

const NOW = new Date('2026-10-09T12:00:00')
const teams = makeTeams(makeTeam('team-1', '1st XI'), makeTeam('team-2', '2nd XI'))
const leagues = new Map([['league-1', { id: 'league-1', name: 'TVL Division 1' } as League]])
const seasons = new Map([['season-1', { id: 'season-1', label: '2026/27' } as Season]])

function renderTable(matches: Match[], viewTo?: (match: Match) => string) {
  return render(
    <MemoryRouter>
      <MatchTable matches={matches} teamsById={teams} leaguesById={leagues} seasonsById={seasons} viewTo={viewTo} />
    </MemoryRouter>,
  )
}

describe('MatchTable', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('renders a header row and one row per match, with the teams and the league and season under them', () => {
    renderTable([makeMatch({ id: 'm1', leagueId: 'league-1', matchDate: '2026-10-15T07:15:00' }), makeMatch({ id: 'm2', matchDate: '2026-10-16T07:15:00' })])
    expect(screen.getByRole('table', { name: 'Matches' })).toBeInTheDocument()
    for (const name of ['When', 'Match', 'Announced', 'Poll']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByTestId('match-row')).toHaveLength(2)
    expect(screen.getAllByText('1st XI vs Riverside Occasionals')).toHaveLength(2)
    expect(screen.getByText('TVL Division 1 · 2026/27')).toBeInTheDocument()
    expect(screen.getByText('Friendly · 2026/27')).toBeInTheDocument()
  })

  it('turns a row amber within 24 hours and says Played once started', () => {
    renderTable([
      makeMatch({ id: 'soon', matchDate: '2026-10-09T18:00:00' }),
      makeMatch({ id: 'later', matchDate: '2026-10-15T07:15:00' }),
      makeMatch({ id: 'past', matchDate: '2026-10-09T08:00:00' }),
    ])
    const rows = screen.getAllByTestId('match-row')
    expect(rows[0]).toHaveAttribute('data-tone', 'warning')
    expect(rows[1]).toHaveAttribute('data-tone', 'neutral')
    expect(within(rows[1]).getByTestId('match-row-when')).toHaveTextContent(/in 5 days/)
    expect(within(rows[2]).getByTestId('match-row-when')).toHaveTextContent('Played')
  })

  it('shows the picked count of the club side, both sides for a derby, and a dash with no club side', () => {
    renderTable([
      makeMatch({ id: 'a', homePickedCount: 10, playingXiSize: 12, matchDate: '2026-10-15T07:15:00' }),
      makeMatch({ id: 'b', awayTeamId: 'team-2', awayTeamName: null, homePickedCount: 10, awayPickedCount: 8, playingXiSize: 12, matchDate: '2026-10-15T07:15:00' }),
      makeMatch({ id: 'c', homeTeamId: null, homeTeamName: 'Other FC', homePickedCount: null, matchDate: '2026-10-15T07:15:00' }),
    ])
    const cells = screen.getAllByTestId('match-row-selection')
    expect(cells[0]).toHaveTextContent('10/12')
    expect(cells[1]).toHaveTextContent('10/12 · 8/12')
    expect(cells[2]).toHaveTextContent('–')
  })

  it('shows the announced and poll chips', () => {
    renderTable([
      makeMatch({ id: 'a', homeSideAnnounced: true, polls: [squadPoll()], matchDate: '2026-10-15T07:15:00' }),
      makeMatch({ id: 'b', polls: [groupPoll({ open: false })], matchDate: '2026-10-15T07:15:00' }),
      makeMatch({ id: 'c', matchDate: '2026-10-15T07:15:00' }),
    ])
    const [a, b, c] = screen.getAllByTestId('match-row')
    expect(within(a).getByTestId('match-row-announced')).toHaveTextContent('Announced')
    expect(within(a).getByTestId('match-row-poll')).toHaveTextContent('Poll open')
    expect(within(b).getByTestId('match-row-poll')).toHaveTextContent('Poll closed')
    expect(within(c).getByTestId('match-row-poll')).toHaveTextContent('No poll')
    expect(within(c).getByTestId('match-row-announced')).toHaveTextContent('Not announced')
  })

  it('keeps the desktop-only columns marked so a phone can drop them', () => {
    renderTable([makeMatch({ matchDate: '2026-10-15T07:15:00' })])
    const row = screen.getByTestId('match-row')
    for (const id of ['match-row-when', 'match-row-announced', 'match-row-poll']) {
      expect(within(row).getByTestId(id)).toHaveAttribute('data-desktop-only', 'true')
    }
    expect(within(row).getByTestId('match-row-selection')).not.toHaveAttribute('data-desktop-only')
    expect(within(row).getByTestId('match-row-phone-when')).toBeInTheDocument()
  })

  it('links the whole row to the match, and renders no link without a viewTo', () => {
    const { unmount } = renderTable([makeMatch({ id: 'm1', matchDate: '2026-10-15T07:15:00' })], (match) => `/manage/fixtures/matches/${match.id}`)
    expect(screen.getByRole('link', { name: '1st XI vs Riverside Occasionals' })).toHaveAttribute('href', '/manage/fixtures/matches/m1')
    unmount()

    renderTable([makeMatch({ id: 'm1', matchDate: '2026-10-15T07:15:00' })])
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('marks an inactive match', () => {
    renderTable([makeMatch({ active: false, matchDate: '2026-10-15T07:15:00' })])
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })
})
