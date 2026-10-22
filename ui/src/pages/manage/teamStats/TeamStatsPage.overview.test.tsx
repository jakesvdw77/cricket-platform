import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamStatsPage from './TeamStatsPage'
import { defaultTeamStatsServer, makeTeamStats, teamStatsApi } from '../../../test/teamStatsFixtures'
import type { TeamStatsServer } from '../../../test/teamStatsFixtures'
import { makeTeamDashboard } from '../../../test/dashboardFixtures'
import type { TeamDashboard } from '../../../api/teamDashboardApi'

// docs/specs/117-stats-dashboard.md (Test Plan, "Frontend component", Team page): the Overview block through the real hooks and query
// keys over a routed axios mock, so what the page asks for (and when) is observable. The server's figures are shown as sent.
let server: TeamStatsServer
let dashboardCalls: Record<string, unknown>[]
let dashboard: () => TeamDashboard | Error
const apiGet = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }))
vi.mock('../../../api/seasonApi', () => ({
  listSeasons: () =>
    Promise.resolve([
      { id: 'season-1', clubId: 'club-1', label: '2026/27', startDate: '2026-09-01', endDate: '2027-04-30', active: true, createdAt: '2026-01-01', updatedAt: '', updatedBy: null },
      { id: 'season-2', clubId: 'club-1', label: '2025/26', startDate: '2025-09-01', endDate: '2026-04-30', active: true, createdAt: '2025-01-01', updatedAt: '', updatedBy: null },
    ]),
}))
vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([{ id: 'league-1', name: 'Premier League' }]) }))
vi.mock('../../../api/sectionApi', () => ({ listSections: () => Promise.resolve([{ id: 'club', clubId: 'club-1', parentSectionId: null, name: 'Club', minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null }]) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: 'Villagers 1' }]) }))

// A link fixes the Season, so the page does not wait for the options to choose a default.
const BASE = '/manage/teams/team-1/stats?seasonId=season-1'
const wait = { timeout: 5000 }

function renderPage(path = BASE) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="teams/:teamId/stats" element={<TeamStatsPage />} />
            <Route path="results/:matchId" element={<div data-testid="result-page" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent)
const before = (first: HTMLElement, second: HTMLElement) => Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)

describe('Team Overview block', () => {
  beforeEach(() => {
    localStorage.clear()
    server = defaultTeamStatsServer()
    dashboardCalls = []
    dashboard = () => makeTeamDashboard()
    apiGet.mockReset()
    apiGet.mockImplementation((url: string, config?: { params?: Record<string, unknown> }) =>
      teamStatsApi(server, async (other) => {
        if (other.endsWith('/stats/dashboard')) {
          dashboardCalls.push(config?.params ?? {})
          const value = dashboard()
          if (value instanceof Error) throw value
          return { data: value }
        }
        throw new Error(`unrouted GET ${other}`)
      }).get(url, config as never),
    )
  })

  it('sits after the tiles and the form strip and before the Record card, expanded by default', async () => {
    renderPage()
    const block = await screen.findByTestId('team-dashboard', {}, wait)
    expect(before(screen.getByTestId('tile-played'), screen.getByTestId('team-form-strip'))).toBe(true)
    expect(before(screen.getByTestId('team-form-strip'), block)).toBe(true)
    expect(before(block, screen.getByTestId('not-captured-panel'))).toBe(true)
    expect(within(block).getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
    const toggle = screen.getByTestId('team-dashboard-toggle')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveTextContent('Hide overview')
    expect(toggle).toHaveStyle({ minHeight: '32px' })
    expect(toggle.getAttribute('aria-controls')).toBeTruthy()
    // the existing cards after it are unchanged
    expect(screen.getByTestId('tile-played-value')).toHaveTextContent('14')
  })

  it('draws the five cards in order, Run rate trend full width, and no form timeline of its own', async () => {
    renderPage()
    await screen.findByTestId('dashboard-card-results', {}, wait)
    const block = screen.getByTestId('team-dashboard')
    const cards = Array.from(block.querySelectorAll('[data-testid^="dashboard-card-"]')).map((card) => card.getAttribute('data-testid'))
    expect(cards).toEqual(['dashboard-card-results', 'dashboard-card-runs-scored', 'dashboard-card-run-rate-trend', 'dashboard-card-extras-conceded', 'dashboard-card-dot-balls'])
    expect(screen.getByTestId('dashboard-card-run-rate-trend')).toHaveAttribute('data-width', 'full')
    // exactly one form strip on the page: the page's own
    expect(screen.getAllByTestId('team-form-strip')).toHaveLength(1)
    expect(within(block).queryByTestId('team-form-strip')).not.toBeInTheDocument()
  })

  it('asks for the overview once, with the same filters as the figures', async () => {
    renderPage()
    await screen.findByTestId('dashboard-card-results', {}, wait)
    expect(dashboardCalls).toHaveLength(1)
    expect(server.pageCalls).toHaveLength(1)
    expect(dashboardCalls[0]).toEqual({ seasonId: 'season-1' })
    expect(dashboardCalls[0]).toEqual(server.pageCalls[0].params)
  })

  it('carries a linked League and Competition too', async () => {
    renderPage('/manage/teams/team-1/stats?seasonId=season-1&leagueId=league-1&competition=LEAGUE')
    await screen.findByTestId('dashboard-card-results', {}, wait)
    expect(dashboardCalls).toEqual([{ seasonId: 'season-1', leagueId: 'league-1', competition: 'LEAGUE' }])
    expect(server.pageCalls[0].params).toEqual(dashboardCalls[0])
  })

  it('a filter change refetches the overview as well as the figures', async () => {
    renderPage()
    await screen.findByTestId('dashboard-card-results', {}, wait)
    await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
    await userEvent.click(await screen.findByRole('option', { name: '2025/26' }))
    await waitFor(() => expect(dashboardCalls).toEqual([{ seasonId: 'season-1' }, { seasonId: 'season-2' }]), wait)
    expect(server.pageCalls.map((call) => call.params)).toEqual([{ seasonId: 'season-1' }, { seasonId: 'season-2' }])
  })

  describe('Hide and Show', () => {
    it('Hide removes the cards and sets aria-expanded false; Show brings them back', async () => {
      renderPage()
      await screen.findByTestId('dashboard-card-results', {}, wait)
      const toggle = screen.getByTestId('team-dashboard-toggle')
      await userEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(toggle).toHaveTextContent('Show overview')
      expect(screen.queryByTestId('dashboard-card-results')).not.toBeInTheDocument()
      // the header stays; the tiles, form strip and the cards below are untouched
      expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument()
      expect(screen.getByTestId('tile-played')).toBeInTheDocument()
      expect(screen.getByTestId('team-form-strip')).toBeInTheDocument()
      await userEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(await screen.findByTestId('dashboard-card-results', {}, wait)).toBeInTheDocument()
    })

    it('makes no request for the overview while hidden, and asks again with the current filters when shown', async () => {
      renderPage()
      await screen.findByTestId('dashboard-card-results', {}, wait)
      await userEvent.click(screen.getByTestId('team-dashboard-toggle'))
      expect(screen.queryByTestId('dashboard-card-results')).not.toBeInTheDocument()
      const calls = dashboardCalls.length
      // a filter change while hidden refetches the figures but not the overview
      await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
      await userEvent.click(await screen.findByRole('option', { name: '2025/26' }))
      await waitFor(() => expect(server.pageCalls).toHaveLength(2), wait)
      expect(dashboardCalls).toHaveLength(calls)
      await userEvent.click(screen.getByTestId('team-dashboard-toggle'))
      await waitFor(() => expect(dashboardCalls.at(-1)).toEqual({ seasonId: 'season-2' }), wait)
      expect(await screen.findByTestId('dashboard-card-results', {}, wait)).toBeInTheDocument()
    })
  })

  describe('results, tiles and percentages', () => {
    it('shows the results legend and table Share column with the server\'s percentages and the tile counts as the donut\'s counts', async () => {
      renderPage()
      await screen.findByTestId('dashboard-card-results', {}, wait)
      const legend = within(screen.getByTestId('donut-legend')).getAllByRole('listitem').map((item) => item.textContent)
      expect(legend[0]).toBe('Won9 · 64.3%')
      await userEvent.click(screen.getByTestId('results-view-table'))
      expect(within(screen.getByTestId('results-total')).getAllByRole('cell')[1]).toHaveTextContent(screen.getByTestId('tile-played-value').textContent ?? '')
      expect(cells(screen.getAllByTestId('results-row')[0])).toEqual(['Won', '9', '64.3%'])
      expect(screen.getByTestId('tile-won-value')).toHaveTextContent('9')
    })

    it('shows net run rate as a third line only when SHOWN, otherwise the reason', async () => {
      renderPage()
      await screen.findByTestId('dashboard-card-run-rate-trend', {}, wait)
      expect(within(screen.getByRole('list', { name: 'Run rate trend' })).getAllByRole('listitem')).toHaveLength(3)
      expect(screen.queryByTestId('run-rate-trend-coverage')).not.toBeInTheDocument()
    })

    it('shows the reason instead when net run rate is not shown', async () => {
      dashboard = () => makeTeamDashboard({ netRunRateTrend: { status: 'NOT_ONE_COMPETITION', points: null } })
      renderPage()
      expect(await screen.findByTestId('run-rate-trend-coverage', {}, wait)).toHaveTextContent('Net run rate is not shown across more than one league or season')
      expect(within(screen.getByRole('list', { name: 'Run rate trend' })).getAllByRole('listitem')).toHaveLength(2)
    })
  })

  describe('failure, loading and empty', () => {
    it('a failed read is one error card with Try again, the rest of the page still works, and Try again loads the charts', async () => {
      let fail = true
      dashboard = () => (fail ? new Error('boom') : makeTeamDashboard())
      renderPage()
      const alert = await screen.findByRole('alert', {}, wait)
      expect(alert).toHaveTextContent("Couldn't load the overview")
      expect(screen.getByTestId('tile-played-value')).toHaveTextContent('14')
      expect(screen.getByTestId('team-form-strip')).toBeInTheDocument()
      expect(screen.getByTestId('not-captured-panel')).toBeInTheDocument()
      fail = false
      await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
      expect(await screen.findByTestId('dashboard-card-results', {}, wait)).toBeInTheDocument()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows five skeleton cards while the read is outstanding', async () => {
      const original = apiGet.getMockImplementation()!
      apiGet.mockImplementation((url: string, config?: unknown) => (url.endsWith('/stats/dashboard') ? new Promise(() => undefined) : original(url, config)))
      renderPage()
      const loading = await screen.findByTestId('dashboard-loading', {}, wait)
      expect(loading).toHaveAttribute('aria-busy', 'true')
      expect(within(loading).getAllByTestId(/-loading$/)).toHaveLength(5)
      expect(screen.getByTestId('tile-played-value')).toHaveTextContent('14')
    })

    it('a team with nothing counted shows the page\'s own empty state and no block', async () => {
      server.page = () => makeTeamStats({ basis: { resultsCounted: 0, internalResults: 0, resultsNoBallBowled: 0, forfeits: { received: 0, conceded: 0 }, resultsWithBothInnings: 0 } })
      renderPage()
      expect(await screen.findByText('No published results match these filters', {}, wait)).toBeInTheDocument()
      expect(screen.queryByTestId('team-dashboard')).not.toBeInTheDocument()
    })

    it('a card without data shows its own line while the others render', async () => {
      const base = makeTeamDashboard()
      dashboard = () => makeTeamDashboard({ dotBallsSummary: { ...base.dotBallsSummary, matchesWithDots: 0 }, extrasSummary: { ...base.extrasSummary, matchesWithExtras: 0 } })
      renderPage()
      expect(await screen.findByTestId('dot-balls-empty', {}, wait)).toHaveTextContent('No dot balls have been recorded for these matches.')
      expect(screen.getByTestId('extras-conceded-empty')).toHaveTextContent('No extras have been recorded for these matches.')
      expect(screen.getByTestId('dashboard-card-results')).toBeInTheDocument()
      expect(screen.getByTestId('dashboard-card-runs-scored')).toBeInTheDocument()
    })
  })
})
