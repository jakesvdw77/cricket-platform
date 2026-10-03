import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { listAllMatches } from './matchApi'
import type { Match } from './matchApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

const get = vi.mocked(api.get)

function match(id: string): Match {
  return { id } as Match
}

function pageOf(ids: string[], page: number, totalPages: number) {
  return { data: { content: ids.map(match), totalElements: 0, totalPages, number: page, size: 200 } }
}

describe('listAllMatches', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('returns a single page and passes league, season, size and sort', async () => {
    get.mockResolvedValueOnce(pageOf(['a', 'b'], 0, 1))

    const result = await listAllMatches('club-1', { leagueId: 'league-1', seasonId: 'season-1' })

    expect(result.map((m) => m.id)).toEqual(['a', 'b'])
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('/manage/clubs/club-1/matches', {
      params: { page: 0, size: 200, sort: 'matchDate,asc', leagueId: 'league-1', seasonId: 'season-1' },
    })
  })

  it('concatenates multiple pages in order', async () => {
    get
      .mockResolvedValueOnce(pageOf(['a', 'b'], 0, 3))
      .mockResolvedValueOnce(pageOf(['c'], 1, 3))
      .mockResolvedValueOnce(pageOf(['d', 'e'], 2, 3))

    const result = await listAllMatches('club-1', { leagueId: 'league-1', seasonId: 'season-1' })

    expect(result.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(get.mock.calls.map(([, config]) => (config as { params: { page: number } }).params.page)).toEqual([0, 1, 2])
  })

  it('stops at the 25 page bound and returns what it has', async () => {
    get.mockImplementation(async (_url, config) => {
      const page = (config as { params: { page: number } }).params.page
      return pageOf([`m${page}`], page, 100)
    })

    const result = await listAllMatches('club-1', { leagueId: 'league-1', seasonId: 'season-1' })

    expect(get).toHaveBeenCalledTimes(25)
    expect(result).toHaveLength(25)
  })
})
