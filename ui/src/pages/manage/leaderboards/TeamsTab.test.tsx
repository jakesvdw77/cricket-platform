import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeaderboardsPage from './LeaderboardsPage'
import { defaultServer as defaultLeaderboardServer, leaderboardApi } from '../../../test/leaderboardFixtures'
import {
  TEAM_COLUMNS,
  defaultTeamStatsServer,
  highTotal,
  makeTeamBasis,
  makeTeamRow,
  makeTeamTable,
  nrrHidden,
  nrrShown,
  num,
  teamStatsApi,
} from '../../../test/teamStatsFixtures'
import type { TeamStatsServer } from '../../../test/teamStatsFixtures'

// docs/specs/116-team-stats.md ("The Teams tab on the Leaderboards page", Test Plan "Frontend component"): the Teams tab through
// the real hooks, query keys and paging over a routed axios mock, so the parameters the server would receive are what is asserted.
// The player tabs keep their own suite (LeaderboardsPage.test.tsx), which must still pass unchanged.
let server: TeamStatsServer
const apiGet = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args), put: vi.fn() },
}))
vi.mock('../../../api/clubApi', () => ({ getManagedClubProfile: () => Promise.resolve({ name: 'Irene Villagers' }) }))
vi.mock('../../../api/seasonApi', () => ({
  listSeasons: () =>
    Promise.resolve([
      { id: 'season-1', clubId: 'club-1', label: '2026/27', startDate: '2026-09-01', endDate: '2027-04-30', active: true, createdAt: '2026-01-01', updatedAt: '', updatedBy: null },
      { id: 'season-2', clubId: 'club-1', label: '2025/26', startDate: '2025-09-01', endDate: '2026-04-30', active: true, createdAt: '2025-01-01', updatedAt: '', updatedBy: null },
    ]),
}))
vi.mock('../../../api/leagueApi', () => ({
  listLeagues: () => Promise.resolve([{ id: 'league-1', name: 'Premier League' }, { id: 'league-2', name: 'Second League' }]),
}))
const section = (id: string, name: string, parentSectionId: string | null = null) => ({
  id, clubId: 'club-1', parentSectionId, name, minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null,
})
vi.mock('../../../api/sectionApi', () => ({
  listSections: () => Promise.resolve([section('club', 'Club'), section('seniors', 'Seniors', 'club'), section('juniors', 'Juniors', 'club'), section('u15', 'U15', 'juniors'), section('u15a', 'U15A', 'u15')]),
}))
vi.mock('../../../api/teamApi', () => ({
  listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: 'Villagers 1' }, { id: 'team-2', name: 'Villagers 2' }]),
}))

function LocationProbe() {
  return <div data-testid="location">{useLocation().search}</div>
}
// The team page stand-in: shows where the row link went and the router state it carried.
function TeamPageProbe() {
  const location = useLocation()
  return (
    <div>
      <div data-testid="team-path">{location.pathname}</div>
      <div data-testid="team-search">{location.search}</div>
      <div data-testid="team-state">{JSON.stringify(location.state)}</div>
    </div>
  )
}

function renderPage(path = '/manage/leaderboards?tab=teams') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="leaderboards" element={<LeaderboardsPage />} />
            <Route path="teams/:teamId/stats" element={<TeamPageProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const wait = { timeout: 5000 }
const search = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '')
const lastTable = () => server.tableCalls[server.tableCalls.length - 1]
const rows = () => screen.getAllByTestId('standings-row')
const rankCells = () => rows().map((row) => row.getAttribute('data-rank'))
const names = () => rows().map((row) => within(row).getByRole('rowheader').querySelector('a')?.textContent)
const heading = (name: string | RegExp) => screen.getByRole('button', { name })
const footer = () => screen.getByTestId('board-footer')
const table = (over: Parameters<typeof makeTeamTable>[0] = {}) => (params: Record<string, unknown>) => {
  const base = defaultTeamStatsServer().table(params)
  return base instanceof Error ? base : { ...base, ...over }
}
async function chooseOption(label: string, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name: label }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('Teams tab', () => {
  beforeEach(() => {
    localStorage.clear()
    server = defaultTeamStatsServer()
    apiGet.mockReset()
    const leaderboards = defaultLeaderboardServer()
    apiGet.mockImplementation((url: string, config?: unknown) =>
      teamStatsApi(server, (u, c) => leaderboardApi(leaderboards).get(u, c as never)).get(url, config as never),
    )
  })

  describe('the tab', () => {
    it('is the fifth tab, bound to ?tab=teams, and loads the team table rather than a player board', async () => {
      renderPage()
      expect(await screen.findByRole('tab', { name: 'Teams' }, wait)).toHaveAttribute('aria-selected', 'true')
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Batting', 'Bowling', 'Fielding', 'Awards', 'Teams'])
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(2)
      expect(apiGet.mock.calls.some(([url]) => /\/leaderboards\/(batting|bowling|fielding)$/.test(url as string))).toBe(false)
      expect(screen.getByRole('table', { name: 'Teams statistics' })).toBeInTheDocument()
    })

    it('clicking Teams writes ?tab=teams and drops a player sort; leaving Teams drops the team sort', async () => {
      renderPage('/manage/leaderboards?sort=average')
      await userEvent.click(await screen.findByRole('tab', { name: 'Teams' }, wait))
      expect(search().get('tab')).toBe('teams')
      expect(search().has('sort')).toBe(false)
      await waitFor(() => expect(lastTable()).toMatchObject({ sort: 'won' }), wait)

      await userEvent.click(await screen.findByRole('button', { name: 'Sort by Matches played' }, wait))
      await waitFor(() => expect(search().has('sort')).toBe(true))
      await userEvent.click(screen.getByRole('tab', { name: 'Batting' }))
      expect(search().get('tab')).toBe('batting')
      expect(search().has('sort')).toBe(false)
    })

    it('an unknown ?tab= is still Batting and asks for no team data', async () => {
      renderPage('/manage/leaderboards?tab=zzz')
      expect(await screen.findByRole('tab', { name: 'Batting' }, wait)).toHaveAttribute('aria-selected', 'true')
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(server.tableCalls).toHaveLength(0)
    })

    it('hides the Team select and shows Competition, offering only competitions that have counted results', async () => {
      server.options = { ...server.options as object, competitions: ['LEAGUE'] } as never
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.queryByRole('combobox', { name: 'Team' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('combobox', { name: 'Competition' }))
      expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['All competitions', 'League'])
    })

    it('has no Competition select when no competition has counted results, and Batting still has the Team select', async () => {
      server.options = { seasonIds: ['season-1'], leagueIds: [], sectionIds: [], competitions: [] }
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.queryByRole('combobox', { name: 'Competition' })).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('tab', { name: 'Batting' }))
      expect(await screen.findByRole('combobox', { name: 'Team' }, wait)).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Competition' })).not.toBeInTheDocument()
    })
  })

  describe('filters', () => {
    it('sends the current season by default, with the first page and the Wins sort, and no direction or minimum', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(lastTable()).toMatchObject({ seasonId: 'season-1', sort: 'won', page: 0, size: 25 })
      for (const key of ['direction', 'minimum', 'leagueId', 'sectionId', 'competition', 'teamId']) expect(lastTable()).not.toHaveProperty(key)
    })

    it('sends the saved Season, League and Section and a chosen Competition as parameters (never a team)', async () => {
      localStorage.setItem('leaderboards:filters:club-1', JSON.stringify({ seasonId: 'season-2', leagueId: 'league-1', sectionId: 'u15a', teamId: 'team-1' }))
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(lastTable()).toMatchObject({ seasonId: 'season-2', leagueId: 'league-1', sectionId: 'u15a', sort: 'won' })
      expect(lastTable()).not.toHaveProperty('teamId')

      await chooseOption('Competition', 'League')
      await waitFor(() => expect(lastTable().competition).toBe('LEAGUE'), wait)
      await chooseOption('Season', 'All seasons')
      await waitFor(() => expect(lastTable()).not.toHaveProperty('seasonId'), wait)
      expect(lastTable().competition).toBe('LEAGUE')
    })

    it('offers only the filter values the Teams options read lists', async () => {
      server.options = { seasonIds: ['season-2'], leagueIds: ['league-2'], sectionIds: [], competitions: ['FRIENDLY'] }
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
      expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['All seasons', '2025/26'])
    })
  })

  describe('the table', () => {
    it('is an accessible table: named, with column headers, a row header per team and one busy flag on the body', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      const grid = screen.getByRole('table', { name: 'Teams statistics' })
      expect(grid).toHaveAttribute('aria-colcount', '17')
      const tableRows = within(grid).getAllByRole('row')
      expect(tableRows).toHaveLength(3)
      expect(within(tableRows[0]).getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
        '#', 'Team', 'P', 'W', 'L', 'T', 'D', 'NR', 'Win %', 'Runs', 'Avg', 'RR', 'High', 'Wkts', 'Bowl avg', 'Econ', 'NRR',
      ])
      expect(within(tableRows[1]).getByRole('rowheader')).toHaveTextContent('Villagers t1')
      expect(within(grid).getByRole('rowgroup')).toHaveAttribute('aria-busy', 'false')
    })

    it('marks the body busy while a new sort loads, keeping the previous rows on screen', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      let release: () => void = () => undefined
      const hold = new Promise<void>((resolve) => { release = resolve })
      const inner = apiGet.getMockImplementation() as (url: string, config?: unknown) => Promise<unknown>
      apiGet.mockImplementation(async (url: string, config?: unknown) => {
        if (url.endsWith('/team-stats')) await hold
        return inner(url, config)
      })
      await userEvent.click(heading('Sort by Losses'))
      await waitFor(() => expect(screen.getByRole('table', { name: 'Teams statistics' }).querySelector('[role="rowgroup"]')).toHaveAttribute('aria-busy', 'true'))
      expect(rows()).toHaveLength(2)
      release()
      await waitFor(() => expect(screen.getByRole('table', { name: 'Teams statistics' }).querySelector('[role="rowgroup"]')).toHaveAttribute('aria-busy', 'false'))
    })

    it('lists the rows in the order received, whatever their names', async () => {
      server.table = table({ rows: [makeTeamRow({ id: 'z', teamName: 'Zebras', rank: 1 }), makeTeamRow({ id: 'a', teamName: 'Aardvarks', rank: 2 })] })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(names()).toEqual(['Zebras', 'Aardvarks'])
    })

    it('shows the section as a sub-line and an Inactive chip only for an inactive team', async () => {
      server.table = table({ rows: [makeTeamRow({ id: 'a', rank: 1, sectionName: 'U15A' }), makeTeamRow({ id: 'b', rank: 2, sectionName: null, active: false })] })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(within(rows()[0]).getByText('U15A')).toBeInTheDocument()
      expect(within(rows()[0]).queryByText('Inactive')).not.toBeInTheDocument()
      expect(within(rows()[1]).getByText('Inactive')).toBeInTheDocument()
    })

    it('formats counts with separators, rates to 2 dp, win percentage to 1 dp and the highest total as runs/wickets', async () => {
      renderPage()
      const first = (await screen.findAllByTestId('standings-row', {}, wait))[0]
      expect(within(first).getByTestId('cell-runs')).toHaveTextContent('1,842')
      expect(within(first).getByTestId('cell-battingAverage')).toHaveTextContent('24.56')
      expect(within(first).getByTestId('cell-winPercent')).toHaveTextContent('77.8')
      expect(within(first).getByTestId('cell-highTotal')).toHaveTextContent('212/6')
      expect(within(first).getByTestId('cell-netRunRate')).toHaveTextContent('+0.84')
    })

    it('highlights the sorted column and reports it with aria-sort on its heading only', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      const sorted = screen.getByRole('button', { name: /^Wins, sorted descending/ })
      expect(sorted).toHaveAttribute('data-sorted', 'true')
      expect(sorted.closest('[role="columnheader"]')).toHaveAttribute('aria-sort', 'descending')
      const headers = within(screen.getByTestId('standings-header-row')).getAllByRole('columnheader')
      expect(headers.filter((h) => h.hasAttribute('aria-sort'))).toHaveLength(1)
      const first = rows()[0]
      const tint = (code: string) => getComputedStyle(within(first).getByTestId(`cell-${code}`)).backgroundColor
      expect(tint('won')).not.toBe(tint('lost'))
      expect(tint('lost')).toBe(tint('tied'))
      expect(within(first).getByTestId('cell-won')).toHaveStyle({ fontWeight: '700' })
      expect(within(first).getByTestId('cell-lost')).not.toHaveStyle({ fontWeight: '700' })
    })

    it('Sort by lists the long labels of the sortable columns and sorts by the choice', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      const select = screen.getByRole('combobox', { name: 'Sort by' })
      expect(select).toHaveTextContent('Wins')
      await userEvent.click(select)
      expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(TEAM_COLUMNS.map((c) => c.longLabel))
      await userEvent.click(screen.getByRole('option', { name: 'Team economy rate' }))
      expect(search().get('sort')).toBe('economy')
      await waitFor(() => expect(lastTable().sort).toBe('economy'))
    })

    it('a second tap on the sorted heading reverses it: direction sent, ?dir= written, arrow and aria-sort follow the server', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await userEvent.click(heading(/^Wins, sorted descending/))
      expect(search().get('dir')).toBe('asc')
      await waitFor(() => expect(lastTable()).toMatchObject({ sort: 'won', direction: 'asc' }), wait)
      const reversed = await screen.findByRole('button', { name: /^Wins, sorted ascending/ })
      expect(reversed.closest('[role="columnheader"]')).toHaveAttribute('aria-sort', 'ascending')

      await userEvent.click(reversed)
      await waitFor(() => expect(search().has('dir')).toBe(false))
      await waitFor(() => expect(lastTable()).not.toHaveProperty('direction'))
    })

    it('a column whose natural order is lowest-first reverses to desc, and Reverse order does the same as the heading', async () => {
      renderPage('/manage/leaderboards?tab=teams&sort=lost')
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(lastTable()).not.toHaveProperty('direction')
      await userEvent.click(screen.getByRole('button', { name: 'Reverse order' }))
      expect(search().get('dir')).toBe('desc')
      await waitFor(() => expect(lastTable()).toMatchObject({ sort: 'lost', direction: 'desc' }), wait)
    })

    it('choosing another heading starts again from its natural direction', async () => {
      renderPage('/manage/leaderboards?tab=teams&sort=won&dir=asc')
      await waitFor(() => expect(lastTable()).toMatchObject({ sort: 'won', direction: 'asc' }), wait)
      await userEvent.click(await screen.findByRole('button', { name: 'Sort by Team economy rate' }, wait))
      expect(search().has('dir')).toBe(false)
      await waitFor(() => expect(lastTable().sort).toBe('economy'))
      expect(lastTable()).not.toHaveProperty('direction')
    })

    it('a player sort carried in the address (not a team column) falls back to Wins', async () => {
      renderPage('/manage/leaderboards?tab=teams&sort=average&dir=asc')
      await waitFor(() => expect(search().has('sort')).toBe(false), wait)
      expect(search().has('dir')).toBe(false)
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(2)
      expect(lastTable()).toMatchObject({ sort: 'won' })
      expect(lastTable()).not.toHaveProperty('direction')
      expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Wins')
    })

    it('a sort the server answers 400 for clears ?sort= and ?dir= and loads the default', async () => {
      renderPage('/manage/leaderboards?tab=teams&sort=zzz&dir=desc')
      await waitFor(() => expect(search().has('sort')).toBe(false), wait)
      expect(search().has('dir')).toBe(false)
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(2)
      expect(server.tableCalls.map((c) => c.sort)).toEqual(['zzz', 'won'])
    })

    it('does not treat a failure that is not a bad request as a bad sort', async () => {
      server.table = () => new Error('boom')
      renderPage('/manage/leaderboards?tab=teams&sort=runs')
      expect(await screen.findByText("Couldn't load team statistics", {}, wait)).toBeInTheDocument()
      expect(search().get('sort')).toBe('runs')
    })

    it('renders equal ranks as equal numbers (1, 2, 2, 4)', async () => {
      server.table = table({ rows: ['a', 'b', 'c', 'd'].map((id, i) => makeTeamRow({ id, rank: [1, 2, 2, 4][i] })) })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(rankCells()).toEqual(['1', '2', '2', '4'])
      expect(rows().map((row) => row.firstElementChild?.textContent)).toEqual(['1', '2', '2', '4'])
    })

    it('lists the unranked group last, under a divider naming why, with a dash for the rank and the figure', async () => {
      server.table = table({
        sort: { code: 'winPercent', direction: 'HIGHEST' },
        rows: [makeTeamRow({ id: 'a', rank: 1 }), makeTeamRow({ id: 'b', rank: 2 }), makeTeamRow({ id: 'c', rank: null, values: { winPercent: num(null) } })],
      })
      renderPage('/manage/leaderboards?tab=teams&sort=winPercent')
      await screen.findAllByTestId('standings-row', {}, wait)
      const divider = screen.getByTestId('unranked-divider')
      expect(divider).toHaveTextContent('Not ranked: no decisive result yet')
      const last = rows()[2]
      expect(last.getAttribute('data-rank')).toBe('none')
      expect(last.firstElementChild).toHaveTextContent('–')
      expect(within(last).getByTestId('cell-winPercent')).toHaveTextContent('–')
      expect(rows()[1].compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(divider.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('draws no divider when everyone is ranked', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.queryByTestId('unranked-divider')).not.toBeInTheDocument()
    })
  })

  describe('net run rate', () => {
    it('shows the signed value to 2 decimals, a minus for a negative one and no sign for zero', async () => {
      server.table = table({
        rows: [
          makeTeamRow({ id: 'a', rank: 1, values: { netRunRate: nrrShown(0.84) } }),
          makeTeamRow({ id: 'b', rank: 2, values: { netRunRate: nrrShown(-1.1234) } }),
          makeTeamRow({ id: 'c', rank: 3, values: { netRunRate: nrrShown(0) } }),
        ],
      })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(rows().map((row) => within(row).getByTestId('cell-netRunRate').textContent)).toEqual(['+0.84', '-1.12', '0.00'])
    })

    it('shows a dash with the reason for a team outside one league and season, and for one with no usable result', async () => {
      server.table = table({
        rows: [
          makeTeamRow({ id: 'a', rank: 1, values: { netRunRate: nrrHidden('NOT_ONE_COMPETITION') } }),
          makeTeamRow({ id: 'b', rank: 2, values: { netRunRate: nrrHidden('NO_USABLE_RESULTS') } }),
          makeTeamRow({ id: 'c', rank: 3, values: { netRunRate: nrrShown(0.5) } }),
        ],
      })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      const [one, none, shown] = rows().map((row) => within(row).getByTestId('cell-netRunRate'))
      expect(one).toHaveTextContent('–')
      expect(one).toHaveAttribute('aria-label', 'Net run rate is not shown across more than one league or season')
      expect(none).toHaveTextContent('–')
      expect(none).toHaveAttribute('aria-label', 'Net run rate needs won or tied results with both innings recorded')
      expect(shown).toHaveTextContent('+0.50')
      expect(shown).not.toHaveAttribute('aria-label')
    })

    it('puts the column help in the heading and never prints the rule name "Full-quota"', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      const nrr = screen.getByRole('button', { name: /^Sort by Net run rate\. Shown for one league in one season/ })
      expect(nrr).toHaveAttribute('title', expect.stringContaining('Shown for one league in one season'))
      expect(document.body.innerHTML).not.toMatch(/full[- ]quota/i)
    })
  })

  describe('the minimum', () => {
    const rate = (belowMinimum = 0, rowsFor: (minimum: unknown) => ReturnType<typeof makeTeamRow>[] = () => [makeTeamRow({ id: 'a', rank: 1 })]) =>
      (params: Record<string, unknown>) => {
        const base = defaultTeamStatsServer().table(params)
        if (base instanceof Error) return base
        const rowList = rowsFor(params.minimum)
        return { ...base, rows: rowList, basis: makeTeamBasis({ belowMinimum, teamsListed: rowList.length, teamsRanked: rowList.length }), page: { ...base.page, totalElements: rowList.length } }
      }

    it('is not offered on a count sort, and nothing is sent', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.queryByRole('textbox', { name: 'Minimum matches' })).not.toBeInTheDocument()
      expect(lastTable()).not.toHaveProperty('minimum')
    })

    it('is shown empty on a rate sort; typing refetches after a debounce, and Clear removes it', async () => {
      renderPage('/manage/leaderboards?tab=teams&sort=winPercent')
      const field = await screen.findByRole('textbox', { name: 'Minimum matches' }, wait)
      expect(field).toHaveValue('')
      expect(field).toHaveAttribute('placeholder', 'No minimum')
      await screen.findAllByTestId('standings-row')
      expect(lastTable()).not.toHaveProperty('minimum')
      const before = server.tableCalls.length
      await userEvent.type(field, '3')
      expect(server.tableCalls.length).toBe(before)
      await waitFor(() => expect(lastTable().minimum).toBe(3), wait)
      await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
      expect(field).toHaveValue('')
      await waitFor(() => expect(lastTable()).not.toHaveProperty('minimum'), wait)
    })

    it('is dropped when the sort changes', async () => {
      renderPage('/manage/leaderboards?tab=teams&sort=winPercent')
      const field = await screen.findByRole('textbox', { name: 'Minimum matches' }, wait)
      await userEvent.type(field, '2')
      await waitFor(() => expect(lastTable().minimum).toBe(2), wait)
      await userEvent.click(screen.getByRole('button', { name: 'Sort by Team economy rate' }))
      await waitFor(() => expect(lastTable().sort).toBe('economy'))
      expect(lastTable()).not.toHaveProperty('minimum')
      expect(screen.getByRole('textbox', { name: 'Minimum matches' })).toHaveValue('')
    })

    it('says how many teams are below it', async () => {
      server.table = rate(2)
      renderPage('/manage/leaderboards?tab=teams&sort=winPercent')
      const field = await screen.findByRole('textbox', { name: 'Minimum matches' }, wait)
      await screen.findAllByTestId('standings-row')
      expect(footer()).not.toHaveTextContent('below the minimum')
      await userEvent.type(field, '3')
      await waitFor(() => expect(footer()).toHaveTextContent('2 teams are below the minimum of 3 matches.'), wait)
    })

    it('offers Clear minimum when it excludes every team', async () => {
      server.table = rate(4, (minimum) => (minimum === undefined ? [makeTeamRow({ id: 'a', rank: 1 })] : []))
      renderPage('/manage/leaderboards?tab=teams&sort=winPercent')
      await userEvent.type(await screen.findByRole('textbox', { name: 'Minimum matches' }, wait), '9')
      expect(await screen.findByText('No team has reached 9 matches', {}, wait)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear minimum' }))
      await waitFor(() => expect(lastTable()).not.toHaveProperty('minimum'), wait)
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(1)
    })
  })

  describe('under the table', () => {
    it('states the basis with only the parts that are not zero, and what a forfeit is', async () => {
      server.table = table({ basis: makeTeamBasis({ resultsCounted: 31, internalResults: 2, resultsNoBallBowled: 1, forfeits: 1 }) })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      const text = footer().textContent ?? ''
      expect(text).toContain('Showing 2 of 2 teams.')
      expect(text).toContain('Based on 31 published results.')
      expect(text).toContain('2 internal matches are counted once for each team.')
      expect(text).toContain('1 result with no ball bowled is not counted.')
      expect(text).toMatch(/1 forfeit is counted in P: a forfeit is a loss for the team that conceded and a win for the one that received it/)
    })

    it('leaves the excluded-result sentences out when those counts are zero, and counts plurals correctly', async () => {
      server.table = table({ basis: makeTeamBasis({ resultsCounted: 1 }) })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(footer().textContent).toContain('Based on 1 published result.')
      expect(footer().textContent).not.toMatch(/internal|forfeit|no ball/)
    })

    it('says the no-ball results are not counted (plural) and a single internal match is counted once', async () => {
      server.table = table({ basis: makeTeamBasis({ internalResults: 1, resultsNoBallBowled: 3, forfeits: 2 }) })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(footer().textContent).toContain('1 internal match is counted once for each team.')
      expect(footer().textContent).toContain('3 results with no ball bowled are not counted.')
      expect(footer().textContent).toContain('2 forfeits are counted in P')
    })

    it('has the Partnerships line', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.getByText('Partnerships (runs by wicket) are not captured yet.')).toBeInTheDocument()
    })

    it('Show more asks for the next page and appends, never slicing', async () => {
      server.table = (params) => {
        const page = Number(params.page)
        const base = defaultTeamStatsServer().table(params)
        if (base instanceof Error) return base
        return {
          ...base,
          rows: page === 0 ? [makeTeamRow({ id: 'a', rank: 1 }), makeTeamRow({ id: 'b', rank: 2 })] : [makeTeamRow({ id: 'c', rank: 3 })],
          page: { number: page, size: 25, totalElements: 3, hasMore: page === 0 },
        }
      }
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(footer()).toHaveTextContent('Showing 2 of 3 teams.')
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      await waitFor(() => expect(rows()).toHaveLength(3))
      expect(server.tableCalls.map((c) => c.page)).toEqual([0, 1])
      expect(server.tableCalls.every((c) => c.size === 25)).toBe(true)
      expect(rankCells()).toEqual(['1', '2', '3'])
      expect(footer()).toHaveTextContent('Showing 3 of 3 teams.')
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    })

    it('renders every row the server sent, even more than a page, and has no Show more when there is no more', async () => {
      server.table = table({ rows: Array.from({ length: 30 }, (_, i) => makeTeamRow({ id: `t${i}`, rank: i + 1 })) })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(rows()).toHaveLength(30)
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    })
  })

  describe('a row', () => {
    it('links to the team page carrying Season and League (empty = All), with the way back in router state', async () => {
      renderPage('/manage/leaderboards?tab=teams&sort=runs&dir=asc')
      const link = await screen.findByRole('link', { name: 'Villagers t1' }, wait)
      expect(link).toHaveAttribute('href', '/manage/teams/t1/stats?seasonId=season-1&leagueId=')
      await userEvent.click(link)
      expect(await screen.findByTestId('team-path')).toHaveTextContent('/manage/teams/t1/stats')
      expect(JSON.parse(screen.getByTestId('team-state').textContent ?? '')).toEqual({
        backTo: '/manage/leaderboards?tab=teams&sort=runs&dir=asc',
        backLabel: 'Teams',
      })
    })

    it('carries a chosen League and Competition, and not the Section', async () => {
      localStorage.setItem('leaderboards:filters:club-1', JSON.stringify({ seasonId: 'all', leagueId: 'league-1', sectionId: 'u15a', teamId: null }))
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await chooseOption('Competition', 'Friendlies')
      await waitFor(() => expect(lastTable().competition).toBe('FRIENDLY'), wait)
      const link = await screen.findByRole('link', { name: 'Villagers t2' })
      expect(link).toHaveAttribute('href', '/manage/teams/t2/stats?seasonId=&leagueId=league-1&competition=FRIENDLY')
    })

    it('opens the team page when the row (not just the name) is clicked, with the same state', async () => {
      renderPage()
      await userEvent.click((await screen.findAllByTestId('cell-runs', {}, wait))[0])
      expect(await screen.findByTestId('team-path')).toHaveTextContent('/manage/teams/t1/stats')
      expect(JSON.parse(screen.getByTestId('team-state').textContent ?? '')).toMatchObject({ backLabel: 'Teams' })
    })
  })

  describe('empty and error states', () => {
    const none = { rows: [], basis: makeTeamBasis({ resultsCounted: 0, teamsListed: 0, teamsRanked: 0 }), page: { number: 0, size: 25, totalElements: 0, hasMore: false } }

    it('no published results at all and no filter set: says so and offers Go to Results', async () => {
      localStorage.setItem('leaderboards:filters:club-1', JSON.stringify({ seasonId: 'all', leagueId: null, sectionId: null, teamId: null }))
      server.table = table(none)
      renderPage()
      expect(await screen.findByText('No published results yet', {}, wait)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to Results' })).toHaveAttribute('href', '/manage/results')
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    it('no results under the filters: says so and Clear filters drops them (and the Competition)', async () => {
      server.table = table(none)
      renderPage()
      expect(await screen.findByText('No published results match these filters', {}, wait)).toBeInTheDocument()
      expect(lastTable().seasonId).toBe('season-1')
      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      await waitFor(() => expect(lastTable()).not.toHaveProperty('seasonId'), wait)
      expect(JSON.parse(localStorage.getItem('leaderboards:filters:club-1') as string)).toMatchObject({ seasonId: 'all', leagueId: null, sectionId: null })
    })

    it('a Competition alone counts as a filter, and Clear filters resets it', async () => {
      localStorage.setItem('leaderboards:filters:club-1', JSON.stringify({ seasonId: 'all', leagueId: null, sectionId: null, teamId: null }))
      server.table = (params) => (params.competition ? table(none)(params) : defaultTeamStatsServer().table(params))
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await chooseOption('Competition', 'Friendlies')
      await userEvent.click(await screen.findByRole('button', { name: 'Clear filters' }, wait))
      await waitFor(() => expect(lastTable()).not.toHaveProperty('competition'), wait)
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(2)
    })

    it('results exist but no team has a figure: says no team is on the table', async () => {
      server.table = table({ rows: [], page: { number: 0, size: 25, totalElements: 0, hasMore: false } })
      renderPage()
      expect(await screen.findByText('No team is on this table yet', {}, wait)).toBeInTheDocument()
    })

    it('a failed load shows an alert with Try again, the tabs and filters still work, and Try again reloads', async () => {
      server.table = () => new Error('boom')
      renderPage()
      const alert = await screen.findByRole('alert', {}, wait)
      expect(alert).toHaveTextContent("Couldn't load team statistics")
      expect(screen.getByRole('tab', { name: 'Teams' })).toBeInTheDocument()
      server.table = defaultTeamStatsServer().table
      await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(2)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows loading rows, not a table, while the first page loads', async () => {
      let release: () => void = () => undefined
      const hold = new Promise<void>((resolve) => { release = resolve })
      const inner = apiGet.getMockImplementation() as (url: string, config?: unknown) => Promise<unknown>
      apiGet.mockImplementation(async (url: string, config?: unknown) => {
        if (url.endsWith('/team-stats')) await hold
        return inner(url, config)
      })
      renderPage()
      expect(await screen.findByLabelText('Loading table', {}, wait)).toHaveAttribute('aria-busy', 'true')
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      release()
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(2)
    })
  })

  it('shows a row for a team with a high total of runs only when wickets are not on file', async () => {
    server.table = table({ rows: [makeTeamRow({ id: 'a', rank: 1, values: { highTotal: highTotal(150, null) } }), makeTeamRow({ id: 'b', rank: 2, values: { highTotal: highTotal(null, null) } })] })
    renderPage()
    await screen.findAllByTestId('standings-row', {}, wait)
    expect(rows().map((row) => within(row).getByTestId('cell-highTotal').textContent)).toEqual(['150', '–'])
  })
})
