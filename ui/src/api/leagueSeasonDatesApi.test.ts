import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import api from './axiosConfig'
import { getLeagueSeasonDates, leagueSeasonDatesKey, putLeagueSeasonDates } from './leagueSeasonDatesApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn(), put: vi.fn() } }))

const PATH = '/manage/clubs/c1/leagues/l1/seasons/s1/dates'

function failure(status: number) {
  return new AxiosError('failed', String(status), undefined, undefined, { status } as never)
}

describe('leagueSeasonDatesApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gets the dates', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { startDate: '2026-09-01', endDate: '2027-07-31' } })
    expect(await getLeagueSeasonDates('c1', 'l1', 's1')).toEqual({ startDate: '2026-09-01', endDate: '2027-07-31' })
    expect(api.get).toHaveBeenCalledWith(PATH)
  })

  it('returns null on a 404', async () => {
    vi.mocked(api.get).mockRejectedValue(failure(404))
    expect(await getLeagueSeasonDates('c1', 'l1', 's1')).toBeNull()
  })

  it('rethrows other failures', async () => {
    vi.mocked(api.get).mockRejectedValue(failure(500))
    await expect(getLeagueSeasonDates('c1', 'l1', 's1')).rejects.toBeInstanceOf(AxiosError)
  })

  it('puts the dates', async () => {
    const payload = { startDate: '2026-09-01', endDate: '2027-07-31' }
    vi.mocked(api.put).mockResolvedValue({ data: payload })
    expect(await putLeagueSeasonDates('c1', 'l1', 's1', payload)).toEqual(payload)
    expect(api.put).toHaveBeenCalledWith(PATH, payload)
  })

  it('keys under the league so league-level invalidation reaches it', () => {
    expect(leagueSeasonDatesKey('c1', 'l1', 's1').slice(0, 4)).toEqual(['managed-club', 'c1', 'leagues', 'l1'])
  })
})
