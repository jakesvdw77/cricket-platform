import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { getSeasonsSummary, seasonsSummaryKey } from './seasonApi'
import type { SeasonsSummary } from './seasonApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('seasonApi summary', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('GETs the club seasons summary and returns its data', async () => {
    const summary: SeasonsSummary = { seasons: [{ seasonId: 's-1', leagueCount: 2, teamsEntered: 3, matchCount: 40 }] }
    vi.mocked(api.get).mockResolvedValueOnce({ data: summary })

    await expect(getSeasonsSummary('club-1')).resolves.toBe(summary)
    expect(api.get).toHaveBeenCalledWith('/manage/clubs/club-1/seasons/summary')
  })

  it('keys the summary under the seasons list prefix so season writes invalidate it', () => {
    expect(seasonsSummaryKey('club-1')).toEqual(['managed-club', 'club-1', 'seasons', 'summary'])
    expect(seasonsSummaryKey('club-1').slice(0, 3)).toEqual(['managed-club', 'club-1', 'seasons'])
  })
})
