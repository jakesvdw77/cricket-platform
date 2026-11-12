import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../api/axiosConfig'
import { HubMyStats } from './HubMyStats'
import { calls, httpError } from '../../../../test/accountTestUtils'
import type { ApiMock } from '../../../../test/accountTestUtils'
import { KEY, MINE_OPTIONAL_BLOCKS, makeEmptyMyStats, makeMyStats, makeResultFilters, withoutBlocks } from '../../../../test/statsFixtures'
import { filtersWithOneChoice, renderStatsPage } from '../../../../test/statsPageTestUtils'

vi.mock('../../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/147 Test Plan, Component: the My stats page (Player Stats). Loading, error with Retry, empty, filtered-empty, full, and a payload
// from an older backend that lacks the new blocks. The scope controls are the shared ones, and Filters is always shown on a Stats page.
// A full page with the card system is heavy to draw; the default 5 s is tight on a loaded machine.
vi.setConfig({ testTimeout: 20000 })

const http = api as unknown as ApiMock
const STATS = `GET /me/players/${KEY}/stats`
const FILTERS = `GET /me/players/${KEY}/results/filters`
const render = (routes: Record<string, unknown>, entry = '/stats') => renderStatsPage(http, <HubMyStats playerKey={KEY} />, { [FILTERS]: makeResultFilters(), ...routes }, entry)
const pills = () => within(screen.getByRole('navigation', { name: 'Card groups' })).getAllByRole('button').map((button) => button.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('HubMyStats states', () => {
  it('shows skeletons while the payload loads', () => {
    render({ [STATS]: () => new Promise(() => undefined) })
    expect(screen.getByTestId('hub-stats-loading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Player Stats' })).toBeInTheDocument()
  })

  it('shows an error with Retry that asks again and then shows the cards', async () => {
    const user = userEvent.setup()
    let fail = true
    render({ [STATS]: () => (fail ? httpError(500) : makeMyStats()) })
    expect(await screen.findByText('We could not load the stats. Please try again.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('hub-stats-grid')).toBeInTheDocument()
    expect(screen.queryByText(/We could not load/)).not.toBeInTheDocument()
  })

  it('shows "No stats yet" with a link to Results when nothing is counted and no filter narrows it', async () => {
    render({ [STATS]: makeEmptyMyStats() }, '/stats?season=all')
    const empty = await screen.findByTestId('hub-stats-empty')
    expect(within(empty).getByText('No stats yet')).toBeInTheDocument()
    expect(within(empty).getByRole('link', { name: 'Results' })).toHaveAttribute('href', `/account/players/${KEY}/results`)
    expect(screen.queryByTestId('hub-stats-grid')).not.toBeInTheDocument()
  })

  it('shows "No matches for this filter" in a season and offers Show All Seasons, which asks for all seasons', async () => {
    const user = userEvent.setup()
    render({ [STATS]: (request: { config?: { params?: Record<string, unknown> } }) => (request.config?.params?.seasonId ? makeEmptyMyStats() : makeMyStats()) })
    expect(await screen.findByTestId('hub-stats-filtered-empty')).toHaveTextContent('2025/26 has no results shared with the Player Hub.')
    await user.click(screen.getByRole('button', { name: 'Show All Seasons' }))
    expect(await screen.findByTestId('hub-stats-grid')).toBeInTheDocument()
    expect(calls(http.get, `/me/players/${KEY}/stats`).at(-1)?.[1]).toEqual({ params: {} })
  })

  it('offers Clear Filters when a league narrows an empty scope', async () => {
    render({ [STATS]: makeEmptyMyStats() }, '/stats?season=all&league=l1')
    const empty = await screen.findByTestId('hub-stats-filtered-empty')
    expect(within(empty).getByRole('button', { name: 'Clear Filters' })).toBeInTheDocument()
  })
})

describe('HubMyStats full payload', () => {
  it('draws the title, a pill per group with data and the first group of cards, from one stats request', async () => {
    render({ [STATS]: makeMyStats() })
    expect(await screen.findByTestId('hub-stats-grid')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Player Stats' })).toBeInTheDocument()
    expect(pills()).toEqual(['Summary', 'Batting', 'Bowling', 'Fielding', 'Teammate'])
    expect(screen.getByRole('heading', { name: 'Matches Played' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Innings by innings' })).not.toBeInTheDocument()
    expect(calls(http.get, `/me/players/${KEY}/stats`)).toHaveLength(1)
    expect(calls(http.get, `/me/players/${KEY}/team-stats`)).toHaveLength(0)
  })

  it('writes the scope into the cards: the scope label and the honesty line name the season', async () => {
    render({ [STATS]: makeMyStats() })
    await screen.findByTestId('hub-stats-grid')
    expect(screen.getAllByTestId('stats-scope')[0]).toHaveTextContent('2025/26')
    expect(screen.getAllByTestId('stats-basis')[0]).toHaveTextContent(/Based on \d+ of 7 results/)
  })

  it('moves to another group from its pill', async () => {
    const user = userEvent.setup()
    render({ [STATS]: makeMyStats() })
    await screen.findByTestId('hub-stats-grid')
    await user.click(screen.getByRole('button', { name: 'Batting' }))
    expect(await screen.findByRole('heading', { name: 'Innings by innings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Matches Played' })).not.toBeInTheDocument()
  })

  it('names no "you" anywhere on the page', async () => {
    render({ [STATS]: makeMyStats() })
    await screen.findByTestId('hub-stats-grid')
    expect(screen.getByTestId('hub-stats').textContent).not.toMatch(/\byou(r)?\b/i)
  })
})

describe('HubMyStats payload without the newer blocks (an older backend)', () => {
  it('does not crash: the cards that need a missing block go, the others stay', async () => {
    render({ [STATS]: withoutBlocks(makeMyStats(), ...MINE_OPTIONAL_BLOCKS) })
    expect(await screen.findByTestId('hub-stats-grid')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Matches Played' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Leagues Played' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Boundaries Hit' })).toBeInTheDocument()
    expect(pills()).toContain('Batting')
  })

  it('draws a missing-block card that asks for it as "not captured" and never a crash or a zero', async () => {
    const user = userEvent.setup()
    render({ [STATS]: withoutBlocks(makeMyStats(), ...MINE_OPTIONAL_BLOCKS) })
    await screen.findByTestId('hub-stats-grid')
    await user.click(screen.getByRole('button', { name: 'Batting' }))
    const positions = await screen.findByTestId('card-mine.positions')
    expect(positions).toHaveAttribute('data-state', 'missing')
    expect(within(positions).getByTestId('stats-state-text')).toHaveTextContent('Batting position is not recorded for these innings.')
  })
})

describe('HubMyStats scope controls', () => {
  it('always shows Filters and the Season dropdown, even with a single league and team to choose from', async () => {
    render({ [STATS]: makeMyStats(), [FILTERS]: filtersWithOneChoice() })
    await screen.findByTestId('hub-stats-grid')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Season' })).toBeInTheDocument()
  })

  it('asks for all seasons from the Season dropdown', async () => {
    const user = userEvent.setup()
    render({ [STATS]: makeMyStats() })
    await screen.findByTestId('hub-stats-grid')
    await user.click(screen.getByRole('combobox', { name: 'Season' }))
    await user.click(screen.getByRole('option', { name: 'All Seasons' }))
    await waitFor(() => expect(calls(http.get, `/me/players/${KEY}/stats`).at(-1)?.[1]).toEqual({ params: {} }))
  })

  it('sends the league and team chosen in the Filters sheet', async () => {
    const user = userEvent.setup()
    render({ [STATS]: makeMyStats() })
    await screen.findByTestId('hub-stats-grid')
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await screen.findByRole('heading', { name: 'Filters' })
    await user.click(screen.getByRole('button', { name: /^Premier League/ }))
    await waitFor(() => expect(calls(http.get, `/me/players/${KEY}/stats`).at(-1)?.[1]).toEqual({ params: { seasonId: 's1', leagueId: 'l1' } }))
    expect(await screen.findByTestId('hub-stats-filters-dot')).toBeInTheDocument()
  })

  it('reads the scope from the address and sends it', async () => {
    render({ [STATS]: makeMyStats() }, '/stats?season=s0&league=l1&team=t1')
    await screen.findByTestId('hub-stats-grid')
    expect(calls(http.get, `/me/players/${KEY}/stats`)[0][1]).toEqual({ params: { seasonId: 's0', teamId: 't1', leagueId: 'l1' } })
  })

  it('lets a Leagues Played bar in the Summary filter the whole page to that league', async () => {
    const user = userEvent.setup()
    render({ [STATS]: makeMyStats() })
    await screen.findByTestId('hub-stats-grid')
    await user.click(await screen.findByRole('button', { name: 'Filter to Premier League' }))
    await waitFor(() => expect(calls(http.get, `/me/players/${KEY}/stats`).at(-1)?.[1]).toEqual({ params: { seasonId: 's1', leagueId: 'l1' } }))
  })
})
