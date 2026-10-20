import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LeaderboardsPage from './LeaderboardsPage'
import { defaultServer, leaderboardApi, makeTable, num, tableRow } from '../../../test/leaderboardFixtures'
import type { LeaderboardServer } from '../../../test/leaderboardFixtures'

// docs/specs/103-player-stats.md, "Leaderboards" and decisions 15 to 27: the page, its filters and the standings table, through the
// real hooks and query keys over a routed axios mock (so the parameters the server would receive are what is asserted).
let server: LeaderboardServer
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

function renderPage(path = '/manage/leaderboards') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="leaderboards" element={<LeaderboardsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const wait = { timeout: 5000 }
const search = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '')
// the params of every board request so far / the latest
const tableCalls = () => apiGet.mock.calls.filter(([url]) => /\/leaderboards\/(batting|bowling|fielding)$/.test(url as string)).map(([url, config]) => ({ url: url as string, params: (config?.params ?? {}) as Record<string, unknown> }))
const lastTable = () => tableCalls()[tableCalls().length - 1]
const heading = (name: string) => screen.getByRole('button', { name })
const rankCells = () => screen.getAllByTestId('standings-row').map((row) => row.getAttribute('data-rank'))
async function openSortBy() {
  await userEvent.click(await screen.findByRole('combobox', { name: 'Sort by' }, wait))
  return screen.findAllByRole('option')
}

describe('LeaderboardsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    server = defaultServer()
    apiGet.mockReset()
    apiGet.mockImplementation((url: string, config?: unknown) => leaderboardApi(server).get(url, config as never))
  })

  describe('tabs', () => {
    it('shows Batting, Bowling, Fielding and Awards, opening on Batting', async () => {
      renderPage()
      expect(await screen.findByRole('tab', { name: 'Batting' }, wait)).toHaveAttribute('aria-selected', 'true')
      expect(['Batting', 'Bowling', 'Fielding', 'Awards'].map((name) => screen.getByRole('tab', { name }))).toHaveLength(4)
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(2)
      expect(lastTable().url).toMatch(/\/leaderboards\/batting$/)
    })

    it('binds the tab to ?tab= and falls back to Batting for an unknown value', async () => {
      renderPage('/manage/leaderboards?tab=bowling')
      expect(await screen.findByRole('tab', { name: 'Bowling' }, wait)).toHaveAttribute('aria-selected', 'true')
      await waitFor(() => expect(lastTable().url).toMatch(/\/bowling$/))
    })

    it('an unknown ?tab= is Batting', async () => {
      renderPage('/manage/leaderboards?tab=zzz')
      expect(await screen.findByRole('tab', { name: 'Batting' }, wait)).toHaveAttribute('aria-selected', 'true')
    })

    it('switching tab writes ?tab= and loads that group', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('tab', { name: 'Fielding' }, wait))
      expect(search().get('tab')).toBe('fielding')
      await waitFor(() => expect(lastTable().url).toMatch(/\/fielding$/))
    })

    it('the header Awards button and the Awards tab open the Awards view', async () => {
      renderPage()
      await userEvent.click(await screen.findByRole('button', { name: 'Awards' }, wait))
      expect(search().get('tab')).toBe('awards')
      expect(await screen.findByRole('heading', { name: /Irene Villagers, 2026\/27 season/ }, wait)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Awards' })).not.toBeInTheDocument()
    })

    it('shows a retry when the catalogue cannot be loaded', async () => {
      server.catalogue = { groups: [] }
      renderPage()
      expect(await screen.findByText('Could not load the leaderboards', {}, wait)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })

  describe('columns and sorting', () => {
    it('takes the columns from the catalogue, short headings, with the player and rank first', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      const row = screen.getByTestId('standings-header-row')
      const text = within(row).getAllByRole('button').map((b) => b.textContent)
      expect(text).toEqual(['M', 'Runs', 'Avg', 'SR', 'HS'])
      expect(row).toHaveTextContent(/^#Player/)
      expect(within(screen.getAllByTestId('standings-row')[0]).getByTestId('cell-highestScore')).toHaveTextContent('94*')
    })

    it('does not offer a heading or the Sort by select for a column the catalogue says is not sortable', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(within(screen.getByTestId('standings-header-row')).getByText('M').closest('button')).toBeDisabled()
      const options = (await openSortBy()).map((o) => o.textContent)
      expect(options).toEqual(['Runs scored', 'Batting average', 'Batting strike rate', 'Highest score'])
    })

    it('Sort by shows the long labels while the headings stay short', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveTextContent('Runs scored')
      expect(screen.getByTestId('standings-header-row')).toHaveTextContent('Avg')
      expect(screen.getByTestId('standings-header-row')).not.toHaveTextContent('Batting average')
    })

    it('starts on the group default sort in its natural direction, with no direction or minimum sent', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(lastTable().params).toMatchObject({ sort: 'runs', page: 0, size: 10 })
      expect(lastTable().params).not.toHaveProperty('direction')
      expect(lastTable().params).not.toHaveProperty('minimum')
    })

    it('clicking a heading sorts by that column', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await userEvent.click(heading('Sort by Batting average'))
      expect(search().get('sort')).toBe('average')
      expect(search().has('dir')).toBe(false)
      await waitFor(() => expect(lastTable().params.sort).toBe('average'))
      expect(lastTable().params).not.toHaveProperty('direction')
    })

    it('choosing a column in Sort by sorts by it', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await openSortBy()
      await userEvent.click(screen.getByRole('option', { name: 'Highest score' }))
      expect(search().get('sort')).toBe('highestScore')
      await waitFor(() => expect(lastTable().params.sort).toBe('highestScore'))
    })

    it('clicking the current sort heading reverses: direction sent, ?dir= in the URL, arrow and aria-sort follow the server', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.getByRole('button', { name: /^Runs scored, sorted descending/ }).closest('[aria-sort]')).toHaveAttribute('aria-sort', 'descending')

      await userEvent.click(screen.getByRole('button', { name: /^Runs scored, sorted descending/ }))
      expect(search().get('dir')).toBe('asc')
      await waitFor(() => expect(lastTable().params).toMatchObject({ sort: 'runs', direction: 'asc' }))
      const reversed = await screen.findByRole('button', { name: /^Runs scored, sorted ascending/ })
      expect(reversed.closest('[aria-sort]')).toHaveAttribute('aria-sort', 'ascending')

      await userEvent.click(reversed)
      await waitFor(() => expect(search().has('dir')).toBe(false))
      await waitFor(() => expect(lastTable().params).not.toHaveProperty('direction'))
      expect(await screen.findByRole('button', { name: /^Runs scored, sorted descending/ })).toBeInTheDocument()
    })

    it('the arrow and aria-sort show what the server says, not what was asked', async () => {
      server.table = (_group, params) => makeTable({ sort: { code: String(params.sort), direction: 'LOWEST' } })
      renderPage()
      const sorted = await screen.findByRole('button', { name: /^Runs scored, sorted ascending/ }, wait)
      expect(sorted.closest('[aria-sort]')).toHaveAttribute('aria-sort', 'ascending')
    })

    it('Reverse order does the same as clicking the sorted heading', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await userEvent.click(screen.getByRole('button', { name: 'Reverse order' }))
      expect(search().get('dir')).toBe('asc')
      await waitFor(() => expect(lastTable().params.direction).toBe('asc'))
    })

    it('a column whose natural order is lowest-first reverses to desc', async () => {
      renderPage('/manage/leaderboards?tab=bowling&sort=economy')
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(lastTable().params).not.toHaveProperty('direction')
      await userEvent.click(screen.getByRole('button', { name: 'Reverse order' }))
      expect(search().get('dir')).toBe('desc')
      await waitFor(() => expect(lastTable().params).toMatchObject({ sort: 'economy', direction: 'desc' }))
    })

    it('changing the sort column resets the direction', async () => {
      renderPage('/manage/leaderboards?sort=runs&dir=asc')
      await waitFor(() => expect(lastTable().params).toMatchObject({ sort: 'runs', direction: 'asc' }), wait)
      await userEvent.click(await screen.findByRole('button', { name: 'Sort by Batting average' }))
      expect(search().has('dir')).toBe(false)
      await waitFor(() => expect(lastTable().params.sort).toBe('average'))
      expect(lastTable().params).not.toHaveProperty('direction')
    })

    it('ignores a ?dir= without a matching sort, and a sort that is not a sortable column', async () => {
      renderPage('/manage/leaderboards?sort=matches&dir=asc')
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(lastTable().params.sort).toBe('runs')
      expect(lastTable().params).not.toHaveProperty('direction')
    })
  })

  describe('rows', () => {
    it('shows equal ranks for ties (1, 2, 2, 4)', async () => {
      server.table = (_g, p) =>
        makeTable({
          sort: { code: String(p.sort), direction: 'HIGHEST' },
          rows: [tableRow({ id: 'a', rank: 1 }), tableRow({ id: 'b', rank: 2 }), tableRow({ id: 'c', rank: 2 }), tableRow({ id: 'd', rank: 4 })],
        })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(rankCells()).toEqual(['1', '2', '2', '4'])
      const texts = screen.getAllByTestId('standings-row').map((row) => row.firstElementChild?.textContent)
      expect(texts).toEqual(['1', '2', '2', '4'])
    })

    it('lists the unranked group last, after a divider, with a dash for the rank and the reason', async () => {
      server.table = (_g, p) =>
        makeTable({
          sort: { code: String(p.sort), direction: 'HIGHEST' },
          rows: [
            tableRow({ id: 'a', rank: 1 }),
            tableRow({ id: 'b', rank: 2 }),
            tableRow({ id: 'c', rank: null, values: { ...tableRow().values, average: num(null) } }),
          ],
        })
      renderPage('/manage/leaderboards?sort=average')
      await screen.findAllByTestId('standings-row', {}, wait)
      const divider = screen.getByTestId('unranked-divider')
      expect(divider).toHaveTextContent('Not ranked: no dismissals yet')
      const rows = screen.getAllByTestId('standings-row')
      expect(rows[2].getAttribute('data-rank')).toBe('none')
      expect(rows[2].firstElementChild).toHaveTextContent('–')
      expect(within(rows[2]).getByTestId('cell-average')).toHaveTextContent('–')
      // divider sits between the last ranked row and the first unranked row
      expect(rows[1].compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(divider.compareDocumentPosition(rows[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('draws no divider when everyone is ranked', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.queryByTestId('unranked-divider')).not.toBeInTheDocument()
    })

    it('marks a small sample and an inactive player with chips, and still ranks them', async () => {
      server.table = (_g, p) =>
        makeTable({
          sort: { code: String(p.sort), direction: 'HIGHEST' },
          rows: [tableRow({ id: 'a', rank: 1, smallSample: true, teamName: 'Villagers 1' }), tableRow({ id: 'b', rank: 2, active: false })],
        })
      renderPage()
      const rows = await screen.findAllByTestId('standings-row', {}, wait)
      expect(within(rows[0]).getByText('Small sample')).toBeInTheDocument()
      expect(within(rows[0]).getByText('Villagers 1')).toBeInTheDocument()
      expect(within(rows[0]).queryByText('Inactive')).not.toBeInTheDocument()
      expect(within(rows[1]).getByText('Inactive')).toBeInTheDocument()
      expect(within(rows[1]).queryByText('Small sample')).not.toBeInTheDocument()
      expect(rankCells()).toEqual(['1', '2'])
    })

    it('each row links straight to the player stats page carrying the filters', async () => {
      renderPage()
      const rows = await screen.findAllByTestId('standings-row', {}, wait)
      // the current season is the default
      expect(rows[0]).toHaveAttribute('href', '/manage/players/p1/stats?seasonId=season-1&leagueId=&teamId=&sectionId=')
      expect(rows[1]).toHaveAttribute('href', '/manage/players/p2/stats?seasonId=season-1&leagueId=&teamId=&sectionId=')
    })

    it('the link carries a chosen League and Team too', async () => {
      localStorage.setItem('leaderboards:filters:club-1', JSON.stringify({ seasonId: 'all', leagueId: 'league-1', sectionId: null, teamId: 'team-1' }))
      renderPage()
      const rows = await screen.findAllByTestId('standings-row', {}, wait)
      expect(rows[0]).toHaveAttribute('href', '/manage/players/p1/stats?seasonId=&leagueId=league-1&teamId=team-1&sectionId=')
    })

    it('shows a dash for a dots column nobody recorded, and states the dots coverage in the footer', async () => {
      server.table = (_g, p) =>
        makeTable(
          {
            sort: { code: String(p.sort), direction: 'HIGHEST' },
            basis: { resultsCounted: 12, playersListed: 1, playersRanked: 1, belowMinimum: 0, coverage: { used: 12, counted: 20 } },
            rows: [tableRow({ id: 'a', rank: 1, values: { wickets: num(14), dots: num(null), best: { value: null, runs: 17, wickets: 4, notOut: null } } })],
          },
          'BOWLING',
        )
      renderPage('/manage/leaderboards?tab=bowling&sort=dots')
      const row = (await screen.findAllByTestId('standings-row', {}, wait))[0]
      expect(within(row).getByTestId('cell-dots')).toHaveTextContent('–')
      expect(within(row).getByTestId('cell-best')).toHaveTextContent('4/17')
      expect(screen.getByTestId('board-footer')).toHaveTextContent('Dots recorded in 12 of 20 bowling innings.')
    })

    it('states partial coverage on other columns, and nothing when complete', async () => {
      server.table = (_g, p) =>
        makeTable({
          sort: { code: String(p.sort), direction: 'HIGHEST' },
          basis: { resultsCounted: 12, playersListed: 2, playersRanked: 2, belowMinimum: 0, coverage: { used: 9, counted: 14 } },
        })
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.getByTestId('board-footer')).toHaveTextContent('Based on 12 published results. Recorded in 9 of 14 innings.')
      expect(screen.getByTestId('board-footer')).toHaveTextContent('Showing 2 of 2.')
    })

    it('shows overs in cricket notation on the Bowling table', async () => {
      server.table = (_g, p) =>
        makeTable(
          {
            sort: { code: String(p.sort), direction: 'HIGHEST' },
            rows: [tableRow({ id: 'a', rank: 1, values: { wickets: num(3), overs: { value: 36.67, runs: null, wickets: null, notOut: null, balls: 220, ballsPerOver: 6 } } })],
          },
          'BOWLING',
        )
      renderPage('/manage/leaderboards?tab=bowling')
      expect(await screen.findByTestId('cell-overs', {}, wait)).toHaveTextContent('36.4')
    })
  })

  describe('paging', () => {
    it('Show more requests the next page and appends, never slicing', async () => {
      server.table = (_g, p) => {
        const page = Number(p.page)
        return makeTable({
          sort: { code: String(p.sort), direction: 'HIGHEST' },
          rows: page === 0 ? [tableRow({ id: 'a', rank: 1 }), tableRow({ id: 'b', rank: 2 })] : [tableRow({ id: 'c', rank: 3 })],
          page: { number: page, size: 10, totalElements: 3, hasMore: page === 0 },
        })
      }
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.getByTestId('board-footer')).toHaveTextContent('Showing 2 of 3.')
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      await waitFor(() => expect(screen.getAllByTestId('standings-row')).toHaveLength(3))
      expect(tableCalls().map((c) => c.params.page)).toEqual([0, 1])
      expect(tableCalls().every((c) => c.params.size === 10)).toBe(true)
      expect(rankCells()).toEqual(['1', '2', '3'])
      expect(screen.getByTestId('board-footer')).toHaveTextContent('Showing 3 of 3.')
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    })

    it('has no Show more when the server says there is no more', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    })
  })

  describe('the optional minimum', () => {
    const rateTable = (applies: boolean, belowMinimum = 0, rows = [tableRow({ id: 'a', rank: 1 })]) => (_g: string, p: Record<string, unknown>) =>
      makeTable({
        sort: { code: String(p.sort), direction: 'HIGHEST' },
        minimum: { applies, value: (p.minimum as number | undefined) ?? null, suggestedDefault: 3, unit: 'INNINGS' },
        basis: { resultsCounted: 12, playersListed: rows.length, playersRanked: rows.length, belowMinimum, coverage: null },
        rows,
      })

    it('is not shown on a counting sort (minimum.applies is false), and nothing is sent by default', async () => {
      server.table = rateTable(false)
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(screen.queryByRole('textbox', { name: 'Minimum innings' })).not.toBeInTheDocument()
    })

    it('is shown empty on a rate sort, with the suggested minimum, and the list is unfiltered by default', async () => {
      server.table = rateTable(true)
      renderPage('/manage/leaderboards?sort=average')
      const field = await screen.findByRole('textbox', { name: 'Minimum innings' }, wait)
      expect(field).toHaveValue('')
      expect(field).toHaveAttribute('placeholder', 'No minimum')
      expect(await screen.findByText(/Suggested minimum for these filters: 3/, {}, wait)).toBeInTheDocument()
      expect(await screen.findAllByTestId('standings-row')).toHaveLength(1)
      expect(lastTable().params).not.toHaveProperty('minimum')
    })

    it('typing a minimum refetches after a debounce, and Clear removes it', async () => {
      server.table = rateTable(true)
      renderPage('/manage/leaderboards?sort=average')
      const field = await screen.findByRole('textbox', { name: 'Minimum innings' }, wait)
      await screen.findAllByTestId('standings-row')
      const before = tableCalls().length
      await userEvent.type(field, '3')
      // held back by the debounce: not sent yet
      expect(tableCalls().length).toBe(before)
      await waitFor(() => expect(lastTable().params.minimum).toBe(3), wait)
      await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
      expect(field).toHaveValue('')
      await waitFor(() => expect(lastTable().params).not.toHaveProperty('minimum'), wait)
    })

    it('is dropped when the sort changes', async () => {
      server.table = rateTable(true)
      renderPage('/manage/leaderboards?sort=average')
      const field = await screen.findByRole('textbox', { name: 'Minimum innings' }, wait)
      await userEvent.type(field, '2')
      await waitFor(() => expect(lastTable().params.minimum).toBe(2), wait)
      await userEvent.click(screen.getByRole('button', { name: 'Sort by Batting strike rate' }))
      await waitFor(() => expect(lastTable().params.sort).toBe('strikeRate'))
      expect(lastTable().params).not.toHaveProperty('minimum')
      expect(screen.getByRole('textbox', { name: 'Minimum innings' })).toHaveValue('')
    })

    it('says how many players are below it, and offers Clear minimum when nobody reaches it', async () => {
      server.table = (_g, p) => {
        const atMinimum = p.minimum !== undefined
        return rateTable(true, 4, atMinimum ? [] : [tableRow({ id: 'a', rank: 1 })])(_g, p)
      }
      renderPage('/manage/leaderboards?sort=average')
      const field = await screen.findByRole('textbox', { name: 'Minimum innings' }, wait)
      await userEvent.type(field, '9')
      expect(await screen.findByText('No player has reached 9 innings', {}, wait)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear minimum' }))
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(1)
    })

    it('uses Minimum overs on an overs sort', async () => {
      server.table = (_g, p) =>
        makeTable(
          {
            sort: { code: String(p.sort), direction: 'LOWEST' },
            minimum: { applies: true, value: null, suggestedDefault: 8, unit: 'OVERS' },
            rows: [tableRow({ id: 'a', rank: 1, values: { economy: num(5.8) } })],
          },
          'BOWLING',
        )
      renderPage('/manage/leaderboards?tab=bowling&sort=economy')
      expect(await screen.findByRole('textbox', { name: 'Minimum overs' }, wait)).toBeInTheDocument()
    })
  })

  describe('empty and error states', () => {
    it('no published results with filters set: says so and Clear filters drops the filters', async () => {
      server.table = (_g, p) => makeTable({ sort: { code: String(p.sort), direction: 'HIGHEST' }, rows: [], basis: { resultsCounted: 0, playersListed: 0, playersRanked: 0, belowMinimum: 0, coverage: null } })
      renderPage()
      expect(await screen.findByText('No published results match these filters', {}, wait)).toBeInTheDocument()
      expect(lastTable().params.seasonId).toBe('season-1')
      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      await waitFor(() => expect(lastTable().params).not.toHaveProperty('seasonId'))
      expect(JSON.parse(localStorage.getItem('leaderboards:filters:club-1') as string)).toMatchObject({ seasonId: 'all', leagueId: null, sectionId: null, teamId: null })
    })

    it('has no Clear filters when no filter is set', async () => {
      localStorage.setItem('leaderboards:filters:club-1', JSON.stringify({ seasonId: 'all', leagueId: null, sectionId: null, teamId: null }))
      server.table = (_g, p) => makeTable({ sort: { code: String(p.sort), direction: 'HIGHEST' }, rows: [], basis: { resultsCounted: 0, playersListed: 0, playersRanked: 0, belowMinimum: 0, coverage: null } })
      renderPage()
      expect(await screen.findByText('No published results match these filters', {}, wait)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
    })

    it('results exist but nobody has a figure: says nobody is on the table yet', async () => {
      server.table = (_g, p) => makeTable({ sort: { code: String(p.sort), direction: 'HIGHEST' }, rows: [] })
      renderPage()
      expect(await screen.findByText('Nobody is on this table yet', {}, wait)).toBeInTheDocument()
    })

    it('a failed table read shows an alert with Try again', async () => {
      server.table = () => new Error('boom')
      renderPage()
      expect(await screen.findByText('Could not load this table', {}, wait)).toBeInTheDocument()
      server.table = (_g, p) => makeTable({ sort: { code: String(p.sort), direction: 'HIGHEST' } })
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findAllByTestId('standings-row', {}, wait)).toHaveLength(2)
    })

    it('shows a loading state before the first page arrives', async () => {
      server.table = () => new Promise(() => undefined) as never
      renderPage()
      expect(await screen.findByLabelText('Loading table', {}, wait)).toBeInTheDocument()
    })
  })

  describe('filters', () => {
    it('defaults to the current season, and sends it, with no other filter', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(lastTable().params).toMatchObject({ seasonId: 'season-1' })
      expect(lastTable().params).not.toHaveProperty('leagueId')
      expect(lastTable().params).not.toHaveProperty('teamId')
      expect(lastTable().params).not.toHaveProperty('sectionId')
      expect(screen.getByRole('combobox', { name: 'Season' })).toHaveTextContent('2026/27')
    })

    it('does not fetch a board twice while the defaults are being worked out', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(tableCalls().every((call) => call.params.seasonId === 'season-1')).toBe(true)
    })

    it('offers only values that have counted data', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      const optionsOf = async (name: string) => {
        await userEvent.click(screen.getByRole('combobox', { name }))
        const names = (await screen.findAllByRole('option')).map((o) => o.textContent)
        await userEvent.keyboard('{Escape}')
        await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
        return names
      }
      expect(await optionsOf('Season')).toEqual(['All seasons', '2026/27'])
      expect(await optionsOf('League')).toEqual(['All leagues', 'Premier League'])
      expect(await optionsOf('Team')).toEqual(['All teams', 'Villagers 1'])
      await userEvent.click(screen.getByLabelText('Section'))
      await screen.findAllByRole('treeitem')
      for (const name of ['Club', 'Juniors', 'U15', 'U15A']) expect(screen.getByText(name)).toBeInTheDocument()
      expect(screen.queryByText('Seniors')).not.toBeInTheDocument()
    })

    it('sends a chosen League and Team, and saves every choice per club', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await userEvent.click(screen.getByRole('combobox', { name: 'League' }))
      await userEvent.click(await screen.findByRole('option', { name: 'Premier League' }))
      await userEvent.click(screen.getByRole('combobox', { name: 'Team' }))
      await userEvent.click(await screen.findByRole('option', { name: 'Villagers 1' }))
      await waitFor(() => expect(lastTable().params).toMatchObject({ seasonId: 'season-1', leagueId: 'league-1', teamId: 'team-1' }))
      await waitFor(() =>
        expect(JSON.parse(localStorage.getItem('leaderboards:filters:club-1') as string)).toMatchObject({ leagueId: 'league-1', teamId: 'team-1' }),
      )
    })

    it('sends a chosen Section (the server includes its descendants)', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await userEvent.click(screen.getByLabelText('Section'))
      await userEvent.click(await screen.findByText('Juniors'))
      await waitFor(() => expect(lastTable().params.sectionId).toBe('juniors'))
    })

    it('All seasons is a deliberate choice that is remembered (not replaced by the default)', async () => {
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
      await userEvent.click(await screen.findByRole('option', { name: 'All seasons' }))
      await waitFor(() => expect(lastTable().params).not.toHaveProperty('seasonId'))
      expect(screen.getByRole('combobox', { name: 'Season' })).toHaveTextContent('All seasons')
    })

    it('restores saved filters for this club', async () => {
      localStorage.setItem('leaderboards:filters:club-1', JSON.stringify({ seasonId: 'all', leagueId: 'league-1', sectionId: null, teamId: null }))
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(lastTable().params).toMatchObject({ leagueId: 'league-1' })
      expect(lastTable().params).not.toHaveProperty('seasonId')
    })

    it('a saved season that is no longer offered falls back to the current season, and a saved league to All', async () => {
      localStorage.setItem('leaderboards:filters:club-1', JSON.stringify({ seasonId: 'season-2', leagueId: 'league-2', sectionId: 'seniors', teamId: 'team-2' }))
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      expect(lastTable().params).toEqual({ seasonId: 'season-1', sort: 'runs', page: 0, size: 10 })
    })

    it('leaves the lists unrestricted when the options cannot be read', async () => {
      server.options = new Error('nope')
      renderPage()
      await screen.findAllByTestId('standings-row', {}, wait)
      await userEvent.click(screen.getByRole('combobox', { name: 'Team' }))
      expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['All teams', 'Villagers 1', 'Villagers 2'])
    })
  })

  it('has the Full name | First name toggle', async () => {
    renderPage()
    await screen.findAllByTestId('standings-row', {}, wait)
    expect(screen.getByRole('button', { name: 'Full name' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'First name' })).toBeInTheDocument()
  })

  it('does not call the awards route for a standings tab', async () => {
    renderPage()
    await screen.findAllByTestId('standings-row', {}, wait)
    expect(apiGet.mock.calls.some(([url]) => (url as string).endsWith('/awards'))).toBe(false)
  })

  it('the table sits in a labelled board panel titled by the group', async () => {
    renderPage()
    await screen.findAllByTestId('standings-row', {}, wait)
    expect(screen.getByTestId('board-panel')).toHaveAccessibleName('Batting')
  })
})
