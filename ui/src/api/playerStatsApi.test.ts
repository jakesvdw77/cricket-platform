import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { getPlayerStats, getPlayerStatsFilterOptions, playerStatsKey, playerStatsKeys } from './playerStatsApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('playerStatsApi', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('GETs the player stats with no params when no filter is set (career)', async () => {
    const stats = { playerId: 'p-1' }
    vi.mocked(api.get).mockResolvedValueOnce({ data: stats })
    await expect(getPlayerStats('club-1', 'p-1')).resolves.toBe(stats)
    expect(api.get).toHaveBeenCalledWith('/manage/clubs/club-1/players/p-1/stats', { params: {} })
  })

  it('sends only the filters that are set, dropping null and empty values', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })
    await getPlayerStats('club-1', 'p-1', { seasonId: 's-1', leagueId: null, teamId: '', sectionId: 'sec-1', competition: 'FRIENDLY' })
    expect(api.get).toHaveBeenLastCalledWith('/manage/clubs/club-1/players/p-1/stats', {
      params: { seasonId: 's-1', sectionId: 'sec-1', competition: 'FRIENDLY' },
    })
  })

  it('GETs the filter options without params', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { seasonIds: [] } })
    await getPlayerStatsFilterOptions('club-1', 'p-1')
    expect(api.get).toHaveBeenCalledWith('/manage/clubs/club-1/players/p-1/stats/filter-options')
  })

  it('keys every filtered read under the player prefix so one invalidation refreshes them all', () => {
    const prefix = playerStatsKey('club-1', 'p-1')
    expect(prefix).toEqual(['managed-club', 'club-1', 'players', 'p-1', 'stats'])
    const key = playerStatsKeys.filtered('club-1', 'p-1', { seasonId: 's-1' })
    expect(key.slice(0, prefix.length)).toEqual([...prefix])
    expect(key).not.toEqual(playerStatsKeys.filtered('club-1', 'p-1', { seasonId: 's-2' }))
    expect(playerStatsKeys.filtered('club-1', 'p-1')).toEqual(playerStatsKeys.filtered('club-1', 'p-1', {}))
  })
})
