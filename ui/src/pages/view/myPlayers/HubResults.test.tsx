import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../api/axiosConfig'
import { HubResults } from './HubResults'
import { calls, clearViewport, httpError } from '../../../test/accountTestUtils'
import type { ApiMock } from '../../../test/accountTestUtils'
import { KEY, battingRow, bowlingRow, didNotBatRow, makeResultList, makeResultSummary } from '../../../test/hubResultFixtures'
import { makeResultFilters } from '../../../test/statsFixtures'
import { filtersWithOneChoice, renderStatsPage } from '../../../test/statsPageTestUtils'

vi.mock('../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/145 Test Plan, Frontend: the Results page. Loading, error with Retry, empty, filtered-empty, the latest banner, the card grid,
// Recent Form, Show More, the Season select and the Filters panel and sheet (choices apply as you tap). Copy names the player, never "you".
// A page of cards is heavy to draw; the default 5 s is tight on a loaded machine.
vi.setConfig({ testTimeout: 20000 })

const http = api as unknown as ApiMock
const LIST = `GET /me/players/${KEY}/results`
const SUMMARY = `GET /me/players/${KEY}/results/summary`
const FILTERS = `GET /me/players/${KEY}/results/filters`

const ROWS = [
  battingRow({ matchId: 'm1', opponentName: 'Rovers' }),
  bowlingRow({ matchId: 'm2', opponentName: 'Hillcrest', result: 'LOST', resultLine: 'Hillcrest beat Villagers by 3 wickets' }),
  didNotBatRow({ matchId: 'm3', opponentName: 'Eagles' }),
]
const FIVE = [...ROWS, battingRow({ matchId: 'm4', opponentName: 'Kites', result: 'TIED' }), battingRow({ matchId: 'm5', opponentName: 'Owls' })]

const render = (routes: Record<string, unknown> = {}, entry = '/stats') =>
  renderStatsPage(http, <HubResults playerKey={KEY} />, { [FILTERS]: makeResultFilters(), [LIST]: makeResultList(ROWS), [SUMMARY]: makeResultSummary({ matches: 3, lastFive: FIVE }), ...routes }, entry)
const lastListParams = () => calls(http.get, `/me/players/${KEY}/results`).at(-1)?.[1]

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})
afterEach(clearViewport)

describe('HubResults states', () => {
  it('shows skeletons while the list loads, under the Results title', () => {
    render({ [LIST]: () => new Promise(() => undefined) })
    expect(screen.getByTestId('hub-results-loading')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('heading', { name: 'Results' })).toBeInTheDocument()
  })

  it('shows an error with Retry that asks again and then shows the cards', async () => {
    const user = userEvent.setup()
    let fail = true
    render({ [LIST]: () => (fail ? httpError(500) : makeResultList(ROWS)) })
    expect(await screen.findByText('We could not load the results. Please try again.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('hub-result-latest')).toBeInTheDocument()
    expect(screen.queryByText(/We could not load/)).not.toBeInTheDocument()
  })

  it('shows "No results yet" when nothing is shared and no filter narrows it', async () => {
    render({ [LIST]: makeResultList([]), [SUMMARY]: makeResultSummary({ matches: 0 }) }, '/stats?season=all')
    const empty = await screen.findByTestId('hub-results-empty')
    expect(empty).toHaveTextContent('No results yet')
    expect(empty).toHaveTextContent('Finished matches will appear here once the club shares them.')
    expect(screen.queryByTestId('hub-results-grid')).not.toBeInTheDocument()
  })

  it('shows "No matches for this filter" with Clear Filters, which asks again without the filter', async () => {
    const user = userEvent.setup()
    render({ [LIST]: (request: { config?: { params?: Record<string, unknown> } }) => makeResultList(request.config?.params?.leagueId ? [] : ROWS) }, '/stats?season=s1&league=l1')
    const empty = await screen.findByTestId('hub-results-filtered-empty')
    expect(empty).toHaveTextContent('No matches for this filter')
    expect(empty).toHaveTextContent('2025/26 · Premier League has no results shared with the Player Hub.')
    await user.click(within(empty).getByRole('button', { name: 'Clear Filters' }))
    expect(await screen.findByTestId('hub-result-latest')).toBeInTheDocument()
    expect(lastListParams()).toMatchObject({ params: { seasonId: 's1' } })
    expect(lastListParams()).not.toHaveProperty('params.leagueId')
  })
})

describe('HubResults with results', () => {
  it('shows the first row as the latest-result banner and the rest as cards in the grid', async () => {
    render()
    const latest = await screen.findByTestId('hub-result-latest')
    expect(latest).toHaveTextContent('Latest Result')
    expect(latest).toHaveTextContent('Villagers beat Rovers by 24 runs')
    const grid = screen.getByTestId('hub-results-grid')
    expect(within(grid).getAllByTestId('hub-result-card')).toHaveLength(2)
    expect(within(grid).getByText('Hillcrest beat Villagers by 3 wickets')).toBeInTheDocument()
  })

  it('has no grid when there is only one result', async () => {
    render({ [LIST]: makeResultList([ROWS[0]]) })
    await screen.findByTestId('hub-result-latest')
    expect(screen.queryByTestId('hub-results-grid')).not.toBeInTheDocument()
  })

  it('names the player by first name in every strip', async () => {
    render()
    await screen.findByTestId('hub-result-latest')
    const strips = screen.getAllByTestId('result-player-strip').map((strip) => strip.textContent)
    expect(strips).toEqual(['Aman batted 46, off 40 balls, 4 fours, 1 six', 'Aman bowled 2/21, 4 overs', 'Aman did not bat'])
  })

  it('draws Recent Form oldest first with a letter and the figure under each, and the sentence', async () => {
    render()
    const form = await screen.findByTestId('hub-results-form')
    expect(within(form).getByTestId('form-sentence')).toHaveTextContent('3 won, 1 lost, 1 tied in the last 5')
    const chips = within(within(form).getByTestId('form-streak')).getAllByRole('img')
    expect(chips.map((chip) => chip.textContent)).toEqual(['W', 'T', 'W', 'L', 'W'])
    expect(chips[3]).toHaveAccessibleName('lost v Hillcrest')
    expect(form).toHaveTextContent('2/21')
    expect(form).toHaveTextContent('DNB')
  })

  it('leaves Recent Form out when the summary has no recent results', async () => {
    render({ [SUMMARY]: makeResultSummary({ lastFive: [] }) })
    await screen.findByTestId('hub-result-latest')
    expect(screen.queryByTestId('hub-results-form')).not.toBeInTheDocument()
  })

  it('links every card to its result page carrying the scope', async () => {
    render({}, '/stats?season=s1')
    await screen.findByTestId('hub-result-latest')
    const link = screen.getAllByRole('link').find((a) => a.getAttribute('href')?.includes('/m2'))
    expect(link).toHaveAttribute('href', `/account/players/${KEY}/results/m2?season=s1`)
  })

  it('appends the next page from the server on Show More and then hides the button', async () => {
    const user = userEvent.setup()
    render({
      [LIST]: (request: { config?: { params?: Record<string, unknown> } }) =>
        request.config?.params?.page === 0
          ? makeResultList(ROWS, { page: { number: 0, size: 3, totalElements: 4, hasMore: true } })
          : makeResultList([battingRow({ matchId: 'm9', opponentName: 'Owls' })], { page: { number: 1, size: 3, totalElements: 4, hasMore: false } }),
    })
    await screen.findByTestId('hub-result-latest')
    await user.click(screen.getByRole('button', { name: 'Show More' }))
    await waitFor(() => expect(within(screen.getByTestId('hub-results-grid')).getAllByTestId('hub-result-card')).toHaveLength(3))
    expect(screen.queryByRole('button', { name: 'Show More' })).not.toBeInTheDocument()
    expect(calls(http.get, `/me/players/${KEY}/results`).map((call) => (call[1] as { params: { page: number } }).params.page)).toEqual([0, 1])
  })

  it('names no "you" anywhere on the page', async () => {
    render()
    await screen.findByTestId('hub-result-latest')
    expect(screen.getByTestId('hub-results').textContent).not.toMatch(/\byou(r)?\b/i)
  })
})

describe('HubResults scope controls', () => {
  it('asks for the current season first, and for all seasons from the Season select', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByTestId('hub-result-latest')
    expect(calls(http.get, `/me/players/${KEY}/results`)[0][1]).toEqual({ params: { seasonId: 's1', page: 0, size: 20 } })
    await user.click(screen.getByRole('combobox', { name: 'Season' }))
    await user.click(screen.getByRole('option', { name: 'All Seasons' }))
    await waitFor(() => expect(lastListParams()).toEqual({ params: { page: 0, size: 20 } }))
  })

  it('moves to another season from the Season select', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByTestId('hub-result-latest')
    await user.click(screen.getByRole('combobox', { name: 'Season' }))
    await user.click(screen.getByRole('option', { name: '2024/25' }))
    await waitFor(() => expect(lastListParams()).toMatchObject({ params: { seasonId: 's0' } }))
  })

  it('applies a league as you tap in the Filters sheet, with no Apply step, and shows a removable tag', async () => {
    const user = userEvent.setup()
    render()
    await screen.findByTestId('hub-result-latest')
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await screen.findByRole('heading', { name: 'Filters' })
    await user.click(screen.getByRole('button', { name: /^Premier League/ }))
    await waitFor(() => expect(lastListParams()).toMatchObject({ params: { seasonId: 's1', leagueId: 'l1' } }))
    expect(await screen.findByTestId('hub-results-filters-dot')).toBeInTheDocument()
    expect(screen.getByTestId('hub-results-tag')).toHaveTextContent('Premier League')
  })

  it('offers Team chips to a player with more than one team and applies one as you tap', async () => {
    const user = userEvent.setup()
    render({ [FILTERS]: makeResultFilters({ combos: [{ seasonId: 's1', leagueId: 'l1', teamId: 't1' }, { seasonId: 's1', leagueId: 'l1', teamId: 't2' }] }) })
    await screen.findByTestId('hub-result-latest')
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const teams = await screen.findByRole('group', { name: 'Teams' })
    expect(within(teams).getAllByRole('button').map((button) => button.textContent?.replace(/\d+ played.*$/, ''))).toEqual(['All Teams', 'U14 A', 'U14 B'])
    await user.click(within(teams).getByRole('button', { name: /^U14 B/ }))
    await waitFor(() => expect(lastListParams()).toMatchObject({ params: { seasonId: 's1', teamId: 't2' } }))
  })

  it('shows no Filters button and a quiet line for a player with a single league and team', async () => {
    render({ [FILTERS]: filtersWithOneChoice() })
    await screen.findByTestId('hub-result-latest')
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument()
    expect(screen.getByTestId('hub-results-context')).toHaveTextContent('Premier League · U14 A')
    expect(screen.getByRole('combobox', { name: 'Season' })).toBeInTheDocument()
  })

  it('resets a team that did not play in the newly chosen league (league then team order)', async () => {
    const user = userEvent.setup()
    render({}, '/stats?season=s1&team=t1')
    await screen.findByTestId('hub-result-latest')
    expect(lastListParams()).toMatchObject({ params: { seasonId: 's1', teamId: 't1' } })
    await user.click(screen.getByRole('button', { name: 'Filters, 1 active' }))
    // Only U14 B plays friendlies in 2025/26, so choosing Friendly drops U14 A.
    await user.click(await screen.findByRole('button', { name: /^Friendly/ }))
    await waitFor(() => expect(lastListParams()).toMatchObject({ params: { seasonId: 's1', competition: 'FRIENDLY' } }))
    expect(lastListParams()).not.toHaveProperty('params.teamId')
  })

  it('keeps a team that did play in the newly chosen league', async () => {
    const user = userEvent.setup()
    render({}, '/stats?season=s1&team=t1')
    await screen.findByTestId('hub-result-latest')
    await user.click(screen.getByRole('button', { name: 'Filters, 1 active' }))
    await user.click(await screen.findByRole('button', { name: /^Premier League/ }))
    await waitFor(() => expect(lastListParams()).toMatchObject({ params: { seasonId: 's1', leagueId: 'l1', teamId: 't1' } }))
  })

  it('docks the Filters panel beside the cards from a wide screen and closes it with Done', async () => {
    const user = userEvent.setup()
    window.matchMedia = ((query: string) => ({ matches: query.includes('min-width'), media: query, onchange: null, addListener: () => undefined, removeListener: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => false })) as unknown as typeof window.matchMedia
    render()
    await screen.findByTestId('hub-result-latest')
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const panel = await screen.findByTestId('hub-results-panel')
    expect(screen.getByTestId('hub-result-latest')).toBeInTheDocument()
    await user.click(within(panel).getByRole('button', { name: 'Done' }))
    expect(screen.queryByTestId('hub-results-panel')).not.toBeInTheDocument()
  })

  it('reads the scope from the address', async () => {
    render({}, '/stats?season=s0&league=l1&team=t1')
    await screen.findByTestId('hub-result-latest')
    expect(calls(http.get, `/me/players/${KEY}/results`)[0][1]).toEqual({ params: { seasonId: 's0', leagueId: 'l1', teamId: 't1', page: 0, size: 20 } })
  })
})
