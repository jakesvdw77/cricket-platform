import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { MY_LEADERBOARD_PAGE_SIZE, MY_STATS_INNINGS_PAGE_SIZE, getMyAwards, getMyBoardsFilters, getMyLeaderboard, getMyStanding, getMyStats, getMyStatsInnings, getMyTeamStats, myStatsKey } from './meStatsApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

// docs/specs/147: every read is under /me/players/{key}; only the scope parts that are set are sent.
const get = vi.mocked(api.get)
const NONE = { seasonId: null, teamId: null, leagueId: null, competition: null }
const FULL = { seasonId: 's1', teamId: 't1', leagueId: 'l1', competition: 'LEAGUE' as const }

describe('meStatsApi', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockResolvedValue({ data: { ok: true } })
  })

  it('sends no params for an all-seasons, all-teams scope and returns the payload', async () => {
    await expect(getMyStats('k1', NONE)).resolves.toEqual({ ok: true })
    expect(get).toHaveBeenCalledWith('/me/players/k1/stats', { params: {} })
  })

  it('sends exactly the scope parts that are set, on stats, team-stats and standing', async () => {
    await getMyStats('k1', FULL)
    await getMyTeamStats('k1', { ...NONE, teamId: 't1' })
    await getMyStanding('k1', { ...NONE, seasonId: 's1' })
    expect(get).toHaveBeenNthCalledWith(1, '/me/players/k1/stats', { params: { seasonId: 's1', teamId: 't1', leagueId: 'l1', competition: 'LEAGUE' } })
    expect(get).toHaveBeenNthCalledWith(2, '/me/players/k1/team-stats', { params: { teamId: 't1' } })
    expect(get).toHaveBeenNthCalledWith(3, '/me/players/k1/leaderboards/standing', { params: { seasonId: 's1' } })
  })

  it('asks the drill for the server tokens, the scope and a page of the fixed size, and omits an empty filter', async () => {
    await getMyStatsInnings('k1', 'BATTING', '50+', FULL, 2)
    await getMyStatsInnings('k1', 'MATCHES', null, NONE, 0)
    expect(get).toHaveBeenNthCalledWith(1, '/me/players/k1/stats/innings', { params: { kind: 'BATTING', filter: '50+', seasonId: 's1', teamId: 't1', leagueId: 'l1', competition: 'LEAGUE', page: 2, size: MY_STATS_INNINGS_PAGE_SIZE } })
    expect(get).toHaveBeenNthCalledWith(2, '/me/players/k1/stats/innings', { params: { kind: 'MATCHES', page: 0, size: MY_STATS_INNINGS_PAGE_SIZE } })
  })

  it('builds a leaderboard request with sort, direction and minimum only when given (a minimum of 0 is kept)', async () => {
    await getMyLeaderboard('k1', 'batting', NONE, {}, 0)
    await getMyLeaderboard('k1', 'bowling', { ...NONE, seasonId: 's1' }, { sort: 'runs', direction: 'desc', minimum: 0 }, 3)
    expect(get).toHaveBeenNthCalledWith(1, '/me/players/k1/leaderboards/batting', { params: { page: 0, size: MY_LEADERBOARD_PAGE_SIZE } })
    expect(get).toHaveBeenNthCalledWith(2, '/me/players/k1/leaderboards/bowling', { params: { seasonId: 's1', sort: 'runs', direction: 'desc', minimum: 0, page: 3, size: MY_LEADERBOARD_PAGE_SIZE } })
  })

  it('reads awards with the scope and the board filters without params', async () => {
    await getMyAwards('k1', { ...NONE, leagueId: 'l1' })
    await getMyBoardsFilters('k1')
    expect(get).toHaveBeenNthCalledWith(1, '/me/players/k1/leaderboards/awards', { params: { leagueId: 'l1' } })
    expect(get).toHaveBeenNthCalledWith(2, '/me/players/k1/leaderboards/filters')
  })

  it('keeps every stats query under the player\'s Hub key so unlinking refreshes it', () => {
    expect(myStatsKey('k1').slice(-2)).toEqual(['k1', 'stats'])
  })
})
