import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerStatsPage from './PlayerStatsPage'

// Smoke test only: the full suite for this page follows the owner's browser check (docs/specs/103).
const usePlayerStats = vi.fn()
vi.mock('../../../api/playerStatsApi', () => ({
  usePlayerStats: (...args: unknown[]) => usePlayerStats(...args),
  usePlayerStatsFilterOptions: () => ({
    data: { seasonIds: [], leagueIds: [], teamIds: [], sectionIds: [], competitions: ['LEAGUE'] },
  }),
}))
vi.mock('../../../api/playerApi', () => ({
  listPlayers: () =>
    Promise.resolve([{ id: 'player-1', firstName: 'Sam', lastName: 'Visser', active: true, verificationStatus: 'VERIFIED', sectionIds: [] }]),
}))
vi.mock('../../../api/seasonApi', () => ({ listSeasons: () => Promise.resolve([]) }))
vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([]) }))
vi.mock('../../../api/sectionApi', () => ({ listSections: () => Promise.resolve([]) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([]) }))

const stats = {
  playerId: 'player-1',
  scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, teamId: null, competition: null },
  basis: { matchesCounted: 18, resultsWithBattingCard: 14, resultsWithBowlingCard: 12 },
  batting: {
    matches: 18, innings: 14, notOuts: 3, dismissals: 11, runs: 412, ballsFaced: 428, fours: 38, sixes: 6, ducks: 1, goldenDucks: 0,
    thirtyPlus: 5, fiftyPlus: 2, hundredPlus: 0, centuries: 0, halfCenturies: 2, highestScore: { runs: 94, notOut: true },
    dismissalModes: { BOWLED: 4, CAUGHT: 5 }, positions: [{ position: 1, innings: 6, runs: 212, average: 35.33 }],
    average: 29.43, strikeRate: 96.3, boundaryPercentage: 64, ballsPerBoundary: 9.7,
    coverage: { inningsWithBalls: 9, inningsWithBoundaries: 9, inningsCounted: 14 },
  },
  bowling: {
    inningsBowled: 12, ballsBowled: 368, ballsPerOver: [6], mixedOverLengths: false, runsConceded: 298, wickets: 21, maidens: 4, wides: 9,
    noBalls: 2, dots: 0, threeWicketHauls: 3, fourWicketHauls: 1, fiveWicketHauls: 0, best: { wickets: 4, runs: 17 },
    dismissalModes: { BOWLED: 9 }, dismissalsNotRecorded: 1, average: 14.2, economy: 5.8, strikeRate: 17.5, dotBallPercentage: null,
    coverage: { inningsWithWides: 10, inningsWithNoBalls: 10, inningsWithDots: 0, inningsCounted: 12 },
  },
  fielding: { catches: 9, stumpings: 0, runOuts: 2, dismissals: 11, dismissalsPerMatch: 0.61 },
  awards: { playerOfTheMatch: 4, teamPlayerOfTheMatch: 2 },
  record: { won: 11, lost: 6, tied: 1, drawn: 0, internal: 0 },
  form: { batting: [], bowling: [] },
  notCaptured: [
    { code: 'BATTING_DOT_BALL_PERCENTAGE', tab: 'BATTING', label: 'Dot ball percentage', reason: 'the scorecard does not record dot balls faced' },
    { code: 'BOUNDARIES_CONCEDED', tab: 'BOWLING', label: 'Boundaries conceded', reason: 'not recorded per bowler' },
  ],
}

function renderPage(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="players/:playerId/stats" element={<PlayerStatsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlayerStatsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    usePlayerStats.mockReset()
    usePlayerStats.mockReturnValue({ data: stats, isError: false, refetch: vi.fn() })
  })

  it('opens on Batting with the basis line, and only the batting item in Not captured yet', async () => {
    renderPage('/manage/players/player-1/stats')
    expect(await screen.findByRole('heading', { name: 'Sam Visser' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByTestId('tile-highest-value')).toHaveTextContent('94*')
    expect(screen.getByTestId('stats-basis')).toHaveTextContent('Based on 18 published results with this player on the team list: 14 with a batting card.')
    expect(screen.getByTestId('not-captured-panel')).toHaveTextContent('Dot ball percentage')
    expect(screen.getByTestId('not-captured-panel')).not.toHaveTextContent('Boundaries conceded')
  })

  it('the Bowling tab shows three separate haul counters', async () => {
    renderPage('/manage/players/player-1/stats?tab=bowling')
    expect(await screen.findByTestId('haul-3', {}, { timeout: 5000 })).toHaveTextContent('3')
    expect(screen.getByTestId('haul-4')).toHaveTextContent('1')
    expect(screen.getByTestId('haul-5')).toHaveTextContent('0')
    expect(screen.getByTestId('tile-best-value')).toHaveTextContent('4/17')
  })

  it('shows the no-results empty state with a pointer to Results', async () => {
    usePlayerStats.mockReturnValue({ data: { ...stats, basis: { matchesCounted: 0, resultsWithBattingCard: 0, resultsWithBowlingCard: 0 } }, isError: false, refetch: vi.fn() })
    renderPage('/manage/players/player-1/stats')
    expect(await screen.findByText('No published results yet', {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to Results' })).toHaveAttribute('href', '/manage/results')
  })

  it('switches tab through the address', async () => {
    renderPage('/manage/players/player-1/stats')
    await userEvent.click(await screen.findByRole('tab', { name: 'Fielding' }, { timeout: 5000 }))
    expect(await screen.findByTestId('tile-catches-value')).toHaveTextContent('9')
    expect(screen.queryByText('Record while playing')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Awards & record' }))
    expect(await screen.findByText('Record while playing')).toBeInTheDocument()
    expect(screen.getByText('Awards')).toBeInTheDocument()
    expect(screen.queryByText('Dismissals')).not.toBeInTheDocument()
  })
})
