import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { getMatchesSummary, listAllMatches, listMatches, listMatchFilterOptions, matchesSummaryKey } from './matchApi'
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

// docs/specs/087-matches-polls-alignment.md
describe('Matches counters and quick filters', () => {
  beforeEach(() => {
    get.mockReset()
  })

  it('listMatches sends teamId and focus only when set', async () => {
    get.mockResolvedValue(pageOf([], 0, 1))

    await listMatches('club-1', { page: 0 })
    expect(get).toHaveBeenLastCalledWith('/manage/clubs/club-1/matches', { params: { page: 0, size: 20 } })

    await listMatches('club-1', { page: 1, teamId: 'team-1', focus: 'not-announced', upcomingOnly: true })
    expect(get).toHaveBeenLastCalledWith('/manage/clubs/club-1/matches', {
      params: { page: 1, size: 20, teamId: 'team-1', focus: 'not-announced', upcomingOnly: true },
    })
  })

  it('listMatchFilterOptions sends teamId when set', async () => {
    get.mockResolvedValue({ data: { sectionIds: [], leagueIds: [], seasonIds: [], teamIds: [] } })

    await listMatchFilterOptions('club-1', { teamId: 'team-1', upcomingOnly: true })

    expect(get).toHaveBeenCalledWith('/manage/clubs/club-1/matches/filter-options', {
      params: { teamId: 'team-1', upcomingOnly: true },
    })
  })

  it('getMatchesSummary sends only the filters that are set and returns the counters', async () => {
    const summary = { matchesShown: 12, thisWeek: 3, teamsNotAnnounced: 4, withoutPoll: 2 }
    get.mockResolvedValue({ data: summary })

    expect(await getMatchesSummary('club-1')).toEqual(summary)
    expect(get).toHaveBeenLastCalledWith('/manage/clubs/club-1/matches/summary', { params: {} })

    await getMatchesSummary('club-1', {
      sectionId: 's',
      leagueId: 'l',
      seasonId: 'y',
      teamId: 't',
      search: 'vets',
      includePast: true,
    })
    expect(get).toHaveBeenLastCalledWith('/manage/clubs/club-1/matches/summary', {
      params: { sectionId: 's', leagueId: 'l', seasonId: 'y', teamId: 't', search: 'vets', includePast: true },
    })
  })

  it('keys the summary under the list prefix so list invalidations refresh the counters', () => {
    expect(matchesSummaryKey('club-1', { teamId: 't' }).slice(0, 3)).toEqual(['managed-club', 'club-1', 'matches'])
  })
})

