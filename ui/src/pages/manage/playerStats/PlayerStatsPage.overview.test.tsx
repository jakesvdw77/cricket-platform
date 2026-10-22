import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerStatsPage from './PlayerStatsPage'
import { emptyPlayerDashboard, makePlayerDashboard } from '../../../test/dashboardFixtures'
import type { PlayerDashboard } from '../../../api/playerDashboardApi'

// docs/specs/117-stats-dashboard.md (Test Plan, "Frontend component", Player page): the Overview tab through the real hooks and query keys
// over a routed axios mock, so what the page asks the server for is observable. The figures are the server's; nothing is computed here.
const apiGet = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }))
vi.mock('../../../api/playerApi', () => ({
  listPlayers: () => Promise.resolve([{ id: 'player-1', firstName: 'Sam', lastName: 'Visser', active: true, verificationStatus: 'VERIFIED', sectionIds: [] }]),
}))
const section = (id: string, name: string, parentSectionId: string | null = null) => ({
  id, clubId: 'club-1', parentSectionId, name, minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null,
})
vi.mock('../../../api/seasonApi', () => ({
  listSeasons: () =>
    Promise.resolve([
      { id: 'season-1', clubId: 'club-1', label: '2026/27', startDate: '2026-09-01', endDate: '2027-04-30', active: true, createdAt: '2026-01-01', updatedAt: '', updatedBy: null },
      { id: 'season-2', clubId: 'club-1', label: '2025/26', startDate: '2025-09-01', endDate: '2026-04-30', active: true, createdAt: '2025-01-01', updatedAt: '', updatedBy: null },
    ]),
}))
vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([{ id: 'league-1', name: 'Premier League' }]) }))
vi.mock('../../../api/sectionApi', () => ({ listSections: () => Promise.resolve([section('club', 'Club'), section('u15a', 'U15A', 'club')]) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: 'Villagers 1' }]) }))

const OPTIONS = { seasonIds: ['season-1', 'season-2'], leagueIds: ['league-1'], teamIds: ['team-1'], sectionIds: ['u15a'], competitions: ['LEAGUE'] }
const BASE = '/manage/players/player-1/stats'
const wait = { timeout: 5000 }

function makeStats(basis = { matchesCounted: 18, resultsWithBattingCard: 14, resultsWithBowlingCard: 12 }) {
  return {
    playerId: 'player-1',
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, teamId: null, competition: null },
    basis,
    batting: {
      matches: 18, innings: 14, notOuts: 3, dismissals: 11, runs: 412, ballsFaced: 428, fours: 38, sixes: 6, ducks: 1, goldenDucks: 0,
      thirtyPlus: 5, fiftyPlus: 2, hundredPlus: 0, centuries: 0, halfCenturies: 2, highestScore: { runs: 94, notOut: true },
      dismissalModes: { CAUGHT: 5, BOWLED: 4 }, positions: [{ position: 1, innings: 6, runs: 212, average: 35.33 }],
      average: 29.43, strikeRate: 96.3, boundaryPercentage: 64, ballsPerBoundary: 9.7,
      coverage: { inningsWithBalls: 9, inningsWithBoundaries: 14, inningsCounted: 14 },
    },
    bowling: {
      inningsBowled: 12, ballsBowled: 368, ballsPerOver: [6], mixedOverLengths: false, runsConceded: 298, wickets: 21, maidens: 4, wides: 9,
      noBalls: 2, dots: 0, threeWicketHauls: 3, fourWicketHauls: 1, fiveWicketHauls: 0, best: { wickets: 4, runs: 17 },
      dismissalModes: { BOWLED: 9, LBW: 3 }, dismissalsNotRecorded: 1, average: 14.2, economy: 5.8, strikeRate: 17.5, dotBallPercentage: null,
      coverage: { inningsWithWides: 10, inningsWithNoBalls: 12, inningsWithDots: 0, inningsCounted: 12 },
    },
    fielding: { catches: 9, stumpings: 0, runOuts: 2, dismissals: 11, dismissalsPerMatch: 0.61 },
    awards: { playerOfTheMatch: 4, teamPlayerOfTheMatch: 2 },
    record: { won: 11, lost: 6, tied: 1, drawn: 0, internal: 0 },
    form: { batting: [], bowling: [] },
    notCaptured: [],
  }
}

interface Server {
  stats: () => unknown
  dashboard: () => PlayerDashboard | Error
  statsCalls: Record<string, unknown>[]
  dashboardCalls: Record<string, unknown>[]
}
let server: Server

function route(url: string, config?: { params?: Record<string, unknown> }) {
  const params = config?.params ?? {}
  if (url.endsWith('/stats/filter-options')) return Promise.resolve({ data: OPTIONS })
  if (url.endsWith('/stats/dashboard')) {
    server.dashboardCalls.push(params)
    const value = server.dashboard()
    return value instanceof Error ? Promise.reject(value) : Promise.resolve({ data: value })
  }
  if (url.endsWith('/stats/matches')) return Promise.resolve({ data: { rows: [], page: { number: 0, size: 20, totalElements: 0, hasMore: false } } })
  if (url.endsWith('/stats')) {
    server.statsCalls.push(params)
    return Promise.resolve({ data: server.stats() })
  }
  return Promise.reject(new Error(`unrouted GET ${url}`))
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

const cardTitles = () => screen.queryAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
const rows = (testId: string) => screen.getAllByTestId(`${testId}-row`).map((row) => within(row).getAllByRole('cell').map((cell) => cell.textContent))

describe('Player Overview tab', () => {
  beforeEach(() => {
    localStorage.clear()
    apiGet.mockReset()
    server = { stats: () => makeStats(), dashboard: () => makePlayerDashboard(), statsCalls: [], dashboardCalls: [] }
    apiGet.mockImplementation(route)
  })

  describe('where it sits', () => {
    it('is the first tab and the landing tab when ?tab is missing', async () => {
      renderPage(BASE)
      const tabs = await screen.findAllByRole('tab', {}, wait)
      expect(tabs.map((tab) => tab.textContent)).toEqual(['Overview', 'Batting', 'Bowling', 'Fielding', 'Awards & record', 'Matches'])
      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
      expect(await screen.findByTestId('dashboard-tab', {}, wait)).toBeInTheDocument()
    })

    it.each([['batting'], ['bowling'], ['fielding'], ['awards'], ['matches']])('?tab=%s is unchanged: that tab opens and the Overview is neither shown nor requested', async (value) => {
      renderPage(`${BASE}?tab=${value}`)
      await waitFor(() => expect(server.statsCalls.length).toBeGreaterThan(0), wait)
      await screen.findByTestId('stats-basis', {}, wait)
      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false')
      expect(screen.queryByTestId('dashboard-tab')).not.toBeInTheDocument()
      expect(server.dashboardCalls).toHaveLength(0)
    })

    it('keeps the page order: tab strip, filter bar, basis line, then the Overview body, each rendered once', async () => {
      renderPage(BASE)
      const body = await screen.findByTestId('dashboard-tab', {}, wait)
      const strip = screen.getByRole('tablist', { name: 'Statistics' })
      const filter = screen.getByRole('combobox', { name: 'Season' })
      const basis = screen.getByTestId('stats-basis')
      expect(strip.compareDocumentPosition(filter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(filter.compareDocumentPosition(basis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(basis.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(screen.getAllByRole('tablist')).toHaveLength(1)
      expect(screen.getAllByRole('combobox', { name: 'Season' })).toHaveLength(1)
      expect(screen.getAllByTestId('stats-basis')).toHaveLength(1)
      // the body adds none of its own
      expect(within(body).queryByRole('tablist')).not.toBeInTheDocument()
      expect(within(body).queryByRole('combobox')).not.toBeInTheDocument()
      expect(within(body).queryByTestId('stats-basis')).not.toBeInTheDocument()
    })
  })

  describe('layout', () => {
    it('shows the four tiles first, then the Batting group open and the Bowling group collapsed', async () => {
      renderPage(BASE)
      const body = await screen.findByTestId('dashboard-tab', {}, wait)
      const tiles = await screen.findByTestId('tile-matches', {}, wait)
      const batting = screen.getByTestId('dashboard-group-batting')
      const bowling = screen.getByTestId('dashboard-group-bowling')
      expect(['tile-matches', 'tile-runs', 'tile-wickets', 'tile-catches'].map((id) => within(body).getByTestId(id))).toHaveLength(4)
      expect(tiles.compareDocumentPosition(batting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(batting.compareDocumentPosition(bowling) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(screen.getByTestId('tile-runs-value')).toHaveTextContent('412')
      expect(screen.getByTestId('tile-wickets-value')).toHaveTextContent('21')
      expect(screen.getByTestId('dashboard-group-batting-toggle')).toHaveAttribute('aria-expanded', 'true')
      expect(screen.getByTestId('dashboard-group-bowling-toggle')).toHaveAttribute('aria-expanded', 'false')
      expect(screen.getByTestId('dashboard-group-batting-toggle')).toHaveTextContent('Hide batting')
      expect(screen.getByTestId('dashboard-group-bowling-toggle')).toHaveTextContent('Show bowling')
    })

    it('draws the three Batting cards in order with the Batting subtitle, and no bowling card or chart while that group is collapsed', async () => {
      renderPage(BASE)
      await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)
      expect(['runs-per-innings', 'dismissals', 'batting-trend'].map((id) => screen.getByTestId(`dashboard-card-${id}`))).toHaveLength(3)
      expect(cardTitles()).toEqual(['Batting', 'Runs per innings', 'How you were dismissed', 'Batting trend', 'Bowling'])
      for (const id of ['runs-per-innings', 'dismissals', 'batting-trend']) expect(screen.getByTestId(`${id}-subtitle`)).toHaveTextContent('Batting')
      expect(screen.getByTestId('dashboard-card-runs-per-innings')).toHaveAttribute('data-width', 'full')
      expect(screen.getByTestId('dashboard-card-dismissals')).toHaveAttribute('data-width', 'half')
      // collapsed: no bowling card, no chart, no skeleton
      for (const id of ['wickets-per-match', 'wickets-by-type', 'economy-rate']) expect(screen.queryByTestId(`dashboard-card-${id}`)).not.toBeInTheDocument()
      expect(within(screen.getByTestId('dashboard-group-bowling')).queryByRole('img')).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'How out' })).not.toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Extras conceded' })).not.toBeInTheDocument()
    })

    it('expanding Bowling draws its three cards in order and sets aria-expanded; collapsing removes them again', async () => {
      renderPage(BASE)
      await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)
      const toggle = screen.getByTestId('dashboard-group-bowling-toggle')
      await userEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(toggle).toHaveTextContent('Hide bowling')
      await screen.findByTestId('dashboard-card-economy-rate', {}, wait)
      expect(cardTitles()).toEqual(['Batting', 'Runs per innings', 'How you were dismissed', 'Batting trend', 'Bowling', 'Wickets per match', 'Wickets by type', 'Economy rate'])
      for (const id of ['wickets-per-match', 'wickets-by-type', 'economy-rate']) expect(screen.getByTestId(`${id}-subtitle`)).toHaveTextContent('Bowling')
      expect(screen.getByTestId('dashboard-card-wickets-per-match')).toHaveAttribute('data-width', 'full')
      expect(screen.getByTestId('dashboard-card-wickets-by-type')).toHaveAttribute('data-width', 'half')
      // expanding asks for nothing more: the one read already holds the bowling series
      expect(server.dashboardCalls).toHaveLength(1)

      await userEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByTestId('dashboard-card-economy-rate')).not.toBeInTheDocument()
      expect(screen.getByTestId('dashboard-card-runs-per-innings')).toBeInTheDocument()
    })

    it('the Batting group collapses and expands too', async () => {
      renderPage(BASE)
      await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)
      await userEvent.click(screen.getByTestId('dashboard-group-batting-toggle'))
      expect(screen.getByTestId('dashboard-group-batting-toggle')).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByTestId('dashboard-card-runs-per-innings')).not.toBeInTheDocument()
      expect(screen.getByTestId('tile-runs')).toBeInTheDocument()
    })

    it('shows the closing note that ball-by-ball charts are not available', async () => {
      renderPage(BASE)
      expect(await screen.findByText(/Ball-by-ball and partnership charts are not available/, {}, wait)).toBeInTheDocument()
    })
  })

  describe('the table alternative reads the same figures as the tiles', () => {
    it('Runs per innings\' Total equals the Runs tile, and Wickets by type\'s Total the Wickets tile', async () => {
      renderPage(`${BASE}`)
      await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)
      await userEvent.click(screen.getByTestId('runs-per-innings-view-table'))
      const runsTotal = within(screen.getByTestId('runs-per-innings-total')).getAllByRole('cell')[2].textContent
      expect(runsTotal).toBe(screen.getByTestId('tile-runs-value').textContent)

      await userEvent.click(screen.getByTestId('dashboard-group-bowling-toggle'))
      await userEvent.click(await screen.findByTestId('wickets-by-type-view-table', {}, wait))
      expect(rows('wickets-by-type')).toHaveLength(3)
      // the page fixture's stats carry 21 wickets and its dashboard 5: each is shown as the server sent it
      expect(within(screen.getByTestId('wickets-by-type-total')).getAllByRole('cell')[1].textContent).toBe('5')
    })
  })

  describe('the request', () => {
    it('is one read, with no filter params when none is set, in parallel with the stats read', async () => {
      renderPage(BASE)
      await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)
      expect(server.dashboardCalls).toEqual([{}])
      expect(server.statsCalls).toEqual([{}])
    })

    it('carries exactly the filters the tiles\' read carries', async () => {
      renderPage(`${BASE}?seasonId=season-1&leagueId=league-1&teamId=team-1&sectionId=u15a&competition=LEAGUE`)
      await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)
      const filters = { seasonId: 'season-1', leagueId: 'league-1', teamId: 'team-1', sectionId: 'u15a', competition: 'LEAGUE' }
      expect(server.dashboardCalls).toEqual([filters])
      expect(server.statsCalls).toEqual([filters])
    })

    it('a filter change refetches both the stats read and the overview read with the new Season', async () => {
      renderPage(BASE)
      await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)
      await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
      await userEvent.click(await screen.findByRole('option', { name: '2026/27' }))
      await waitFor(() => expect(server.dashboardCalls).toEqual([{}, { seasonId: 'season-1' }]), wait)
      expect(server.statsCalls).toEqual([{}, { seasonId: 'season-1' }])
    })

    it('keeps the previous charts on screen while the new filter loads', async () => {
      renderPage(BASE)
      await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)
      let release: (value: unknown) => void = () => undefined
      apiGet.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
        url.endsWith('/stats/dashboard') ? new Promise((resolve) => (release = resolve)) : route(url, config),
      )
      await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
      await userEvent.click(await screen.findByRole('option', { name: '2026/27' }))
      await waitFor(() => expect(screen.getByTestId('dashboard-card-runs-per-innings')).toHaveStyle({ opacity: '0.6' }), wait)
      expect(screen.getByTestId('runs-per-innings-chart')).toBeInTheDocument()
      release({ data: makePlayerDashboard() })
      await waitFor(() => expect(screen.getByTestId('dashboard-card-runs-per-innings')).toHaveStyle({ opacity: '1' }), wait)
    })
  })

  describe('failure and empty states', () => {
    it('a failed overview read is one error card with Try again; the tiles stay, and Try again loads the charts', async () => {
      let fail = true
      server.dashboard = () => (fail ? new Error('boom') : makePlayerDashboard())
      renderPage(BASE)
      const alert = await screen.findByRole('alert', {}, wait)
      expect(alert).toHaveTextContent("Couldn't load the overview")
      expect(screen.getByTestId('tile-runs-value')).toHaveTextContent('412')
      expect(screen.queryByTestId('dashboard-group-batting')).not.toBeInTheDocument()
      fail = false
      await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
      expect(await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows a skeleton per card while the read is outstanding, and the tiles do not wait', async () => {
      apiGet.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) => (url.endsWith('/stats/dashboard') ? new Promise(() => undefined) : route(url, config)))
      renderPage(BASE)
      expect(await screen.findByTestId('tile-runs-value', {}, wait)).toHaveTextContent('412')
      const loading = await screen.findByTestId('dashboard-group-batting', {}, wait)
      expect(within(loading).getByTestId('dashboard-loading')).toHaveAttribute('aria-busy', 'true')
      expect(within(loading).getAllByTestId(/-loading$/).length).toBeGreaterThanOrEqual(3)
    })

    it('a player with nothing counted gets the page\'s own empty state and no charts', async () => {
      server.stats = () => makeStats({ matchesCounted: 0, resultsWithBattingCard: 0, resultsWithBowlingCard: 0 })
      server.dashboard = () => emptyPlayerDashboard()
      renderPage(BASE)
      expect(await screen.findByText('No published results yet', {}, wait)).toBeInTheDocument()
      expect(screen.queryByTestId('dashboard-tab')).not.toBeInTheDocument()
    })

    it('a card without data shows its own message while the others still render', async () => {
      server.dashboard = () => makePlayerDashboard({ battingInnings: [], battingTrend: [], dismissals: [], battingSummary: { inningsTotal: 0, shown: 0, notOuts: 0, runs: 0, averageRuns: null } })
      renderPage(BASE)
      expect(await screen.findByTestId('runs-per-innings-empty', {}, wait)).toBeInTheDocument()
      expect(screen.getByTestId('dismissals-empty')).toBeInTheDocument()
      expect(screen.getByTestId('tile-runs')).toBeInTheDocument()
      await userEvent.click(screen.getByTestId('dashboard-group-bowling-toggle'))
      expect(await screen.findByTestId('wickets-per-match-chart', {}, wait)).toBeInTheDocument()
    })
  })

  describe('the way back from a result', () => {
    it('links a table date to the result page', async () => {
      renderPage(BASE)
      await screen.findByTestId('dashboard-card-runs-per-innings', {}, wait)
      await userEvent.click(screen.getByTestId('runs-per-innings-view-table'))
      expect(screen.getByRole('link', { name: '1 Mar 2026' })).toHaveAttribute('href', '/manage/results/match-1')
    })
  })
})
