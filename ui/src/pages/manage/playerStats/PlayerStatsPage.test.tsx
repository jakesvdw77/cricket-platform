import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PlayerStatsPage from './PlayerStatsPage'

// docs/specs/103-player-stats.md, "The full breakdown page" and decisions 15 to 27. The api modules are mocked; the figures are
// the server's, so these tests check what the page asks for and how it shows what comes back.
const usePlayerStats = vi.fn()
const usePlayerStatsFilterOptions = vi.fn()
const usePlayerMatches = vi.fn()
vi.mock('../../../api/playerStatsApi', () => ({
  usePlayerStats: (...args: unknown[]) => usePlayerStats(...args),
  usePlayerStatsFilterOptions: (...args: unknown[]) => usePlayerStatsFilterOptions(...args),
  usePlayerMatches: (...args: unknown[]) => usePlayerMatches(...args),
}))
vi.mock('../../../api/playerApi', () => ({
  listPlayers: () =>
    Promise.resolve([{ id: 'player-1', firstName: 'Sam', lastName: 'Visser', active: true, verificationStatus: 'VERIFIED', sectionIds: [] }]),
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
vi.mock('../../../api/leagueApi', () => ({
  listLeagues: () => Promise.resolve([{ id: 'league-1', name: 'Premier League' }, { id: 'league-2', name: 'Second League' }]),
}))
vi.mock('../../../api/sectionApi', () => ({
  listSections: () =>
    Promise.resolve([section('club', 'Club'), section('seniors', 'Seniors', 'club'), section('juniors', 'Juniors', 'club'), section('u15', 'U15', 'juniors'), section('u15a', 'U15A', 'u15'), section('u13', 'U13', 'juniors')]),
}))
vi.mock('../../../api/teamApi', () => ({
  listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: 'Villagers 1' }, { id: 'team-2', name: 'Villagers 2' }]),
}))

const OPTIONS = { seasonIds: ['season-1'], leagueIds: ['league-1'], teamIds: ['team-1'], sectionIds: ['u15a'], competitions: ['LEAGUE'] }

function makeStats(overrides: Record<string, unknown> = {}) {
  return {
    playerId: 'player-1',
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, teamId: null, competition: null },
    basis: { matchesCounted: 18, resultsWithBattingCard: 14, resultsWithBowlingCard: 12 },
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
    notCaptured: [
      { code: 'BATTING_DOT_BALL_PERCENTAGE', tab: 'BATTING', label: 'Dot ball percentage', reason: 'the scorecard does not record dot balls faced' },
      { code: 'BOUNDARIES_CONCEDED', tab: 'BOWLING', label: 'Boundaries conceded', reason: 'not recorded per bowler' },
      { code: 'WICKETKEEPER_DISMISSALS', tab: 'FIELDING', label: 'Wicketkeeper dismissals', reason: 'not recorded' },
    ],
    ...overrides,
  }
}

const EMPTY_BASIS = { matchesCounted: 0, resultsWithBattingCard: 0, resultsWithBowlingCard: 0 }

function LocationProbe() {
  return <div data-testid="location">{useLocation().search}</div>
}

function renderPage(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <LocationProbe />
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId: 'club-1' }} />}>
            <Route path="players/:playerId/stats" element={<PlayerStatsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const BASE = '/manage/players/player-1/stats'
const wait = { timeout: 5000 }
const lastFilters = () => usePlayerStats.mock.calls[usePlayerStats.mock.calls.length - 1][2] as Record<string, unknown>
const fieldValue = (label: string) =>
  screen.getAllByTestId('player-info-field').find((field) => field.textContent?.startsWith(label)) as HTMLElement
// The card around a title: the nearest ancestor that holds a list.
function cardAround(title: HTMLElement): HTMLElement {
  let node: HTMLElement | null = title
  while (node && within(node).queryAllByRole('listitem').length === 0) node = node.parentElement
  return node as HTMLElement
}
async function optionsOf(name: string) {
  await userEvent.click(await screen.findByRole('combobox', { name }, wait))
  const names = (await screen.findAllByRole('option')).map((option) => option.textContent)
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument())
  return names
}

describe('PlayerStatsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    usePlayerStats.mockReset()
    usePlayerStatsFilterOptions.mockReset()
    usePlayerMatches.mockReset()
    usePlayerMatches.mockReturnValue({ rows: [], firstPage: undefined, lastPage: undefined, isError: false, isFetching: true, hasNextPage: false, refetch: vi.fn() })
    usePlayerStats.mockReturnValue({ data: makeStats(), isError: false, refetch: vi.fn() })
    usePlayerStatsFilterOptions.mockReturnValue({ data: OPTIONS })
  })

  describe('tabs', () => {
    it('opens on Batting with the basis line, and only the batting item in Not captured yet', async () => {
      renderPage(BASE)
      expect(await screen.findByRole('heading', { name: 'Sam Visser' }, wait)).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Batting' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByTestId('tile-highest-value')).toHaveTextContent('94*')
      expect(screen.getByTestId('not-captured-panel')).toHaveTextContent('Dot ball percentage')
      expect(screen.getByTestId('not-captured-panel')).not.toHaveTextContent('Boundaries conceded')
    })

    it.each([
      ['bowling', 'Bowling'],
      ['fielding', 'Fielding'],
      ['awards', 'Awards & record'],
    ])('?tab=%s selects the %s tab', async (value, label) => {
      renderPage(`${BASE}?tab=${value}`)
      expect(await screen.findByRole('tab', { name: label }, wait)).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByRole('tab', { name: 'Batting' })).toHaveAttribute('aria-selected', 'false')
    })

    it('an unknown ?tab= value falls back to Batting', async () => {
      renderPage(`${BASE}?tab=nonsense`)
      expect(await screen.findByRole('tab', { name: 'Batting' }, wait)).toHaveAttribute('aria-selected', 'true')
      expect(await screen.findByTestId('tile-runs-value')).toHaveTextContent('412')
    })

    it('clicking a tab writes ?tab= and keeps the other parameters', async () => {
      renderPage(`${BASE}?seasonId=season-1`)
      await userEvent.click(await screen.findByRole('tab', { name: 'Bowling' }, wait))
      const search = new URLSearchParams(screen.getByTestId('location').textContent ?? '')
      expect(search.get('tab')).toBe('bowling')
      expect(search.get('seasonId')).toBe('season-1')
      expect(await screen.findByTestId('tile-wickets-value')).toHaveTextContent('21')
    })

    it('Fielding no longer shows the awards and the record', async () => {
      renderPage(`${BASE}?tab=fielding`)
      expect(await screen.findByTestId('tile-catches-value', {}, wait)).toHaveTextContent('9')
      expect(screen.queryByText('Record while playing')).not.toBeInTheDocument()
      expect(screen.queryByText('Awards')).not.toBeInTheDocument()
      expect(screen.queryByTestId('tile-potm')).not.toBeInTheDocument()
      expect(screen.getByTestId('not-captured-panel')).toHaveTextContent('Wicketkeeper dismissals')
    })

    it('Awards & record shows the awards and the record, and no dismissals', async () => {
      renderPage(`${BASE}?tab=awards`)
      expect(await screen.findByText('Record while playing', {}, wait)).toBeInTheDocument()
      expect(screen.getByText('Awards')).toBeInTheDocument()
      expect(screen.getByTestId('tile-potm-value')).toHaveTextContent('4')
      expect(screen.getByTestId('tile-won-value')).toHaveTextContent('11')
      expect(screen.queryByText('Dismissals')).not.toBeInTheDocument()
    })
  })

  describe('filters', () => {
    it('offer only what the player has data for: no club-wide teams, sections plus ancestors, no Friendlies', async () => {
      renderPage(BASE)
      expect(await optionsOf('Season')).toEqual(['All seasons', '2026/27'])
      expect(await optionsOf('League')).toEqual(['All leagues', 'Premier League'])
      expect(await optionsOf('Team')).toEqual(['All teams', 'Villagers 1'])
      expect(await optionsOf('Competition')).toEqual(['All competitions', 'League'])

      await userEvent.click(screen.getByLabelText('Section'))
      await screen.findAllByRole('treeitem')
      for (const name of ['Club', 'Juniors', 'U15', 'U15A']) expect(screen.getByText(name)).toBeInTheDocument()
      expect(screen.queryByText('Seniors')).not.toBeInTheDocument()
      expect(screen.queryByText('U13')).not.toBeInTheDocument()
    })

    it('offers nothing until the filter-options response has loaded', async () => {
      usePlayerStatsFilterOptions.mockReturnValue({ data: undefined })
      renderPage(BASE)
      await screen.findByRole('heading', { name: 'Sam Visser' }, wait)
      expect(screen.queryByRole('combobox', { name: 'Team' })).not.toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Season' })).not.toBeInTheDocument()
    })

    it('sends no filter at first (career), then each choice as a parameter', async () => {
      renderPage(BASE)
      await screen.findByRole('heading', { name: 'Sam Visser' }, wait)
      expect(lastFilters()).toEqual({ seasonId: null, leagueId: null, teamId: null, sectionId: null, competition: null })

      await userEvent.click(await screen.findByRole('combobox', { name: 'Season' }, wait))
      await userEvent.click(await screen.findByRole('option', { name: '2026/27' }))
      await waitFor(() => expect(lastFilters().seasonId).toBe('season-1'))

      await userEvent.click(screen.getByRole('combobox', { name: 'Team' }))
      await userEvent.click(await screen.findByRole('option', { name: 'Villagers 1' }))
      await waitFor(() => expect(lastFilters().teamId).toBe('team-1'))

      await userEvent.click(screen.getByRole('combobox', { name: 'Competition' }))
      await userEvent.click(await screen.findByRole('option', { name: 'League' }))
      await waitFor(() => expect(lastFilters().competition).toBe('LEAGUE'))
    })

    it('saves Season and League per club, but not Team or Competition', async () => {
      renderPage(BASE)
      await userEvent.click(await screen.findByRole('combobox', { name: 'Season' }, wait))
      await userEvent.click(await screen.findByRole('option', { name: '2026/27' }))
      await userEvent.click(screen.getByRole('combobox', { name: 'Team' }))
      await userEvent.click(await screen.findByRole('option', { name: 'Villagers 1' }))
      await waitFor(() => expect(JSON.parse(localStorage.getItem('playerStats:filters:club-1') as string)).toEqual({ seasonId: 'season-1', leagueId: null }))
    })

    it('uses a saved Season that is still offered', async () => {
      localStorage.setItem('playerStats:filters:club-1', JSON.stringify({ seasonId: 'season-1', leagueId: 'league-1' }))
      renderPage(BASE)
      await waitFor(() => expect(lastFilters()).toMatchObject({ seasonId: 'season-1', leagueId: 'league-1' }), wait)
    })

    it('a saved Season that is no longer offered falls back to All seasons', async () => {
      localStorage.setItem('playerStats:filters:club-1', JSON.stringify({ seasonId: 'season-2', leagueId: 'league-2' }))
      renderPage(BASE)
      expect(await screen.findByRole('combobox', { name: 'Season' }, wait)).toHaveTextContent('All seasons')
      await waitFor(() => expect(lastFilters()).toMatchObject({ seasonId: null, leagueId: null }))
      expect(screen.getByRole('combobox', { name: 'League' })).toHaveTextContent('All leagues')
    })

    it('hides the filter bar for a player with no published result at all', async () => {
      usePlayerStats.mockReturnValue({ data: makeStats({ basis: EMPTY_BASIS }), isError: false, refetch: vi.fn() })
      renderPage(BASE)
      expect(await screen.findByText('No published results yet', {}, wait)).toBeInTheDocument()
      expect(screen.queryByRole('combobox', { name: 'Season' })).not.toBeInTheDocument()
    })
  })

  describe('links from a leaderboard row (?seasonId&leagueId&teamId&sectionId)', () => {
    it('are honoured over the saved choice, without overwriting it', async () => {
      localStorage.setItem('playerStats:filters:club-1', JSON.stringify({ seasonId: null, leagueId: null }))
      renderPage(`${BASE}?seasonId=season-1&leagueId=league-1&teamId=team-1&sectionId=u15a`)
      await waitFor(() => expect(lastFilters()).toEqual({ seasonId: 'season-1', leagueId: 'league-1', teamId: 'team-1', sectionId: 'u15a', competition: null }), wait)
      expect(JSON.parse(localStorage.getItem('playerStats:filters:club-1') as string)).toEqual({ seasonId: null, leagueId: null })
    })

    it('an empty seasonId means All seasons even when a season is saved', async () => {
      localStorage.setItem('playerStats:filters:club-1', JSON.stringify({ seasonId: 'season-1', leagueId: 'league-1' }))
      renderPage(`${BASE}?seasonId=&leagueId=&teamId=&sectionId=`)
      await screen.findByRole('heading', { name: 'Sam Visser' }, wait)
      await waitFor(() => expect(lastFilters()).toEqual({ seasonId: null, leagueId: null, teamId: null, sectionId: null, competition: null }))
    })

    it('are read once: after the person changes the Season the link value does not come back', async () => {
      renderPage(`${BASE}?seasonId=season-1&teamId=team-1`)
      await waitFor(() => expect(lastFilters()).toMatchObject({ seasonId: 'season-1', teamId: 'team-1' }), wait)
      await userEvent.click(await screen.findByRole('combobox', { name: 'Season' }))
      await userEvent.click(await screen.findByRole('option', { name: 'All seasons' }))
      await waitFor(() => expect(lastFilters()).toMatchObject({ seasonId: null, teamId: 'team-1' }))
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Season' })).toHaveTextContent('All seasons'))
    })
  })

  describe('basis and coverage', () => {
    it('states the basis per tab', async () => {
      renderPage(BASE)
      expect(await screen.findByTestId('stats-basis', {}, wait)).toHaveTextContent('Based on 18 published results with this player on the team list: 14 with a batting card.')
      await userEvent.click(screen.getByRole('tab', { name: 'Bowling' }))
      expect(screen.getByTestId('stats-basis')).toHaveTextContent('Based on 18 published results with this player on the team list: 12 with a bowling card.')
      await userEvent.click(screen.getByRole('tab', { name: 'Fielding' }))
      expect(screen.getByTestId('stats-basis')).toHaveTextContent('Based on 18 published results with this player on the team list.')
    })

    it('says "1 published result" in the singular', async () => {
      usePlayerStats.mockReturnValue({ data: makeStats({ basis: { matchesCounted: 1, resultsWithBattingCard: 1, resultsWithBowlingCard: 0 } }), isError: false, refetch: vi.fn() })
      renderPage(BASE)
      expect(await screen.findByTestId('stats-basis', {}, wait)).toHaveTextContent('Based on 1 published result with')
    })

    it('captions only the optional figures that part of the innings recorded', async () => {
      renderPage(BASE)
      await screen.findByTestId('stats-basis', {}, wait)
      // balls recorded in 9 of 14, boundaries in all 14
      expect(fieldValue('Balls faced')).toHaveTextContent('from 9 of 14 innings that recorded balls')
      expect(fieldValue('Strike rate')).toHaveTextContent('from 9 of 14 innings that recorded balls')
      expect(fieldValue('Fours')).not.toHaveTextContent('from')
      expect(screen.getByTestId('tile-strike-rate')).toHaveTextContent('from 9 of 14 innings')
      await userEvent.click(screen.getByRole('tab', { name: 'Bowling' }))
      expect(fieldValue('Wides')).toHaveTextContent('from 10 of 12 innings')
      expect(fieldValue('No-balls')).not.toHaveTextContent('from')
    })

    it('shows Dot balls as a dash when no innings recorded dots', async () => {
      renderPage(`${BASE}?tab=bowling`)
      await screen.findByTestId('tile-wickets', {}, wait)
      expect(fieldValue('Dot balls')).toHaveTextContent('–')
      expect(fieldValue('Dot balls')).not.toHaveTextContent(/^Dot balls0/)
    })
  })

  describe('Batting tab', () => {
    it('lists how dismissed in scorecard order and ends with Not out', async () => {
      renderPage(BASE)
      const card = cardAround(await screen.findByText('How dismissed', {}, wait))
      const rows = within(card).getAllByRole('listitem').map((li) => li.textContent)
      expect(rows).toEqual(['Bowled4', 'Caught5', 'Not out3'])
    })

    it('shows the recent form strip when there are innings', async () => {
      usePlayerStats.mockReturnValue({
        data: makeStats({ form: { batting: [{ matchId: 'm1', matchDate: '', runs: 56, notOut: true, balls: 40 }], bowling: [] } }),
        isError: false,
        refetch: vi.fn(),
      })
      renderPage(BASE)
      expect(await screen.findByText('56*', {}, wait)).toBeInTheDocument()
    })
  })

  describe('Bowling tab', () => {
    it('shows three separate haul counters', async () => {
      usePlayerStats.mockReturnValue({ data: makeStats({ bowling: { ...makeStats().bowling, threeWicketHauls: 2, fourWicketHauls: 1, fiveWicketHauls: 1 } }), isError: false, refetch: vi.fn() })
      renderPage(`${BASE}?tab=bowling`)
      expect(await screen.findByTestId('haul-3', {}, wait)).toHaveTextContent('2')
      expect(screen.getByTestId('haul-3')).toHaveTextContent('3 wickets')
      expect(screen.getByTestId('haul-4')).toHaveTextContent('1')
      expect(screen.getByTestId('haul-4')).toHaveTextContent('4 wickets')
      expect(screen.getByTestId('haul-5')).toHaveTextContent('1')
      expect(screen.getByTestId('haul-5')).toHaveTextContent('5 or more')
    })

    it('shows overs in cricket notation, and Balls Bowled instead when over lengths are mixed', async () => {
      renderPage(`${BASE}?tab=bowling`)
      await screen.findByTestId('tile-wickets', {}, wait)
      expect(fieldValue('Overs')).toHaveTextContent('61.2')
      expect(fieldValue('Balls bowled')).toHaveTextContent('368')
      expect(screen.queryByText('Mixed over lengths')).not.toBeInTheDocument()
    })

    it('mixed over lengths: Overs is a dash with a note and Balls bowled carries the figure', async () => {
      usePlayerStats.mockReturnValue({
        data: makeStats({ bowling: { ...makeStats().bowling, mixedOverLengths: true, ballsPerOver: [5, 6], ballsBowled: 368 } }),
        isError: false,
        refetch: vi.fn(),
      })
      renderPage(`${BASE}?tab=bowling`)
      await screen.findByTestId('tile-wickets', {}, wait)
      expect(fieldValue('Overs')).toHaveTextContent('–')
      expect(fieldValue('Overs')).toHaveTextContent('Mixed over lengths')
      expect(fieldValue('Balls bowled')).toHaveTextContent('368')
    })

    it('lists wickets by type including the ones with no bowler recorded', async () => {
      renderPage(`${BASE}?tab=bowling`)
      const card = cardAround(await screen.findByText('Wickets by type', {}, wait))
      expect(within(card).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Bowled9', 'LBW3', 'Not recorded1'])
    })

    it('only the bowling item is in Not captured yet', async () => {
      renderPage(`${BASE}?tab=bowling`)
      expect(await screen.findByTestId('not-captured-panel', {}, wait)).toHaveTextContent('Boundaries conceded')
      expect(screen.getByTestId('not-captured-panel')).not.toHaveTextContent('Dot ball percentage')
    })

    it('drops the panel when the response lists nothing for the tab', async () => {
      usePlayerStats.mockReturnValue({ data: makeStats({ notCaptured: [] }), isError: false, refetch: vi.fn() })
      renderPage(`${BASE}?tab=bowling`)
      await screen.findByTestId('tile-wickets', {}, wait)
      expect(screen.queryByTestId('not-captured-panel')).not.toBeInTheDocument()
    })
  })

  describe('empty, loading and error states', () => {
    it('shows the no-results empty state with a pointer to Results', async () => {
      usePlayerStats.mockReturnValue({ data: makeStats({ basis: EMPTY_BASIS }), isError: false, refetch: vi.fn() })
      renderPage(BASE)
      expect(await screen.findByText('No published results yet', {}, wait)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to Results' })).toHaveAttribute('href', '/manage/results')
    })

    it('when filters match nothing, says so and Clear filters resets every filter', async () => {
      usePlayerStats.mockImplementation((_club: string, _player: string, filters: { teamId: string | null }) => ({
        data: makeStats(filters.teamId ? { basis: EMPTY_BASIS } : {}),
        isError: false,
        refetch: vi.fn(),
      }))
      renderPage(`${BASE}?teamId=team-1`)
      expect(await screen.findByText('No published results match these filters', {}, wait)).toBeInTheDocument()
      expect(screen.queryByText('No published results yet')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      await waitFor(() => expect(lastFilters()).toEqual({ seasonId: null, leagueId: null, teamId: null, sectionId: null, competition: null }))
      expect(await screen.findByTestId('tile-runs-value')).toHaveTextContent('412')
    })

    it('with appearances but no batting card shows Matches and a plain note, not zeros', async () => {
      usePlayerStats.mockReturnValue({
        data: makeStats({ basis: { matchesCounted: 3, resultsWithBattingCard: 0, resultsWithBowlingCard: 2 } }),
        isError: false,
        refetch: vi.fn(),
      })
      renderPage(BASE)
      expect(await screen.findByText('No batting card has been captured for these results.', {}, wait)).toBeInTheDocument()
      expect(screen.getByTestId('tile-matches-value')).toHaveTextContent('3')
      expect(screen.queryByTestId('tile-runs')).not.toBeInTheDocument()
      await userEvent.click(screen.getByRole('tab', { name: 'Bowling' }))
      expect(screen.queryByText('No bowling card has been captured for these results.')).not.toBeInTheDocument()
      expect(screen.getByTestId('tile-wickets')).toBeInTheDocument()
    })

    it('with appearances but no bowling card says so on the Bowling tab', async () => {
      usePlayerStats.mockReturnValue({
        data: makeStats({ basis: { matchesCounted: 3, resultsWithBattingCard: 3, resultsWithBowlingCard: 0 } }),
        isError: false,
        refetch: vi.fn(),
      })
      renderPage(`${BASE}?tab=bowling`)
      expect(await screen.findByText('No bowling card has been captured for these results.', {}, wait)).toBeInTheDocument()
    })

    it('shows a skeleton while the statistics load', async () => {
      usePlayerStats.mockReturnValue({ data: undefined, isError: false, refetch: vi.fn() })
      renderPage(BASE)
      expect(await screen.findByLabelText('Loading statistics', {}, wait)).toBeInTheDocument()
    })

    it('shows an error with Try again that refetches', async () => {
      const refetch = vi.fn()
      usePlayerStats.mockReturnValue({ data: undefined, isError: true, refetch })
      renderPage(BASE)
      expect(await screen.findByText("Couldn't load the statistics", {}, wait)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      expect(refetch).toHaveBeenCalled()
    })

    it('links back to the player', async () => {
      renderPage(BASE)
      expect(await screen.findByRole('link', { name: 'Back to player' }, wait)).toHaveAttribute('href', '/manage/players/player-1')
    })
  })
})
