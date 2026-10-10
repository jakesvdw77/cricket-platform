import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { duplicateLeague } from './leagueApi'
import type { DuplicateLeagueResponse } from './leagueApi'

vi.mock('./axiosConfig', () => ({ default: { post: vi.fn() } }))

describe('leagueApi duplicateLeague', () => {
  beforeEach(() => vi.mocked(api.post).mockReset())

  it('POSTs the request to the league duplicate endpoint and returns the response data', async () => {
    const response: DuplicateLeagueResponse = {
      leagueId: 'new-1',
      name: 'Division 2',
      seasonsCopied: 1,
      playingConditionsCopied: 1,
      contactsCopied: 2,
    }
    vi.mocked(api.post).mockResolvedValueOnce({ data: response })
    const request = { name: 'Division 2', seasonIds: ['s-1'], copyPlayingConditions: true, copyContacts: false }

    await expect(duplicateLeague('club-1', 'league-1', request)).resolves.toBe(response)
    expect(api.post).toHaveBeenCalledWith('/manage/clubs/club-1/leagues/league-1/duplicate', request)
  })
})
