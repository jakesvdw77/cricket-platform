import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { getSectionsSummary, sectionsSummaryKey } from './sectionApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('sectionApi getSectionsSummary (docs/specs/094)', () => {
  beforeEach(() => vi.mocked(api.get).mockReset().mockResolvedValue({ data: { totals: { sections: 0, teams: 0, players: 0 }, sections: [] } }))

  it('calls the club summary path without params when no season is set', async () => {
    const result = await getSectionsSummary('club-1')
    expect(vi.mocked(api.get).mock.lastCall).toEqual(['/manage/clubs/club-1/sections/summary', { params: {} }])
    expect(result.totals.sections).toBe(0)
  })

  it('sends seasonId only when set', async () => {
    await getSectionsSummary('club-1', { seasonId: 'se-1' })
    expect(vi.mocked(api.get).mock.lastCall?.[1]).toEqual({ params: { seasonId: 'se-1' } })
  })
})

describe('sectionsSummaryKey', () => {
  it('sits under the sections prefix and adds the season only when given', () => {
    expect(sectionsSummaryKey('club-1')).toEqual(['managed-club', 'club-1', 'sections', 'summary'])
    expect(sectionsSummaryKey('club-1', 'se-1')).toEqual(['managed-club', 'club-1', 'sections', 'summary', 'se-1'])
  })
})
