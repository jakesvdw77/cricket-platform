import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { getManagerOverview } from './overviewApi'
import type { ManagerOverview } from './overviewApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('getManagerOverview', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('GETs the club overview and returns its data', async () => {
    const overview = { matchesThisWeek: 2 } as ManagerOverview
    vi.mocked(api.get).mockResolvedValueOnce({ data: overview })

    await expect(getManagerOverview('club-1')).resolves.toBe(overview)
    expect(api.get).toHaveBeenCalledWith('/manage/clubs/club-1/overview')
  })
})
