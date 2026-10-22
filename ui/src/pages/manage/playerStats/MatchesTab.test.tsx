import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import PlayerStatsPage from './PlayerStatsPage'
import {
  defaultMatchesServer,
  makeMatchRow,
  makeRows,
  makeStats,
  noScorecardRow,
  pageOf,
  playerMatchesApi,
} from '../../../test/playerMatchesFixtures'
import type { MatchesServer } from '../../../test/playerMatchesFixtures'
import type { PlayerMatchResultCode, PlayerMatchRow } from '../../../api/playerStatsApi'

// docs/specs/115-player-match-list.md, "UI Requirements" and decisions 2 to 4: the Matches tab of the player stats page, through the
// real hooks, query keys and paging over a routed axios mock (so the parameters the server would receive are what is asserted).
let server: MatchesServer
const apiGet = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }))
vi.mock('../../../api/playerApi', () => ({
  listPlayers: () =>
    Promise.resolve([{ id: 'player-1', firstName: 'Sam', lastName: 'Visser', active: true, verificationStatus: 'VERIFIED', sectionIds: [] }]),
}))
vi.mock('../../../api/seasonApi', () => ({
  listSeasons: () =>
    Promise.resolve([
      { id: 'season-1', clubId: 'club-1', label: '2026/27', startDate: '2026-09-01', endDate: '2027-04-30', active: true, createdAt: '2026-01-01', updatedAt: '', updatedBy: null },
      { id: 'season-2', clubId: 'club-1', label: '2025/26', startDate: '2025-09-01', endDate: '2026-04-30', active: true, createdAt: '2025-01-01', updatedAt: '', updatedBy: null },
    ]),
}))
vi.mock('../../../api/leagueApi', () => ({ listLeagues: () => Promise.resolve([{ id: 'league-1', name: 'Premier League' }]) }))
const section = (id: string, name: string, parentSectionId: string | null = null) => ({
  id, clubId: 'club-1', parentSectionId, name, minAge: null, maxAge: null, gender: null, active: true, createdAt: '', updatedAt: '', updatedBy: null,
})
vi.mock('../../../api/sectionApi', () => ({
  listSections: () => Promise.resolve([section('club', 'Club'), section('juniors', 'Juniors', 'club'), section('u15', 'U15', 'juniors'), section('u15a', 'U15A', 'u15')]),
}))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: 'Villagers 1' }]) }))

// useMediaQuery picks the table (sm and up) or the phone cards; jsdom has no matchMedia, so the test supplies one.
function setViewport(wide: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: wide && query.includes('min-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function LocationProbe() {
  return <div data-testid="location">{useLocation().search}</div>
}
// The result page stand-in: shows where the row link went and the router state it carried.
function ResultProbe() {
  const location = useLocation()
  return (
    <div>
      <div data-testid="result-path">{location.pathname}</div>
      <div data-testid="result-state">{JSON.stringify(location.state)}</div>
    </div>
  )
}

const BASE = '/manage/players/player-1/stats'
const MATCHES = `${BASE}?tab=matches`

function renderPage(path = MATCHES) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="players/:playerId/stats" element={<PlayerStatsPage />} />
            <Route path="results/:matchId" element={<ResultProbe />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const wait = { timeout: 5000 }
const search = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '')
const lastCall = () => server.calls[server.calls.length - 1]
const rowsOnScreen = () => screen.queryAllByTestId('match-row')
const firstRow = () => screen.getAllByTestId('match-row')[0]
// A row's cells in order: Opponent, Competition, Result, then Runs, Balls, How out, Bowling, Fielding, Awards.
const cellsOf = (row: HTMLElement) => within(row).getAllByRole('cell')
async function showRows(...rows: PlayerMatchRow[]) {
  server.rows = rows
  server.stats = makeStats({ matchesCounted: rows.length })
  renderPage()
  await waitFor(() => expect(screen.queryAllByTestId(/^match-(row|card)$/).length).toBeGreaterThan(0), wait)
}
async function openBackState() {
  await userEvent.click(screen.getAllByRole('link', { name: /open result/ })[0])
  const state = JSON.parse((await screen.findByTestId('result-state')).textContent ?? 'null') as { backTo: string; backLabel: string }
  return { ...state, url: new URL(state.backTo, 'http://x') }
}

describe('Matches tab', () => {
  beforeEach(() => {
    localStorage.clear()
    setViewport(true)
    server = defaultMatchesServer()
    apiGet.mockReset()
    apiGet.mockImplementation((url: string, config?: unknown) => playerMatchesApi(server).get(url, config as never))
  })
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
  })

  describe('tab and request', () => {
    it('is the sixth and last tab (after Dashboard), and ?tab=matches selects it', async () => {
      renderPage()
      const tabs = await screen.findAllByRole('tab', {}, wait)
      expect(tabs.map((tab) => tab.textContent)).toEqual(['Overview', 'Batting', 'Bowling', 'Fielding', 'Awards & record', 'Matches'])
      expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true')
      await screen.findAllByTestId('match-row', {}, wait)
    })

    it('clicking the tab writes ?tab=matches and loads the list', async () => {
      renderPage(`${BASE}?tab=awards`)
      await userEvent.click(await screen.findByRole('tab', { name: 'Matches' }, wait))
      expect(search().get('tab')).toBe('matches')
      expect(await screen.findAllByTestId('match-row', {}, wait)).toHaveLength(3)
    })

    it('asks for page 0 of 20, newest first, with no filter params by default, and renders rows in the order received', async () => {
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      expect(server.calls[0]).toEqual({ direction: 'desc', page: 0, size: 20 })
      expect(rowsOnScreen().map((row) => within(row).getByRole('rowheader').textContent)).toEqual(['28 Mar 2026', '27 Mar 2026', '26 Mar 2026'])
      expect(rowsOnScreen().map((row) => cellsOf(row)[0].textContent)).toEqual(['Opponent 1Villagers 1', 'Opponent 2Villagers 1', 'Opponent 3Villagers 1'])
    })

    it('sends every filter from the link as a parameter', async () => {
      renderPage(`${MATCHES}&seasonId=season-1&leagueId=league-1&teamId=team-1&sectionId=u15a&competition=LEAGUE`)
      await screen.findAllByTestId('match-row', {}, wait)
      expect(lastCall()).toEqual({
        seasonId: 'season-1', leagueId: 'league-1', teamId: 'team-1', sectionId: 'u15a', competition: 'LEAGUE', direction: 'desc', page: 0, size: 20,
      })
    })

    it('honours ?competition= from the link and ignores an invalid value', async () => {
      const { unmount } = renderPage(`${MATCHES}&competition=FRIENDLY`)
      await screen.findAllByTestId('match-row', {}, wait)
      expect(lastCall().competition).toBe('FRIENDLY')
      unmount()

      server.calls.length = 0
      renderPage(`${MATCHES}&competition=BOGUS`)
      await screen.findAllByTestId('match-row', {}, wait)
      expect(server.calls.every((call) => !('competition' in call))).toBe(true)
    })

    it('a filter change restarts at page 0 with the new parameter', async () => {
      server.rows = makeRows(45)
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      await waitFor(() => expect(rowsOnScreen()).toHaveLength(40))

      await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
      await userEvent.click(await screen.findByRole('option', { name: '2026/27' }))

      await waitFor(() => expect(lastCall().seasonId).toBe('season-1'))
      expect(lastCall().page).toBe(0)
      await waitFor(() => expect(rowsOnScreen()).toHaveLength(20))
    })
  })

  describe('layout', () => {
    it('shows a real table from sm: roles, aria-label, aria-colcount and a column header per column', async () => {
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      const table = screen.getByRole('table', { name: 'Matches played' })
      expect(table).toHaveAttribute('aria-colcount', '10')
      await waitFor(() => expect(table).toHaveAttribute('aria-busy', 'false'))
      expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
        expect.stringContaining('Date'), 'Opponent', 'Competition', 'Result', 'Runs', 'Balls', 'How out', 'Bowling', 'Fielding', 'Awards',
      ])
      // the header row plus one per match; the date is the row header
      expect(within(table).getAllByRole('row')).toHaveLength(4)
      expect(within(table).getAllByRole('rowheader')).toHaveLength(3)
      expect(within(table).getAllByRole('rowgroup')).toHaveLength(2)
      expect(screen.queryAllByTestId('match-card')).toHaveLength(0)
    })

    it('marks the table busy while it fetches', async () => {
      let release: () => void = () => undefined
      const gate = new Promise<void>((resolve) => { release = resolve })
      server.rows = makeRows(45)
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      apiGet.mockImplementation(async (url: string, config?: unknown) => {
        if (url.endsWith('/stats/matches')) await gate
        return playerMatchesApi(server).get(url, config as never)
      })
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      expect(screen.getByRole('table', { name: 'Matches played' })).toHaveAttribute('aria-busy', 'true')
      release()
      await waitFor(() => expect(screen.getByRole('table', { name: 'Matches played' })).toHaveAttribute('aria-busy', 'false'))
    })

    it('shows one stacked card per match on a phone and no table', async () => {
      setViewport(false)
      renderPage()
      expect(await screen.findAllByTestId('match-card', {}, wait)).toHaveLength(3)
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      expect(screen.getByRole('list', { name: 'Matches played' })).toBeInTheDocument()
    })

    it('a phone card carries date, result badge, opponent, team and competition, and labelled Batting, Bowling and Fielding lines', async () => {
      setViewport(false)
      await showRows(makeMatchRow({ n: 1, opponentName: 'Riverside' }))
      const card = screen.getByTestId('match-card')
      expect(within(card).getByRole('link', { name: '14 March 2026 against Riverside, open result' })).toHaveTextContent('14 Mar 2026')
      expect(within(card).getByTestId('match-result')).toHaveTextContent('Won')
      expect(card).toHaveTextContent('Riverside')
      expect(card).toHaveTextContent('Villagers 1 · Premier League')
      expect(card).toHaveTextContent('Batting56 off 41 · caught')
      expect(card).toHaveTextContent('Bowling2/21 · 4.0 ov · 1 mdn · 8 dots')
      expect(card).toHaveTextContent('Fielding1 catch')
    })

    it('a phone card with no scorecard shows the note instead of the three lines', async () => {
      setViewport(false)
      await showRows(noScorecardRow())
      const card = screen.getByTestId('match-card')
      expect(card).toHaveTextContent('No scorecard captured')
      for (const label of ['Batting', 'Bowling', 'Fielding']) expect(card).not.toHaveTextContent(label)
    })

    it('a phone card shows muted words, dashes and visible award text', async () => {
      setViewport(false)
      await showRows(
        makeMatchRow({
          batting: { status: 'DID_NOT_BAT' },
          bowling: { status: 'DID_NOT_BOWL' },
          fielding: { status: 'RECORDED', catches: 0, stumpings: 0, runOuts: 0 },
          awards: { playerOfTheMatch: 1, teamPlayerOfTheMatch: 1 },
        }),
      )
      const card = screen.getByTestId('match-card')
      expect(card).toHaveTextContent('BattingDid not bat')
      expect(card).toHaveTextContent('BowlingDid not bowl')
      expect(card).toHaveTextContent('Fielding–')
      expect(within(card).getByTestId('award-potm')).toHaveTextContent('POTM')
      expect(within(card).getByTestId('award-team')).toHaveTextContent('Team POTM')
    })
  })

  describe('cells', () => {
    it('a batted innings shows runs with a star when not out, balls and how out in lowercase words', async () => {
      await showRows(
        makeMatchRow({
          n: 1,
          batting: { status: 'BATTED', innings: [{ runs: 87, balls: 60, notOut: true, howOut: 'NOT_OUT', fours: null, sixes: null }], inningsCount: 1, runs: 87, ballsFaced: 60 },
        }),
      )
      const cells = cellsOf(firstRow())
      expect(cells[3]).toHaveTextContent('87*')
      expect(cells[4]).toHaveTextContent('60')
      expect(cells[5]).toHaveTextContent('not out')
    })

    it('balls are a dash when null', async () => {
      await showRows(
        makeMatchRow({
          batting: { status: 'BATTED', innings: [{ runs: 12, balls: null, notOut: false, howOut: 'LBW', fours: null, sixes: null }], inningsCount: 1, runs: 12, ballsFaced: null },
        }),
      )
      const cells = cellsOf(firstRow())
      expect(cells[3]).toHaveTextContent('12')
      expect(cells[4]).toHaveTextContent('–')
      expect(cells[5]).toHaveTextContent(/^lbw$/)
    })

    it('several innings are listed one per line with "N innings"', async () => {
      await showRows(
        makeMatchRow({
          batting: {
            status: 'BATTED',
            innings: [
              { runs: 40, balls: 30, notOut: false, howOut: 'BOWLED', fours: null, sixes: null },
              { runs: 32, balls: 25, notOut: true, howOut: 'NOT_OUT', fours: null, sixes: null },
            ],
            inningsCount: 2, runs: 72, ballsFaced: 55,
          },
        }),
      )
      const cells = cellsOf(firstRow())
      expect(cells[3]).toHaveTextContent('72')
      expect(cells[3]).toHaveTextContent('2 innings')
      expect(cells[4]).toHaveTextContent('55')
      expect(within(cells[5]).getAllByText(/./).map((line) => line.textContent)).toEqual(['bowled', 'not out'])
    })

    it('Did not bat and Did not bowl are muted words, not figures', async () => {
      await showRows(makeMatchRow({ batting: { status: 'DID_NOT_BAT' }, bowling: { status: 'DID_NOT_BOWL' } }))
      const row = firstRow()
      expect(within(row).getByText('Did not bat')).toBeInTheDocument()
      expect(within(row).getByText('Did not bowl')).toBeInTheDocument()
      expect(row).not.toHaveTextContent('/')
    })

    it('a NO_CARD block is a dash', async () => {
      await showRows(makeMatchRow({ batting: { status: 'NO_CARD' }, bowling: { status: 'NO_CARD' }, fielding: { status: 'RECORDED', catches: 0, stumpings: 0, runOuts: 0 } }))
      const cells = cellsOf(firstRow())
      for (const index of [3, 4, 5, 6, 7]) expect(cells[index]).toHaveTextContent(/^–$/)
    })

    it('a match with no scorecard at all shows the result and one merged note, with no zeros and no figure words', async () => {
      await showRows(noScorecardRow(1, { result: 'LOST' }))
      const row = firstRow()
      expect(screen.getAllByText('No scorecard captured')).toHaveLength(1)
      expect(within(row).getByTestId('match-result')).toHaveTextContent('Lost')
      expect(row).not.toHaveTextContent(/Did not|mdn| ov\b|\b0\b/)
      // the note spans the figure columns
      expect(within(row).getByText('No scorecard captured')).toHaveAttribute('aria-colspan', '5')
    })

    it('shows the bowling cell as wickets over runs with overs, maidens and dots', async () => {
      await showRows(makeMatchRow())
      const bowling = cellsOf(firstRow())[6]
      expect(bowling).toHaveTextContent('2/21')
      expect(bowling).toHaveTextContent('4.0 ov · 1 mdn · 8 dots')
    })

    it('leaves the dots out when not recorded and counts overs by the match balls per over', async () => {
      await showRows(
        makeMatchRow({
          ballsPerOver: 8,
          bowling: { status: 'BOWLED', balls: 22, maidens: 0, runs: 14, wickets: 0, dots: null },
        }),
      )
      const bowling = cellsOf(firstRow())[6]
      // a real zero stays a zero for a bowler who bowled
      expect(bowling).toHaveTextContent('0/14')
      expect(bowling).toHaveTextContent('2.6 ov · 0 mdn')
      expect(bowling).not.toHaveTextContent('dots')
    })

    it('fielding names only the non-zero credits as ct/st/ro, and is a dash when all are zero', async () => {
      await showRows(
        makeMatchRow({ n: 1, fielding: { status: 'RECORDED', catches: 2, stumpings: 1, runOuts: 1 } }),
        makeMatchRow({ n: 2, fielding: { status: 'RECORDED', catches: 0, stumpings: 0, runOuts: 1 } }),
        makeMatchRow({ n: 3, fielding: { status: 'RECORDED', catches: 0, stumpings: 0, runOuts: 0 } }),
      )
      const rows = rowsOnScreen()
      expect(cellsOf(rows[0])[7]).toHaveTextContent(/^2 ct · 1 st · 1 ro$/)
      expect(cellsOf(rows[1])[7]).toHaveTextContent(/^1 ro$/)
      expect(cellsOf(rows[2])[7]).toHaveTextContent(/^–$/)
    })

    it('shows Friendly for a friendly and the league name otherwise', async () => {
      await showRows(makeMatchRow({ n: 1 }), makeMatchRow({ n: 2, competition: 'FRIENDLY', leagueId: null, leagueName: null }))
      expect(cellsOf(rowsOnScreen()[0])[1]).toHaveTextContent('Premier League')
      expect(cellsOf(rowsOnScreen()[1])[1]).toHaveTextContent('Friendly')
    })

    it('a derby row reads Internal match with both teams and the Internal badge', async () => {
      await showRows(
        makeMatchRow({
          derby: true, opponentName: null, result: 'INTERNAL',
          ourTeams: [{ side: 'HOME', teamId: 'a', teamName: 'U15 A' }, { side: 'AWAY', teamId: 'b', teamName: 'U15 B' }],
        }),
      )
      const opponent = cellsOf(firstRow())[0]
      expect(opponent).toHaveTextContent('Internal match')
      expect(opponent).toHaveTextContent('U15 A v U15 B')
      expect(within(firstRow()).getByTestId('match-result')).toHaveTextContent('Internal')
      expect(within(firstRow()).getByRole('link', { name: '14 March 2026 against an internal match, open result' })).toBeInTheDocument()
    })

    it.each<[PlayerMatchResultCode, string]>([
      ['WON', 'Won'],
      ['LOST', 'Lost'],
      ['TIED', 'Tied'],
      ['DRAWN', 'Drawn'],
      ['NO_RESULT', 'No result'],
      ['ABANDONED', 'Abandoned'],
      ['INTERNAL', 'Internal'],
    ])('the %s result is a badge with the text "%s", not colour alone', async (result, label) => {
      await showRows(makeMatchRow({ result }))
      expect(within(firstRow()).getByTestId('match-result')).toHaveTextContent(new RegExp(`^${label}$`))
    })

    it('shows the award markers with accessible names, only for the awards the player holds', async () => {
      await showRows(
        makeMatchRow({ n: 1, awards: { playerOfTheMatch: 1, teamPlayerOfTheMatch: 0 } }),
        makeMatchRow({ n: 2, awards: { playerOfTheMatch: 0, teamPlayerOfTheMatch: 1 } }),
        makeMatchRow({ n: 3, awards: { playerOfTheMatch: 1, teamPlayerOfTheMatch: 1 } }),
        makeMatchRow({ n: 4 }),
      )
      const rows = rowsOnScreen()
      expect(within(rows[0]).getByRole('img', { name: 'Player of the match' })).toBeInTheDocument()
      expect(within(rows[0]).queryByRole('img', { name: 'Team player of the match' })).not.toBeInTheDocument()
      expect(within(rows[1]).getByRole('img', { name: 'Team player of the match' })).toBeInTheDocument()
      expect(within(rows[2]).getAllByRole('img').map((icon) => icon.getAttribute('aria-label'))).toEqual(['Player of the match', 'Team player of the match'])
      expect(within(rows[3]).queryAllByRole('img')).toHaveLength(0)
    })
  })

  describe('tiles and counts', () => {
    it('shows the Matches, Runs, Wickets and Catches tiles from the stats the page holds, and no Total row', async () => {
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      expect(within(screen.getByTestId('stat-tiles')).getAllByTestId(/^tile-/).filter((tile) => !tile.dataset.testid?.endsWith('-value'))).toHaveLength(4)
      expect(screen.getByTestId('tile-matches-value')).toHaveTextContent('3')
      expect(screen.getByTestId('tile-runs-value')).toHaveTextContent('412')
      expect(screen.getByTestId('tile-wickets-value')).toHaveTextContent('21')
      expect(screen.getByTestId('tile-catches-value')).toHaveTextContent('9')
      expect(screen.queryByText(/^Total/)).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Total for the filtered matches')).not.toBeInTheDocument()
    })

    it('shows a dash for a figure the stats do not have', async () => {
      server.stats = makeStats({ matchesCounted: 3 }, { batting: { runs: null }, fielding: { catches: null } })
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      expect(screen.getByTestId('tile-runs-value')).toHaveTextContent('–')
      expect(screen.getByTestId('tile-catches-value')).toHaveTextContent('–')
      expect(screen.getByTestId('tile-wickets-value')).toHaveTextContent('21')
    })

    it('shows the strip for a single match', async () => {
      await showRows(makeMatchRow())
      expect(screen.getByTestId('stat-tiles')).toBeInTheDocument()
      expect(screen.getByTestId('matches-footer')).toHaveTextContent('Showing 1 of 1 match')
    })

    it('omits the strip when the list has no matches, and says so', async () => {
      server.rows = []
      server.stats = makeStats({ matchesCounted: 5 })
      renderPage()
      expect(await screen.findByText('No matches to show for these filters.', {}, wait)).toBeInTheDocument()
      expect(screen.queryByTestId('stat-tiles')).not.toBeInTheDocument()
      expect(screen.queryByTestId('matches-footer')).not.toBeInTheDocument()
    })

    it('says "Showing N of M matches" from the server total', async () => {
      server.rows = makeRows(45)
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      expect(screen.getByTestId('matches-footer')).toHaveTextContent('Showing 20 of 45 matches')
    })
  })

  describe('Show more', () => {
    it('requests the next page, appends the rows (never slices), and disappears when hasMore is false', async () => {
      server.rows = makeRows(45)
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      expect(rowsOnScreen()).toHaveLength(20)

      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      await waitFor(() => expect(rowsOnScreen()).toHaveLength(40))
      expect(server.calls.map((call) => call.page)).toEqual([0, 1])
      expect(server.calls[1].size).toBe(20)
      // the first page is still there, and the new rows follow it in server order
      expect(cellsOf(rowsOnScreen()[0])[0]).toHaveTextContent('Opponent 1')
      expect(cellsOf(rowsOnScreen()[20])[0]).toHaveTextContent('Opponent 21')
      expect(screen.getByTestId('matches-footer')).toHaveTextContent('Showing 40 of 45 matches')

      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      await waitFor(() => expect(rowsOnScreen()).toHaveLength(45))
      expect(screen.getByTestId('matches-footer')).toHaveTextContent('Showing 45 of 45 matches')
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    })

    it('is not offered when everything fits on one page', async () => {
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    })

    it('shows a busy, disabled button while the next page loads and keeps the rows', async () => {
      server.rows = makeRows(45)
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      let release: () => void = () => undefined
      const gate = new Promise<void>((resolve) => { release = resolve })
      apiGet.mockImplementation(async (url: string, config?: unknown) => {
        if (url.endsWith('/stats/matches')) await gate
        return playerMatchesApi(server).get(url, config as never)
      })

      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      const busy = await screen.findByRole('button', { name: 'Loading...' })
      expect(busy).toBeDisabled()
      expect(rowsOnScreen()).toHaveLength(20)

      release()
      await waitFor(() => expect(rowsOnScreen()).toHaveLength(40))
    })

    it('keeps the rows and offers Try again when the next page fails, then loads it', async () => {
      server.rows = makeRows(45)
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      const pages = server.matches
      let failOnce = true
      server.matches = (params) => {
        if (params.page === 1 && failOnce) {
          failOnce = false
          return new Error('boom')
        }
        return pages(params)
      }

      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      expect(await screen.findByText("Couldn't load more matches")).toBeInTheDocument()
      expect(rowsOnScreen()).toHaveLength(20)

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      await waitFor(() => expect(rowsOnScreen()).toHaveLength(40))
      expect(screen.queryByText("Couldn't load more matches")).not.toBeInTheDocument()
    })

    it('works the same on a phone', async () => {
      setViewport(false)
      server.rows = makeRows(25)
      renderPage()
      expect(await screen.findAllByTestId('match-card', {}, wait)).toHaveLength(20)
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      await waitFor(() => expect(screen.getAllByTestId('match-card')).toHaveLength(25))
      expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()
    })
  })

  describe('Date sort', () => {
    it('the Date heading is a button with aria-sort that starts newest first', async () => {
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      const button = screen.getByRole('button', { name: 'Date, sorted newest first; click to reverse' })
      expect(button.closest('[role="columnheader"]')).toHaveAttribute('aria-sort', 'descending')
      expect(search().has('dir')).toBe(false)
    })

    it('a click reverses: direction=asc is sent, ?dir=asc is in the URL and the rows reload from page 0', async () => {
      server.rows = makeRows(45)
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      await userEvent.click(screen.getByRole('button', { name: 'Show more' }))
      await waitFor(() => expect(rowsOnScreen()).toHaveLength(40))

      await userEvent.click(screen.getByRole('button', { name: 'Date, sorted newest first; click to reverse' }))

      expect(search().get('dir')).toBe('asc')
      expect(search().get('tab')).toBe('matches')
      await waitFor(() => expect(lastCall()).toMatchObject({ direction: 'asc', page: 0 }))
      await waitFor(() => expect(rowsOnScreen()).toHaveLength(20))
      expect(cellsOf(firstRow())[0]).toHaveTextContent('Opponent 45')
      const button = screen.getByRole('button', { name: 'Date, sorted oldest first; click to reverse' })
      expect(button.closest('[role="columnheader"]')).toHaveAttribute('aria-sort', 'ascending')

      await userEvent.click(button)
      expect(search().has('dir')).toBe(false)
      // the cached newest-first pages are re-read from the first page
      await waitFor(() => expect(server.calls.some((call, index) => index > 1 && call.direction === 'desc' && call.page === 0)).toBe(true))
    })

    it('honours ?dir=asc on load', async () => {
      renderPage(`${MATCHES}&dir=asc`)
      await screen.findAllByTestId('match-row', {}, wait)
      expect(server.calls[0].direction).toBe('asc')
      expect(cellsOf(firstRow())[0]).toHaveTextContent('Opponent 3')
    })

    it('a phone has the same sort control, which reverses the list', async () => {
      setViewport(false)
      renderPage()
      await screen.findAllByTestId('match-card', {}, wait)
      await userEvent.click(screen.getByRole('button', { name: 'Date, sorted newest first; click to reverse' }))
      expect(search().get('dir')).toBe('asc')
      expect(await screen.findByRole('button', { name: 'Date, sorted oldest first; click to reverse' })).toBeInTheDocument()
    })
  })

  describe('opening a match', () => {
    it('each row links to /manage/results/:matchId with the date and opponent in its accessible name', async () => {
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      const links = screen.getAllByRole('link', { name: /open result/ })
      expect(links).toHaveLength(3)
      expect(links[0]).toHaveAccessibleName('28 March 2026 against Opponent 1, open result')
      expect(links.map((link) => link.getAttribute('href'))).toEqual(['/manage/results/match-1', '/manage/results/match-2', '/manage/results/match-3'])
    })

    it('carries router state { backTo, backLabel: "Matches" } and lands on the result page', async () => {
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      const state = await openBackState()
      expect(screen.getByTestId('result-path')).toHaveTextContent('/manage/results/match-1')
      expect(state.backLabel).toBe('Matches')
      expect(state.url.pathname).toBe('/manage/players/player-1/stats')
    })

    it('backTo always writes tab, Season and League (empty when none) and leaves the unset filters out', async () => {
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      const { url } = await openBackState()
      expect(url.searchParams.get('tab')).toBe('matches')
      expect(url.searchParams.has('seasonId')).toBe(true)
      expect(url.searchParams.get('seasonId')).toBe('')
      expect(url.searchParams.has('leagueId')).toBe(true)
      expect(url.searchParams.get('leagueId')).toBe('')
      for (const key of ['teamId', 'sectionId', 'competition', 'dir']) expect(url.searchParams.has(key)).toBe(false)
    })

    it('backTo carries every filter that is set', async () => {
      renderPage(`${MATCHES}&seasonId=season-1&leagueId=league-1&teamId=team-1&sectionId=u15a&competition=LEAGUE`)
      await screen.findAllByTestId('match-row', {}, wait)
      const { url } = await openBackState()
      expect(Object.fromEntries(url.searchParams)).toEqual({
        tab: 'matches', seasonId: 'season-1', leagueId: 'league-1', teamId: 'team-1', sectionId: 'u15a', competition: 'LEAGUE',
      })
    })

    it('backTo follows a filter changed on the page and carries dir=asc when reversed', async () => {
      renderPage()
      await screen.findAllByTestId('match-row', {}, wait)
      await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
      await userEvent.click(await screen.findByRole('option', { name: '2026/27' }))
      await userEvent.click(screen.getByRole('button', { name: 'Date, sorted newest first; click to reverse' }))
      await waitFor(() => expect(lastCall()).toMatchObject({ seasonId: 'season-1', direction: 'asc', page: 0 }))
      await screen.findAllByTestId('match-row')

      const { url } = await openBackState()
      expect(url.searchParams.get('seasonId')).toBe('season-1')
      expect(url.searchParams.get('dir')).toBe('asc')
    })

    it('a phone card links the same way', async () => {
      setViewport(false)
      renderPage()
      await screen.findAllByTestId('match-card', {}, wait)
      const state = await openBackState()
      expect(screen.getByTestId('result-path')).toHaveTextContent('/manage/results/match-1')
      expect(state.backLabel).toBe('Matches')
    })
  })

  describe('loading, error and empty states', () => {
    it('shows skeleton rows while the first page loads', async () => {
      apiGet.mockImplementation(async (url: string, config?: unknown) => {
        if (url.endsWith('/stats/matches')) return new Promise(() => undefined)
        return playerMatchesApi(server).get(url, config as never)
      })
      renderPage()
      const loading = await screen.findByTestId('matches-loading', {}, wait)
      expect(loading).toHaveAttribute('aria-busy', 'true')
      expect(loading).toHaveAttribute('aria-label', 'Loading matches')
      expect(rowsOnScreen()).toHaveLength(0)
      expect(screen.queryByTestId('matches-footer')).not.toBeInTheDocument()
    })

    it('shows the phone skeletons on a phone', async () => {
      setViewport(false)
      apiGet.mockImplementation(async (url: string, config?: unknown) => {
        if (url.endsWith('/stats/matches')) return new Promise(() => undefined)
        return playerMatchesApi(server).get(url, config as never)
      })
      renderPage()
      expect(await screen.findByTestId('matches-loading', {}, wait)).toBeInTheDocument()
    })

    it('shows "Couldn\'t load the matches" with Try again, keeps the tabs and filters, and recovers', async () => {
      server.matches = () => new Error('boom')
      renderPage()
      expect(await screen.findByText("Couldn't load the matches", {}, wait)).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('combobox', { name: 'Season' })).toBeInTheDocument()
      expect(rowsOnScreen()).toHaveLength(0)

      server.matches = (params) => pageOf(server.rows, params)
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(await screen.findAllByTestId('match-row', {}, wait)).toHaveLength(3)
      expect(screen.queryByText("Couldn't load the matches")).not.toBeInTheDocument()
    })

    it('a player with no published results keeps the page empty state, the tab strip and no list', async () => {
      server.rows = []
      server.stats = makeStats({ matchesCounted: 0, resultsWithBattingCard: 0, resultsWithBowlingCard: 0 })
      renderPage()
      expect(await screen.findByText('No published results yet', {}, wait)).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.queryByTestId('matches-tab')).not.toBeInTheDocument()
      expect(server.calls).toHaveLength(0)
    })

    it('filters that match nothing keep the page "No published results match these filters" with Clear filters', async () => {
      server.rows = []
      server.stats = makeStats({ matchesCounted: 0, resultsWithBattingCard: 0, resultsWithBowlingCard: 0 })
      renderPage(`${MATCHES}&competition=FRIENDLY`)
      expect(await screen.findByText('No published results match these filters', {}, wait)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      await waitFor(() => expect(screen.queryByText('No published results match these filters')).not.toBeInTheDocument())
    })
  })
})
