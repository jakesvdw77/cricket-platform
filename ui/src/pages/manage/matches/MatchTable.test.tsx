import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

function renderTable(matches: Match[], viewTo?: (match: Match) => string, extra: Partial<Parameters<typeof MatchTable>[0]> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/manage/fixtures/matches']}>
        <MatchTable clubId="club-1" matches={matches} teamsById={teams} leaguesById={leagues} seasonsById={seasons} viewTo={viewTo} {...extra} />
      </MemoryRouter>
    </QueryClientProvider>,
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
    for (const name of ['When', 'Match', 'Announced', 'Poll', 'Status', 'Actions']) {
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
      makeMatch({ id: 'past', matchDate: '2026-10-09T08:00:00', resultStatus: 'PUBLISHED' }),
    ])
    const rows = screen.getAllByTestId('match-row')
    expect(rows[0]).toHaveAttribute('data-tone', 'warning')
    expect(rows[1]).toHaveAttribute('data-tone', 'neutral')
    expect(within(rows[1]).getByTestId('match-row-when')).toHaveTextContent(/in 5 days/)
    expect(within(rows[2]).getByTestId('match-row-when')).toHaveTextContent('Played')
  })

  it('says Awaiting result for a started match without a published result, and shows the result chip (docs/specs/100)', () => {
    renderTable([
      makeMatch({ id: 'none', matchDate: '2026-10-09T08:00:00' }),
      makeMatch({ id: 'draft', matchDate: '2026-10-09T08:00:00', resultStatus: 'DRAFT' }),
      makeMatch({ id: 'done', matchDate: '2026-10-09T08:00:00', resultStatus: 'PUBLISHED' }),
    ])
    const rows = screen.getAllByTestId('match-row')
    expect(within(rows[0]).getByTestId('match-row-when')).toHaveTextContent('Awaiting result')
    expect(within(rows[0]).queryByTestId('match-row-result')).not.toBeInTheDocument()
    expect(within(rows[1]).getByTestId('match-row-when')).toHaveTextContent('Awaiting result')
    expect(within(rows[1]).getByTestId('match-row-result')).toHaveTextContent('Result draft')
    expect(within(rows[2]).getByTestId('match-row-when')).toHaveTextContent('Played')
    expect(within(rows[2]).getByTestId('match-row-result')).toHaveTextContent('Completed')
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
    for (const id of ['match-row-when', 'match-row-announced', 'match-row-poll', 'match-row-status']) {
      expect(within(row).getByTestId(id)).toHaveAttribute('data-desktop-only', 'true')
    }
    expect(within(row).getByTestId('match-row-selection')).not.toHaveAttribute('data-desktop-only')
    expect(within(row).getByTestId('match-row-phone-when')).toBeInTheDocument()
  })

  it('links the whole row to the match, and renders no link without a viewTo', () => {
    const { unmount } = renderTable([makeMatch({ id: 'm1', matchDate: '2026-10-15T07:15:00' })], (match) => `/manage/fixtures/matches/${match.id}`)
    expect(screen.getByRole('link', { name: '1st XI vs Riverside Occasionals' })).toHaveAttribute('href', '/manage/fixtures/matches/m1?returnTo=%2Fmanage%2Ffixtures%2Fmatches&returnLabel=Matches')
    unmount()

    renderTable([makeMatch({ id: 'm1', matchDate: '2026-10-15T07:15:00' })])
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('marks an inactive match in its Status cell', () => {
    renderTable([makeMatch({ active: false, matchDate: '2026-10-15T07:15:00' })])
    expect(within(screen.getByTestId('match-row-status')).getByText('Inactive')).toBeInTheDocument()
  })

  // Owner request 2026-10-31: the status chip is its own centred, non-wrapping column, so a row is one line plus the league line.
  it('puts the status chip in its own centred Status column, not under the league line, and keeps it under the name on a phone', () => {
    renderTable([makeMatch({ matchDate: '2026-10-09T08:00:00', resultStatus: 'PUBLISHED' }), makeMatch({ id: 'plain', matchDate: '2026-10-15T07:15:00' })])
    const [done, plain] = screen.getAllByTestId('match-row')
    const status = within(done).getByTestId('match-row-status')
    expect(status).toHaveTextContent('Completed')
    expect(status).toHaveAttribute('data-desktop-only', 'true')
    expect(window.getComputedStyle(status).justifyContent).toBe('center')
    expect(window.getComputedStyle(status).whiteSpace).toBe('nowrap')
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    // Nothing to show: a dash. On a phone the chips stay under the name.
    expect(within(plain).getByTestId('match-row-status')).toHaveTextContent('–')
    expect(within(done).getByTestId('match-row-phone-status')).toHaveTextContent('Completed')
    expect(within(plain).queryByTestId('match-row-phone-status')).not.toBeInTheDocument()
  })

  it('is flat, with no chevron, no Delete column and one actions kebab per row that never opens the row', () => {
    renderTable([makeMatch({ id: 'm1', deletable: true }), makeMatch({ id: 'm2' })], (match) => `/manage/fixtures/matches/${match.id}`)
    const table = screen.getByRole('table', { name: 'Matches' })
    expect(window.getComputedStyle(table).boxShadow).toBe('none')
    expect(screen.queryByRole('button', { name: /^Delete match/ })).not.toBeInTheDocument()
    expect(table.querySelector('[data-testid="ChevronRightOutlinedIcon"]')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'Actions for 1st XI v Riverside Occasionals' })).toHaveLength(2)
    const press = vi.fn()
    document.addEventListener('click', press)
    screen.getAllByRole('button', { name: /^Actions for/ })[0].click()
    document.removeEventListener('click', press)
    expect(press).not.toHaveBeenCalled()
  })

  it('tints the second row, not the first (zebra parity), under a tinted header', () => {
    renderTable([makeMatch({ id: 'a' }), makeMatch({ id: 'b' })])
    const [first, second] = screen.getAllByTestId('match-row')
    expect(window.getComputedStyle(second).backgroundColor).not.toBe(window.getComputedStyle(first).backgroundColor)
  })

  it('with a toolbar renders ONE card holding it, and shows the empty message in place of the table', () => {
    const { unmount } = renderTable([makeMatch({ id: 'a' })], undefined, { toolbar: <div>bar</div> })
    const card = screen.getByTestId('matches-fused-card')
    expect(card).toHaveTextContent('bar')
    expect(card).toContainElement(screen.getByRole('table', { name: 'Matches' }))
    unmount()
    renderTable([], undefined, { toolbar: <div>bar</div>, empty: <p>Nothing here</p> })
    expect(screen.getByText('bar')).toBeInTheDocument()
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
