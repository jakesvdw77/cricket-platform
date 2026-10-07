import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { listRounds } from './sectionAvailabilityApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('sectionAvailabilityApi listRounds (docs/specs/083)', () => {
  beforeEach(() => vi.mocked(api.get).mockReset().mockResolvedValue({ data: [] }))

  it('sends section, open, league and team only when set', async () => {
    await listRounds('club-1', { open: true })
    expect(vi.mocked(api.get).mock.lastCall?.[1]).toEqual({ params: { open: true } })

    await listRounds('club-1', { sectionId: 's-1', open: false, leagueId: 'l-1', teamId: 't-1' })
    expect(vi.mocked(api.get).mock.lastCall?.[1]).toEqual({
      params: { sectionId: 's-1', open: false, leagueId: 'l-1', teamId: 't-1' },
    })
  })
})
