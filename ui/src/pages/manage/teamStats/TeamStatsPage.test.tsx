import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TeamStatsPage from './TeamStatsPage'
import { defaultTeamStatsServer, makeForm, makeTeamStats, teamStatsApi } from '../../../test/teamStatsFixtures'
import type { TeamStatsServer } from '../../../test/teamStatsFixtures'
import type { TeamStatsPageData } from '../../../api/teamStatsApi'

// docs/specs/116-team-stats.md ("The team page", Test Plan "Frontend component"): /manage/teams/:teamId/stats through the real
// hooks and query keys over a routed axios mock. The server's figures are shown exactly as sent; nothing is computed here.
let server: TeamStatsServer
const apiGet = vi.fn()
vi.mock('../../../api/axiosConfig', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }))
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
vi.mock('../../../api/sectionApi', () => ({ listSections: () => Promise.resolve([section('club', 'Club'), section('u15a', 'U15A', 'club')]) }))
vi.mock('../../../api/teamApi', () => ({ listTeamsForClub: () => Promise.resolve([{ id: 'team-1', name: 'Villagers 1' }]) }))

// Where the router went and the state it carried (the result page, the back targets).
function Probe({ name }: { name: string }) {
  const location = useLocation()
  return (
    <div>
      <div data-testid="probe-name">{name}</div>
      <div data-testid="probe-path">{`${location.pathname}${location.search}`}</div>
      <div data-testid="probe-state">{JSON.stringify(location.state)}</div>
    </div>
  )
}

const BASE = '/manage/teams/team-1/stats'

function renderPage(path = BASE, state?: unknown, clubId: string | null = 'club-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[{ pathname: path.split('?')[0], search: path.includes('?') ? `?${path.split('?')[1]}` : '', state }]}>
        <Routes>
          <Route path="/manage" element={<Outlet context={{ clubId }} />}>
            <Route path="teams/:teamId/stats" element={<TeamStatsPage />} />
            <Route path="results/:matchId" element={<Probe name="result" />} />
            <Route path="leaderboards" element={<Probe name="leaderboards" />} />
            <Route path="sections/:sectionId/teams/:teamId" element={<Probe name="team-detail" />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const wait = { timeout: 5000 }
const lastPage = () => server.pageCalls[server.pageCalls.length - 1]
const serve = (stats: TeamStatsPageData) => { server.page = () => stats }
const loaded = () => screen.findByTestId('tile-played', {}, wait)
const probeState = () => JSON.parse(screen.getByTestId('probe-state').textContent ?? 'null')

// A card field: its value text and caption (the label, value and optional caption stacked in one box).
function field(card: HTMLElement, label: string) {
  const box = within(card).getAllByTestId('player-info-field').find((entry) => within(entry).queryByText(label))
  if (!box) throw new Error(`no field ${label}`)
  const value = within(box).getByText(label).nextElementSibling as HTMLElement
  return { value: value.textContent, caption: value.nextElementSibling?.textContent ?? null }
}

describe('TeamStatsPage', () => {
  beforeEach(() => {
    localStorage.clear()
    server = defaultTeamStatsServer()
    apiGet.mockReset()
    apiGet.mockImplementation((url: string, config?: unknown) => teamStatsApi(server).get(url, config as never))
  })

  it('shows Not authorized and asks for nothing without a club', () => {
    renderPage(BASE, undefined, null)
    expect(screen.getByText('Not authorized')).toBeInTheDocument()
    expect(apiGet).not.toHaveBeenCalled()
  })

  describe('header and Back', () => {
    it('shows the team name with its status, and a Back to Teams that defaults to the Teams tab', async () => {
      renderPage()
      expect(await screen.findByRole('heading', { level: 1, name: 'Villagers 1' }, wait)).toBeInTheDocument()
      expect(screen.getByTestId('team-status-badge')).toHaveTextContent('Active')
      expect(screen.getByRole('link', { name: 'Back to Teams' })).toHaveAttribute('href', '/manage/leaderboards?tab=teams')
      expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument()
    })

    it('marks an inactive team', async () => {
      serve(makeTeamStats({ active: false }))
      renderPage()
      expect(await screen.findByTestId('team-status-badge', {}, wait)).toHaveTextContent('Inactive')
    })

    it('honours a valid backTo and backLabel from the router state', async () => {
      renderPage(BASE, { backTo: '/manage/leaderboards?tab=teams&sort=runs&dir=asc', backLabel: 'Teams' })
      const back = await screen.findByRole('link', { name: 'Back to Teams' }, wait)
      expect(back).toHaveAttribute('href', '/manage/leaderboards?tab=teams&sort=runs&dir=asc')
    })

    it('uses the label it is given (the team detail page names itself)', async () => {
      renderPage(BASE, { backTo: '/manage/sections/s1/teams/team-1?seasonId=season-2', backLabel: '1st XI' })
      const back = await screen.findByRole('link', { name: 'Back to 1st XI' }, wait)
      expect(back).toHaveAttribute('href', '/manage/sections/s1/teams/team-1?seasonId=season-2')
      await userEvent.click(back)
      expect(await screen.findByTestId('probe-name')).toHaveTextContent('team-detail')
    })

    it('says "previous page" when a valid target has no usable label', async () => {
      renderPage(BASE, { backTo: '/manage/leaderboards', backLabel: '   ' })
      expect(await screen.findByRole('link', { name: 'Back to previous page' }, wait)).toHaveAttribute('href', '/manage/leaderboards')
    })

    it.each([
      ['a protocol-relative address', '//evil.example/manage/x'],
      ['an absolute address', 'https://evil.example/manage/x'],
      ['a script address', 'javascript:alert(1)'],
      ['a path outside /manage/', '/admin/secrets'],
      ['/manage without the trailing slash', '/manage'],
      ['a non-string', 42],
    ])('ignores an unsafe backTo (%s) and goes to the Teams tab', async (_name, backTo) => {
      renderPage(BASE, { backTo, backLabel: 'Evil' })
      const back = await screen.findByRole('link', { name: 'Back to Teams' }, wait)
      expect(back).toHaveAttribute('href', '/manage/leaderboards?tab=teams')
      expect(screen.queryByText(/Evil/)).not.toBeInTheDocument()
    })
  })

  describe('filters', () => {
    it('defaults Season to the current season when the team has data in it and nothing is saved or linked', async () => {
      renderPage()
      await loaded()
      expect(lastPage()).toEqual({ teamId: 'team-1', params: { seasonId: 'season-1' } })
      expect(server.pageCalls.every((call) => call.params.seasonId === 'season-1')).toBe(true)
    })

    it('defaults to All seasons when the current season has no data for this team', async () => {
      server.options = { seasonIds: ['season-2'], leagueIds: [], sectionIds: [], competitions: ['LEAGUE'] }
      renderPage()
      await loaded()
      expect(lastPage()).toEqual({ teamId: 'team-1', params: {} })
    })

    it('keeps All seasons when that was chosen on purpose (saved), and a saved season over the default', async () => {
      localStorage.setItem('teamStats:filters:club-1', JSON.stringify({ seasonId: 'all', leagueId: null }))
      const { unmount } = renderPage()
      await loaded()
      expect(lastPage().params).toEqual({})
      unmount()

      localStorage.setItem('teamStats:filters:club-1', JSON.stringify({ seasonId: 'season-2', leagueId: null }))
      renderPage()
      await waitFor(() => expect(lastPage().params).toEqual({ seasonId: 'season-2' }), wait)
    })

    it('reads the filter options for this team only (teamId is sent)', async () => {
      renderPage()
      await loaded()
      expect(server.optionParams).toEqual([{ teamId: 'team-1' }])
    })

    it('honours Season, League and Competition from the address, once', async () => {
      renderPage(`${BASE}?seasonId=season-2&leagueId=league-1&competition=FRIENDLY`)
      await loaded()
      expect(lastPage().params).toEqual({ seasonId: 'season-2', leagueId: 'league-1', competition: 'FRIENDLY' })
      expect(screen.getByRole('combobox', { name: 'Season' })).toHaveTextContent('2025/26')
      expect(screen.getByRole('combobox', { name: 'League' })).toHaveTextContent('Premier League')
      expect(screen.getByRole('combobox', { name: 'Competition' })).toHaveTextContent('Friendlies')
      // a link never overwrites what the manager saved
      expect(localStorage.getItem('teamStats:filters:club-1')).toBeNull()
    })

    it('an empty Season or League in the address means All and beats the saved choice', async () => {
      localStorage.setItem('teamStats:filters:club-1', JSON.stringify({ seasonId: 'season-1', leagueId: 'league-1' }))
      renderPage(`${BASE}?seasonId=&leagueId=`)
      await loaded()
      expect(lastPage().params).toEqual({})
    })

    it('without an address choice, uses the Season and League saved under teamStats:filters:<clubId>', async () => {
      localStorage.setItem('teamStats:filters:club-1', JSON.stringify({ seasonId: 'season-2', leagueId: 'league-1' }))
      renderPage()
      await waitFor(() => expect(lastPage()?.params).toEqual({ seasonId: 'season-2', leagueId: 'league-1' }), wait)
      await loaded()
    })

    it('ignores a Competition value it does not know, and a saved Season the club does not offer', async () => {
      server.options = { seasonIds: ['season-2'], leagueIds: ['league-1'], sectionIds: [], competitions: ['LEAGUE', 'FRIENDLY'] }
      localStorage.setItem('teamStats:filters:club-1', JSON.stringify({ seasonId: 'season-1', leagueId: null }))
      renderPage(`${BASE}?competition=CUP`)
      await loaded()
      expect(lastPage().params).toEqual({})
    })

    it('offers only the competitions that have counted results', async () => {
      server.options = { seasonIds: ['season-1'], leagueIds: [], sectionIds: [], competitions: ['LEAGUE'] }
      renderPage()
      await loaded()
      await userEvent.click(screen.getByRole('combobox', { name: 'Competition' }))
      expect((await screen.findAllByRole('option')).map((o) => o.textContent)).toEqual(['All competitions', 'League'])
    })

    it('changing Season refetches and saves it; Competition refetches but is not saved', async () => {
      renderPage()
      await loaded()
      await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
      await userEvent.click(await screen.findByRole('option', { name: '2025/26' }))
      await waitFor(() => expect(lastPage().params).toEqual({ seasonId: 'season-2' }), wait)
      await waitFor(() => expect(JSON.parse(localStorage.getItem('teamStats:filters:club-1') as string)).toMatchObject({ seasonId: 'season-2' }))

      await userEvent.click(screen.getByRole('combobox', { name: 'Competition' }))
      await userEvent.click(await screen.findByRole('option', { name: 'League' }))
      await waitFor(() => expect(lastPage().params).toEqual({ seasonId: 'season-2', competition: 'LEAGUE' }), wait)
      expect(JSON.parse(localStorage.getItem('teamStats:filters:club-1') as string)).not.toHaveProperty('competition')
    })
  })

  describe('basis, tiles and form', () => {
    it('states the basis, leaving out every part that is zero', async () => {
      renderPage()
      await loaded()
      expect(screen.getByTestId('stats-basis')).toHaveTextContent(/^Based on 14 published results\.$/)
    })

    it('states internal matches, results with no ball bowled and forfeits received and conceded', async () => {
      serve(makeTeamStats({ basis: { resultsCounted: 12, internalResults: 2, resultsNoBallBowled: 1, forfeits: { received: 1, conceded: 2 }, resultsWithBothInnings: 12 } }))
      renderPage()
      await loaded()
      const text = screen.getByTestId('stats-basis').textContent ?? ''
      expect(text).toContain('Based on 12 published results.')
      expect(text).toContain('2 internal matches are counted once for this team.')
      expect(text).toContain('1 result with no ball bowled is not counted.')
      expect(text).toContain('Forfeits received 1 and conceded 2 are counted as wins and losses.')
    })

    it('words a single forfeit received as a win', async () => {
      serve(makeTeamStats({ basis: { resultsCounted: 1, internalResults: 1, resultsNoBallBowled: 0, forfeits: { received: 1, conceded: 0 }, resultsWithBothInnings: 1 } }))
      renderPage()
      await loaded()
      expect(screen.getByTestId('stats-basis').textContent).toContain('Based on 1 published result.')
      expect(screen.getByTestId('stats-basis').textContent).toContain('1 internal match is counted once for this team.')
      expect(screen.getByTestId('stats-basis').textContent).toContain('Forfeits received 1 is counted as a win.')
    })

    it('shows the four tiles with the server figures, in Won success and Lost error tones', async () => {
      renderPage()
      await loaded()
      const strip = screen.getByTestId('stat-tiles')
      expect(within(strip).getAllByTestId(/^tile-(played|won|lost|win-percent)$/).map((tile) => tile.getAttribute('data-testid'))).toEqual(['tile-played', 'tile-won', 'tile-lost', 'tile-win-percent'])
      expect(screen.getByTestId('tile-played-value')).toHaveTextContent('14')
      expect(screen.getByTestId('tile-won-value')).toHaveTextContent('9')
      expect(screen.getByTestId('tile-lost-value')).toHaveTextContent('4')
      expect(screen.getByTestId('tile-win-percent-value')).toHaveTextContent('69.2')
      const colour = (id: string) => getComputedStyle(screen.getByTestId(id)).color
      expect(colour('tile-won-value')).not.toBe(colour('tile-played-value'))
      expect(colour('tile-lost-value')).not.toBe(colour('tile-played-value'))
      expect(colour('tile-lost-value')).not.toBe(colour('tile-won-value'))
    })

    it('shows a dash for a Win % that is not defined, never 0', async () => {
      serve(makeTeamStats({ record: { played: 2, won: 0, lost: 0, tied: 2, drawn: 0, noResult: 0, decisive: 0, winPercent: null } }))
      renderPage()
      await loaded()
      expect(screen.getByTestId('tile-win-percent-value')).toHaveTextContent('–')
    })

    it('displays the figures exactly as sent and computes none (inconsistent input stays inconsistent)', async () => {
      serve(makeTeamStats({ record: { played: 99, won: 1, lost: 1, tied: 0, drawn: 0, noResult: 0, decisive: 2, winPercent: 12.34 } }))
      renderPage()
      await loaded()
      expect(screen.getByTestId('tile-played-value')).toHaveTextContent('99')
      expect(screen.getByTestId('tile-win-percent-value')).toHaveTextContent('12.3')
      expect(field(screen.getByTestId('team-record-card'), 'Win %').value).toBe('12.3')
    })

    describe('the form strip', () => {
      it('is a list of five chips, newest first, each with its letter as text', async () => {
        renderPage()
        await loaded()
        const list = screen.getByRole('list', { name: 'Last results, newest first' })
        const chips = within(list).getAllByRole('link')
        expect(chips.map((chip) => chip.textContent)).toEqual(['W', 'L', 'T', 'D', 'NR'])
        expect(screen.getByTestId('team-form-strip')).toHaveTextContent('Form, last 5 results, newest first')
        expect(chips[0]).toHaveAttribute('data-tone', 'positive')
        expect(chips[1]).toHaveAttribute('data-tone', 'closed')
        expect(chips[4]).toHaveAttribute('data-tone', 'muted')
      })

      it('speaks result, opponent and date, and marks an internal match and a forfeit with words', async () => {
        serve(makeTeamStats({
          form: [
            makeForm(1),
            makeForm(2, { derby: true, result: 'TIED', opponentName: 'Villagers 2' }),
            makeForm(3, { forfeit: true, result: 'LOST' }),
          ],
        }))
        renderPage()
        await loaded()
        const [won, derby, forfeit] = within(screen.getByRole('list', { name: 'Last results, newest first' })).getAllByRole('link')
        expect(won).toHaveAccessibleName('Won against Opponent 1, 14 March 2026, open result')
        expect(derby).toHaveAccessibleName('Tied in an internal match, 14 March 2026, open result')
        expect(forfeit).toHaveAccessibleName('Lost by forfeit against Opponent 3, 14 March 2026, open result')
        expect(within(derby).getByText('internal')).toBeInTheDocument()
        expect(within(forfeit).getByText('forfeit')).toBeInTheDocument()
        expect(within(won).queryByText('internal')).not.toBeInTheDocument()
        expect(within(won).queryByText('forfeit')).not.toBeInTheDocument()
        expect(derby).toHaveAttribute('title', 'v Villagers 2, 14 Mar 2026')
      })

      it('shows a derby that is also a forfeit with both markers', async () => {
        serve(makeTeamStats({ form: [makeForm(1, { derby: true, forfeit: true })] }))
        renderPage()
        await loaded()
        const chip = within(screen.getByTestId('team-form-strip')).getByRole('link')
        expect(within(chip).getByText('internal')).toBeInTheDocument()
        expect(within(chip).getByText('forfeit')).toBeInTheDocument()
        expect(screen.getByTestId('team-form-strip')).toHaveTextContent('Form, last result, newest first')
      })

      it('opens the result with the team page (and its filters) as the way back, labelled Team', async () => {
        renderPage(`${BASE}?seasonId=season-2&leagueId=league-1&competition=LEAGUE`)
        await loaded()
        const chip = within(screen.getByTestId('team-form-strip')).getAllByRole('link')[1]
        expect(chip).toHaveAttribute('href', '/manage/results/match-2')
        await userEvent.click(chip)
        expect(await screen.findByTestId('probe-path')).toHaveTextContent('/manage/results/match-2')
        expect(probeState()).toEqual({ backTo: '/manage/teams/team-1/stats?seasonId=season-2&leagueId=league-1&competition=LEAGUE', backLabel: 'Team' })
      })

      it('uses an empty season and league in the way back when none is chosen (All, not the saved one)', async () => {
        localStorage.setItem('teamStats:filters:club-1', JSON.stringify({ seasonId: 'all', leagueId: null }))
        renderPage()
        await loaded()
        await userEvent.click(within(screen.getByTestId('team-form-strip')).getAllByRole('link')[0])
        expect(probeState()).toEqual({ backTo: '/manage/teams/team-1/stats?seasonId=&leagueId=', backLabel: 'Team' })
      })

      it('draws nothing when the team has no recent results', async () => {
        serve(makeTeamStats({ form: [] }))
        renderPage()
        await loaded()
        expect(screen.queryByTestId('team-form-strip')).not.toBeInTheDocument()
      })
    })
  })

  describe('the cards', () => {
    it('Record: every count, the win percentage with its denominator, and the forfeits line', async () => {
      serve(makeTeamStats({ basis: { resultsCounted: 14, internalResults: 0, resultsNoBallBowled: 0, forfeits: { received: 2, conceded: 1 }, resultsWithBothInnings: 14 } }))
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-record-card')
      expect(within(card).getByRole('heading', { name: 'Record' })).toBeInTheDocument()
      expect(['Played', 'Won', 'Lost', 'Tied', 'Drawn', 'No result'].map((label) => field(card, label).value)).toEqual(['14', '9', '4', '1', '0', '0'])
      expect(field(card, 'Win %')).toEqual({ value: '69.2', caption: 'of 13 decisive results' })
      expect(field(card, 'Forfeits received · conceded').value).toBe('2 · 1')
    })

    it('Batting: figures with separators and two decimals, the highest and lowest total with their match links', async () => {
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-batting-card')
      expect(field(card, 'Runs').value).toBe('1,842')
      expect(field(card, 'Wickets lost').value).toBe('75')
      expect(field(card, 'Average').value).toBe('24.56')
      expect(field(card, 'Runs per innings').value).toBe('131.57')
      expect(field(card, 'Run rate').value).toBe('5.12')
      const high = within(card).getByTestId('highlight-highest-total')
      expect(high).toHaveTextContent('212/6')
      const link = within(high).getByRole('link', { name: /Highest total, v Riverside, 14 Mar 2026, open result/ })
      expect(link).toHaveAttribute('href', '/manage/results/match-1')
      expect(within(card).getByTestId('highlight-lowest-total')).toHaveTextContent('88/10')
      // fully covered: no coverage captions
      expect(field(card, 'Runs').caption).toBeNull()
      expect(within(card).queryByText(/innings that could be classed/)).not.toBeInTheDocument()
    })

    it('Batting: coverage captions name how many innings supported each figure', async () => {
      const base = makeTeamStats()
      serve({ ...base, batting: { ...base.batting, coverage: { inningsUsable: 10, inningsCounted: 14, inningsClassifiable: 6 } } })
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-batting-card')
      for (const label of ['Runs', 'Wickets lost', 'Average', 'Runs per innings']) expect(field(card, label).caption).toBe('from 10 of 14 innings with a full score')
      expect(field(card, 'Run rate').caption).toBe('from 10 of 14 innings with balls recorded')
      expect(within(card).getByTestId('highlight-lowest-total')).toHaveTextContent('from 6 of 14 innings that could be classed as complete')
    })

    it('Batting: dashes and no link for totals and figures that are not defined', async () => {
      const base = makeTeamStats()
      serve({
        ...base,
        batting: { ...base.batting, runs: null, wicketsLost: null, battingAverage: null, runsPerInnings: null, runRate: null, highestTotal: null, lowestTotal: null },
      })
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-batting-card')
      for (const label of ['Runs', 'Wickets lost', 'Average', 'Runs per innings', 'Run rate']) expect(field(card, label).value).toBe('–')
      expect(within(card).getByTestId('highlight-highest-total')).toHaveTextContent('–')
      expect(within(card).queryByRole('link')).not.toBeInTheDocument()
    })

    it('Batting: shows the runs alone when the wickets of a total are not on file', async () => {
      const base = makeTeamStats()
      serve({ ...base, batting: { ...base.batting, highestTotal: { matchId: 'match-9', matchDate: null, opponentName: null, runs: 150, wickets: null as never, allOut: false } } })
      renderPage()
      await loaded()
      const high = within(screen.getByTestId('team-batting-card')).getByTestId('highlight-highest-total')
      expect(high).toHaveTextContent(/^Highest total150/)
      expect(within(high).getByRole('link')).toHaveTextContent('Open result')
    })

    it('Results highlights: the chase with its target, the largest wins, each a link to its match', async () => {
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-highlights-card')
      expect(within(card).getByRole('heading', { name: 'Results highlights' })).toBeInTheDocument()
      const chase = within(card).getByTestId('highlight-chase')
      expect(chase).toHaveTextContent('187')
      expect(chase).toHaveTextContent('chasing 186')
      expect(within(chase).getByRole('link')).toHaveAttribute('href', '/manage/results/match-3')
      expect(within(card).getByTestId('highlight-win-runs')).toHaveTextContent('96 runs')
      expect(within(within(card).getByTestId('highlight-win-runs')).getByRole('link')).toHaveAttribute('href', '/manage/results/match-4')
      expect(within(card).getByTestId('highlight-win-wickets')).toHaveTextContent('9 wickets')
      expect(within(within(card).getByTestId('highlight-win-wickets')).getByRole('link')).toHaveAttribute('href', '/manage/results/match-5')
    })

    it('Results highlights: singular units, dashes and no links when there is none', async () => {
      const base = makeTeamStats()
      serve({
        ...base,
        chasing: {
          highestSuccessfulChase: null,
          largestVictoryByRuns: { matchId: 'm', matchDate: null, opponentName: null, margin: 1 },
          largestVictoryByWickets: null,
        },
      })
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-highlights-card')
      expect(within(card).getByTestId('highlight-win-runs')).toHaveTextContent('1 run')
      expect(within(card).getByTestId('highlight-win-runs')).not.toHaveTextContent('1 runs')
      expect(within(card).getByTestId('highlight-chase')).toHaveTextContent('–')
      expect(within(card).getByTestId('highlight-win-wickets')).toHaveTextContent('–')
      expect(within(card).getAllByRole('link')).toHaveLength(1)
    })

    it('a highlight link carries the team page (with its filters) as the way back, labelled Team', async () => {
      renderPage(`${BASE}?seasonId=season-2&leagueId=&competition=FRIENDLY`)
      await loaded()
      await userEvent.click(within(within(screen.getByTestId('team-highlights-card')).getByTestId('highlight-chase')).getByRole('link'))
      expect(await screen.findByTestId('probe-path')).toHaveTextContent('/manage/results/match-3')
      expect(probeState()).toEqual({ backTo: '/manage/teams/team-1/stats?seasonId=season-2&leagueId=&competition=FRIENDLY', backLabel: 'Team' })
    })

    it('Bowling: wickets, runs conceded, average and economy, with coverage captions when some innings are missing', async () => {
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-bowling-card')
      expect(['Wickets taken', 'Runs conceded', 'Average', 'Economy'].map((label) => field(card, label).value)).toEqual(['120', '1,900', '15.83', '5.43'])
      expect(field(card, 'Wickets taken').caption).toBeNull()
    })

    it('Bowling: partial coverage is captioned and undefined figures are dashes', async () => {
      const base = makeTeamStats()
      serve({ ...base, bowling: { wicketsTaken: 0, runsConceded: 40, ballsBowled: null, bowlingAverage: null, economy: null, coverage: { inningsUsable: 3, inningsCounted: 5 } } })
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-bowling-card')
      expect(field(card, 'Wickets taken')).toEqual({ value: '0', caption: 'from 3 of 5 innings with a full score' })
      expect(field(card, 'Average').value).toBe('–')
      expect(field(card, 'Economy')).toEqual({ value: '–', caption: 'from 3 of 5 innings with balls recorded' })
    })

    it('Extras: the total, the average per match and the five components', async () => {
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-extras-card')
      expect(within(card).getByRole('heading', { name: 'Extras conceded' })).toBeInTheDocument()
      expect(['Total', 'Per match', 'Wides', 'No-balls', 'Byes', 'Leg byes', 'Penalty runs'].map((label) => field(card, label).value)).toEqual(['210', '15.00', '90', '20', '40', '50', '10'])
      for (const label of ['Total', 'Wides', 'Penalty runs']) expect(field(card, label).caption).toBeNull()
    })

    it('Extras: the total and each component carry their own coverage (inningsWithExtras on the total, inningsRecorded per component)', async () => {
      const base = makeTeamStats()
      serve({
        ...base,
        extras: {
          ...base.extras,
          coverage: { inningsWithExtras: 12, inningsCounted: 14 },
          componentCoverage: {
            wides: { inningsRecorded: 9, inningsCounted: 14 },
            noBalls: { inningsRecorded: 14, inningsCounted: 14 },
            byes: { inningsRecorded: 0, inningsCounted: 14 },
            legByes: { inningsRecorded: 5, inningsCounted: 12 },
            penaltyRuns: { inningsRecorded: 1, inningsCounted: 14 },
          },
        },
      })
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-extras-card')
      expect(field(card, 'Total').caption).toBe('from 12 of 14 innings that recorded it')
      expect(field(card, 'Per match').caption).toBe('from 12 of 14 innings that recorded it')
      expect(field(card, 'Wides').caption).toBe('from 9 of 14 innings that recorded it')
      expect(field(card, 'No-balls').caption).toBeNull()
      expect(field(card, 'Byes').caption).toBe('from 0 of 14 innings that recorded it')
      expect(field(card, 'Leg byes').caption).toBe('from 5 of 12 innings that recorded it')
      expect(field(card, 'Penalty runs').caption).toBe('from 1 of 14 innings that recorded it')
    })

    it('Extras: a summary-level result leaves dashes, never zeros', async () => {
      const base = makeTeamStats()
      serve({
        ...base,
        extras: {
          conceded: null, averagePerMatch: null, wides: null, noBalls: null, byes: null, legByes: null, penaltyRuns: null,
          coverage: { inningsWithExtras: 0, inningsCounted: 4 },
          componentCoverage: { wides: { inningsRecorded: 0, inningsCounted: 4 }, noBalls: { inningsRecorded: 0, inningsCounted: 4 }, byes: { inningsRecorded: 0, inningsCounted: 4 }, legByes: { inningsRecorded: 0, inningsCounted: 4 }, penaltyRuns: { inningsRecorded: 0, inningsCounted: 4 } },
        },
      })
      renderPage()
      await loaded()
      const card = screen.getByTestId('team-extras-card')
      expect(['Total', 'Per match', 'Wides', 'Penalty runs'].map((label) => field(card, label).value)).toEqual(['–', '–', '–', '–'])
      expect(field(card, 'Total').caption).toBe('from 0 of 4 innings that recorded it')
    })

    describe('Net run rate', () => {
      it('SHOWN: the signed value to 2 decimals and N of M results, with no rule name', async () => {
        renderPage()
        await loaded()
        const card = screen.getByTestId('team-nrr-card')
        expect(within(card).getByRole('heading', { name: 'Net run rate' })).toBeInTheDocument()
        expect(screen.getByTestId('nrr-value')).toHaveTextContent('+0.84')
        expect(screen.getByTestId('nrr-detail')).toHaveTextContent('Based on 8 of 11 results, one league in one season.')
        expect(document.body.innerHTML).not.toMatch(/full[- ]quota/i)
      })

      it('SHOWN: a negative value keeps its minus and rounds to 2 decimals', async () => {
        const base = makeTeamStats()
        serve({ ...base, netRunRate: { ...base.netRunRate, value: -1.126 } })
        renderPage()
        await loaded()
        expect(screen.getByTestId('nrr-value')).toHaveTextContent('-1.13')
      })

      it('NOT_ONE_COMPETITION: a dash and the hint to choose one league and season', async () => {
        const base = makeTeamStats()
        serve({ ...base, netRunRate: { status: 'NOT_ONE_COMPETITION', value: null, rule: 'FULL_QUOTA', matchesUsed: 0, matchesCounted: 11, leagueId: null, seasonId: null } })
        renderPage()
        await loaded()
        expect(screen.getByTestId('nrr-value')).toHaveTextContent('–')
        expect(screen.getByTestId('nrr-detail')).toHaveTextContent('Choose one league and season to see Net Run Rate.')
        expect(screen.getByTestId('nrr-detail')).not.toHaveTextContent('Based on')
        expect(document.body.innerHTML).not.toMatch(/full[- ]quota/i)
      })

      it('NO_USABLE_RESULTS: a dash and what a usable result needs', async () => {
        const base = makeTeamStats()
        serve({ ...base, netRunRate: { status: 'NO_USABLE_RESULTS', value: null, rule: 'FULL_QUOTA', matchesUsed: 0, matchesCounted: 0, leagueId: null, seasonId: null } })
        renderPage()
        await loaded()
        expect(screen.getByTestId('nrr-value')).toHaveTextContent('–')
        expect(screen.getByTestId('nrr-detail')).toHaveTextContent('Net run rate needs won or tied results with both innings recorded.')
      })
    })

    it('Not captured yet: lists what the server names, and draws nothing when it names none', async () => {
      renderPage()
      await loaded()
      const panel = screen.getByTestId('not-captured-panel')
      expect(within(panel).getByRole('heading', { name: 'Not captured yet' })).toBeInTheDocument()
      expect(panel).toHaveTextContent('Partnerships (runs by wicket): The scorecard does not record the fall of wickets.')
    })

    it('Not captured yet: one line per item, and the panel disappears with an empty list', async () => {
      serve(makeTeamStats({ notCaptured: [{ code: 'A', label: 'Alpha', reason: 'because a' }, { code: 'B', label: 'Beta', reason: 'because b' }] }))
      const { unmount } = renderPage()
      await loaded()
      expect(within(screen.getByTestId('not-captured-panel')).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Alpha: because a', 'Beta: because b'])
      unmount()

      serve(makeTeamStats({ notCaptured: [] }))
      renderPage()
      await loaded()
      expect(screen.queryByTestId('not-captured-panel')).not.toBeInTheDocument()
    })

    it('shows the six cards in order, then the panel', async () => {
      renderPage()
      await loaded()
      const ids = ['team-record-card', 'team-batting-card', 'team-highlights-card', 'team-bowling-card', 'team-extras-card', 'team-nrr-card', 'not-captured-panel']
      const elements = ids.map((id) => screen.getByTestId(id))
      elements.slice(1).forEach((element, index) => {
        expect(elements[index].compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      })
    })
  })

  describe('empty, loading and error states', () => {
    const none = (over: Partial<TeamStatsPageData> = {}) =>
      makeTeamStats({ basis: { resultsCounted: 0, internalResults: 0, resultsNoBallBowled: 0, forfeits: { received: 0, conceded: 0 }, resultsWithBothInnings: 0 }, form: [], ...over })

    it('a team with no published results: says so, offers Go to Results and hides the filters, tiles and cards', async () => {
      serve(none())
      server.options = { seasonIds: [], leagueIds: [], sectionIds: [], competitions: [] }
      renderPage()
      expect(await screen.findByText('No published results yet', {}, wait)).toBeInTheDocument()
      expect(screen.getByText('Team statistics appear here once a published result includes this team.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Go to Results' })).toHaveAttribute('href', '/manage/results')
      expect(screen.queryByRole('combobox', { name: 'Season' })).not.toBeInTheDocument()
      expect(screen.queryByTestId('stat-tiles')).not.toBeInTheDocument()
      expect(screen.queryByTestId('team-record-card')).not.toBeInTheDocument()
    })

    it('filters that match nothing: says so and Clear filters resets Season, League and Competition (and the saved choice)', async () => {
      server.page = (_id, params) => (Object.keys(params).length > 0 ? none() : makeTeamStats())
      localStorage.setItem('teamStats:filters:club-1', JSON.stringify({ seasonId: 'season-2', leagueId: 'league-1' }))
      renderPage(`${BASE}?competition=LEAGUE`)
      expect(await screen.findByText('No published results match these filters', {}, wait)).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Season' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
      await loaded()
      expect(lastPage().params).toEqual({})
      expect(JSON.parse(localStorage.getItem('teamStats:filters:club-1') as string)).toMatchObject({ seasonId: 'all', leagueId: null })
    })

    it('a failed load shows Try again, which reloads', async () => {
      server.page = () => new Error('boom')
      renderPage()
      expect(await screen.findByText("Couldn't load the statistics", {}, wait)).toBeInTheDocument()
      server.page = (teamId) => makeTeamStats({ teamId })
      await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
      await loaded()
      expect(screen.queryByText("Couldn't load the statistics")).not.toBeInTheDocument()
    })

    it('shows a busy skeleton while loading', async () => {
      let release: () => void = () => undefined
      const hold = new Promise<void>((resolve) => { release = resolve })
      apiGet.mockImplementation(async (url: string, config?: unknown) => {
        if (/\/teams\/[^/]+\/stats$/.test(url)) await hold
        return teamStatsApi(server).get(url, config as never)
      })
      renderPage()
      expect(await screen.findByLabelText('Loading statistics', {}, wait)).toHaveAttribute('aria-busy', 'true')
      release()
      await loaded()
      expect(screen.queryByLabelText('Loading statistics')).not.toBeInTheDocument()
    })

    it('keeps the last figures on screen while a filter change loads', async () => {
      renderPage()
      await loaded()
      let release: () => void = () => undefined
      const hold = new Promise<void>((resolve) => { release = resolve })
      apiGet.mockImplementation(async (url: string, config?: unknown) => {
        if (/\/teams\/[^/]+\/stats$/.test(url)) await hold
        return teamStatsApi(server).get(url, config as never)
      })
      await userEvent.click(screen.getByRole('combobox', { name: 'Season' }))
      await userEvent.click(await screen.findByRole('option', { name: '2025/26' }))
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Season' })).toHaveTextContent('2025/26'))
      expect(screen.getByTestId('tile-played')).toBeInTheDocument()
      release()
      await waitFor(() => expect(lastPage().params).toEqual({ seasonId: 'season-2' }))
    })
  })
})
