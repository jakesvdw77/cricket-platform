import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { getAwardsView, getLeaderboardTable, leaderboardKeys } from './leaderboardApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('leaderboardApi', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('sends sort, page and size, plus only the filters that are set; no direction or minimum by default', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })
    await getLeaderboardTable('club-1', 'batting', 'runs', null, { seasonId: 's-1', leagueId: null, teamId: '', sectionId: 'sec-1' }, null, 0, 10)
    expect(api.get).toHaveBeenCalledWith('/manage/clubs/club-1/leaderboards/batting', {
      params: { seasonId: 's-1', sectionId: 'sec-1', sort: 'runs', page: 0, size: 10 },
    })
  })

  it('sends direction and minimum only when given (a minimum of 0 is still a minimum)', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })
    await getLeaderboardTable('club-1', 'bowling', 'economy', 'desc', {}, 0, 2, 10)
    expect(api.get).toHaveBeenLastCalledWith('/manage/clubs/club-1/leaderboards/bowling', {
      params: { sort: 'economy', page: 2, size: 10, direction: 'desc', minimum: 0 },
    })
  })

  it('awards: absent minimums mean the server defaults', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })
    await getAwardsView('club-1', { teamId: 't-1' }, null, null)
    expect(api.get).toHaveBeenLastCalledWith('/manage/clubs/club-1/leaderboards/awards', { params: { teamId: 't-1' } })
    await getAwardsView('club-1', {}, 3, 8)
    expect(api.get).toHaveBeenLastCalledWith('/manage/clubs/club-1/leaderboards/awards', { params: { minimumInnings: 3, minimumOvers: 8 } })
  })

  it('keys a table by sort, direction, filters and minimum under the leaderboards prefix', () => {
    const base = leaderboardKeys.table('c', 'batting', 'runs', null, {}, null)
    expect(base.slice(0, 3)).toEqual(['managed-club', 'c', 'leaderboards'])
    expect(leaderboardKeys.table('c', 'batting', 'runs', 'asc', {}, null)).not.toEqual(base)
    expect(leaderboardKeys.table('c', 'batting', 'runs', null, { seasonId: 's' }, null)).not.toEqual(base)
    expect(leaderboardKeys.table('c', 'batting', 'runs', null, {}, 3)).not.toEqual(base)
  })
})
