import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../../../../api/axiosConfig'
import { HubTeamStats } from './HubTeamStats'
import { calls, httpError } from '../../../../test/accountTestUtils'
import type { ApiMock } from '../../../../test/accountTestUtils'
import { KEY, TEAM_OPTIONAL_BLOCKS, makeMyTeamStats, makeResultFilters, withoutBlocks } from '../../../../test/statsFixtures'
import { filtersWithOneChoice, renderStatsPage } from '../../../../test/statsPageTestUtils'

vi.mock('../../../../api/axiosConfig', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

// docs/specs/147 Test Plan, Component: the Team stats page. Same frame as Player Stats; the payload needs exactly one team, which defaults to the
// player's current team. Filters is always shown.
vi.setConfig({ testTimeout: 20000 })
const http = api as unknown as ApiMock
const TEAM_STATS = `GET /me/players/${KEY}/team-stats`
const FILTERS = `GET /me/players/${KEY}/results/filters`
const LIST = `GET /me/players/${KEY}/results`
const render = (routes: Record<string, unknown>, entry = '/stats') => renderStatsPage(http, <HubTeamStats playerKey={KEY} />, { [FILTERS]: filtersWithOneChoice(), ...routes }, entry)
const teamStatsCalls = () => calls(http.get, `/me/players/${KEY}/team-stats`)
const pills = () => within(screen.getByRole('navigation', { name: 'Card groups' })).getAllByRole('button').map((button) => button.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('HubTeamStats states', () => {
  it('shows skeletons while the payload loads, and asks for the only team of a one-team player', async () => {
    render({ [TEAM_STATS]: () => new Promise(() => undefined) })
    expect(await screen.findByTestId('hub-teamstats-loading')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Team Stats' })).toBeInTheDocument()
    await waitFor(() => expect(teamStatsCalls()).toHaveLength(1))
    expect(teamStatsCalls()[0][1]).toEqual({ params: { seasonId: 's1', teamId: 't1' } })
  })

  it('shows an error with Retry that asks again', async () => {
    const user = userEvent.setup()
    let fail = true
    render({ [TEAM_STATS]: () => (fail ? httpError(500) : makeMyTeamStats()) })
    expect(await screen.findByText('We could not load the stats. Please try again.')).toBeInTheDocument()
    fail = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByTestId('hub-teamstats-grid')).toBeInTheDocument()
  })

  it('shows "No stats yet" with a link to Results for a player with no team that has results', async () => {
    render({ [FILTERS]: makeResultFilters({ combos: [], teams: [] }), [TEAM_STATS]: makeMyTeamStats() })
    const empty = await screen.findByTestId('hub-teamstats-empty')
    expect(within(empty).getByRole('link', { name: 'Results' })).toHaveAttribute('href', `/account/players/${KEY}/results`)
    expect(teamStatsCalls()).toHaveLength(0)
  })

  it('shows "No stats yet" when the team has nothing counted and no season is chosen', async () => {
    render({ [TEAM_STATS]: makeMyTeamStats({ basis: { ...makeMyTeamStats().basis, resultsCounted: 0 } }) }, '/stats?season=all')
    expect(await screen.findByTestId('hub-teamstats-empty')).toBeInTheDocument()
  })

  it('shows "No matches for this filter" for an empty season, and Show All Seasons asks for all of them', async () => {
    const user = userEvent.setup()
    const empty = makeMyTeamStats({ basis: { ...makeMyTeamStats().basis, resultsCounted: 0 } })
    render({ [TEAM_STATS]: (request: { config?: { params?: Record<string, unknown> } }) => (request.config?.params?.seasonId ? empty : makeMyTeamStats()) })
    expect(await screen.findByTestId('hub-teamstats-filtered-empty')).toHaveTextContent('2025/26 has no results shared with the Player Hub.')
    await user.click(screen.getByRole('button', { name: 'Show All Seasons' }))
    expect(await screen.findByTestId('hub-teamstats-grid')).toBeInTheDocument()
    expect(teamStatsCalls().at(-1)?.[1]).toEqual({ params: { teamId: 't1' } })
  })
})

describe('HubTeamStats full payload', () => {
  it('draws the five groups as pills and the Summary cards first, in the team\'s name', async () => {
    render({ [TEAM_STATS]: makeMyTeamStats() })
    expect(await screen.findByTestId('hub-teamstats-grid')).toBeInTheDocument()
    expect(pills()).toEqual(['Summary', 'Batting', 'Bowling', 'Fielding', 'Squad'])
    expect(screen.getAllByTestId('stats-scope')[0]).toHaveTextContent('2025/26 · U14 A')
    expect(screen.getByTestId('hub-teamstats').textContent).not.toMatch(/\byou(r)?\b/i)
  })

  it('opens the Fielding group on its pill with the new fielding card', async () => {
    const user = userEvent.setup()
    render({ [TEAM_STATS]: makeMyTeamStats() })
    await screen.findByTestId('hub-teamstats-grid')
    await user.click(screen.getByRole('button', { name: 'Fielding' }))
    expect(await screen.findByRole('heading', { name: 'Catches By Fielder' })).toBeInTheDocument()
  })

  it('links a card\'s match to the Hub Result page with the team-stats origin so Back returns here', async () => {
    const user = userEvent.setup()
    render({ [TEAM_STATS]: makeMyTeamStats() })
    await screen.findByTestId('hub-teamstats-grid')
    await user.click(screen.getByRole('button', { name: 'Batting' }))
    const link = await screen.findByRole('link', { name: /180 runs, won against Rovers 1/ })
    expect(link.getAttribute('href')).toMatch(new RegExp(`^/account/players/${KEY}/results/m1\\?season=s1&team=t1&origin=team-stats$`))
  })
})

describe('HubTeamStats payload without the newer blocks (an older backend)', () => {
  it('does not crash and still draws the groups whose cards need none of the missing blocks', async () => {
    render({ [TEAM_STATS]: withoutBlocks(makeMyTeamStats(), ...TEAM_OPTIONAL_BLOCKS) })
    expect(await screen.findByTestId('hub-teamstats-grid')).toBeInTheDocument()
    expect(pills()).toContain('Summary')
    expect(screen.queryByText(/We could not load/)).not.toBeInTheDocument()
  })

  it('shows a not-captured card in place of a missing block, never a figure', async () => {
    const user = userEvent.setup()
    render({ [TEAM_STATS]: withoutBlocks(makeMyTeamStats(), ...TEAM_OPTIONAL_BLOCKS) })
    await screen.findByTestId('hub-teamstats-grid')
    await user.click(screen.getByRole('button', { name: 'Fielding' }))
    const card = await screen.findByTestId('card-team.catches-by-fielder')
    expect(card).toHaveAttribute('data-state', 'missing')
    expect(within(card).getByTestId('stats-state-text')).toHaveTextContent('Fielding is not recorded for these results.')
  })
})

describe('HubTeamStats team and scope', () => {
  const twoTeams = makeResultFilters({
    seasons: [{ id: 's1', name: '2025/26' }],
    combos: [{ seasonId: 's1', leagueId: 'l1', teamId: 't1' }, { seasonId: 's1', leagueId: 'l1', teamId: 't2' }],
  })
  const newest = { page: { number: 0, size: 20, totalElements: 1, hasMore: false }, rows: [{ ourTeams: [{ side: 'HOME', teamId: 't2', teamName: 'U14 B' }] }] }

  it('defaults a several-team player to the team of the newest result and writes it to the address', async () => {
    render({ [FILTERS]: twoTeams, [LIST]: newest, [TEAM_STATS]: makeMyTeamStats() })
    await screen.findByTestId('hub-teamstats-grid')
    expect(teamStatsCalls()[0][1]).toEqual({ params: { seasonId: 's1', teamId: 't2' } })
  })

  it('names the implied team on every card\'s scope label, after the season', async () => {
    render({ [TEAM_STATS]: makeMyTeamStats() })
    await screen.findByTestId('hub-teamstats-grid')
    for (const label of screen.getAllByTestId('stats-scope')) expect(label).toHaveTextContent('2025/26 · U14 A')
  })

  it('does not name the team twice when it is already in the address', async () => {
    render({ [TEAM_STATS]: makeMyTeamStats() }, '/stats?team=t1')
    await screen.findByTestId('hub-teamstats-grid')
    expect(screen.getAllByTestId('stats-scope')[0].textContent).toBe('2025/26 · U14 A')
  })

  it('always shows Filters and the Season dropdown, even with one league and team', async () => {
    render({ [TEAM_STATS]: makeMyTeamStats() })
    await screen.findByTestId('hub-teamstats-grid')
    expect(screen.getByRole('button', { name: 'Filters' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Season' })).toBeInTheDocument()
  })

  it('sends the team named in the address', async () => {
    render({ [FILTERS]: twoTeams, [LIST]: newest, [TEAM_STATS]: makeMyTeamStats() }, '/stats?team=t1')
    await screen.findByTestId('hub-teamstats-grid')
    expect(teamStatsCalls()[0][1]).toEqual({ params: { seasonId: 's1', teamId: 't1' } })
  })
})
