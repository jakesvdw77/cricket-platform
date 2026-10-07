import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import api from './axiosConfig'
import { availabilitySummaryKey, getAvailabilitySummary, invalidateAvailabilityCounters } from './availabilitySummaryApi'
import type { AvailabilitySummary } from './availabilitySummaryApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('availabilitySummaryApi', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('GETs the club availability summary and returns its data', async () => {
    const summary = { openPolls: 2 } as AvailabilitySummary
    vi.mocked(api.get).mockResolvedValueOnce({ data: summary })

    await expect(getAvailabilitySummary('club-1')).resolves.toBe(summary)
    expect(api.get).toHaveBeenCalledWith('/manage/clubs/club-1/availability/summary')
  })

  it('keys the summary per club', () => {
    expect(availabilitySummaryKey('club-1')).toEqual(['managed-club', 'club-1', 'availability-summary'])
  })

  it('invalidates the summary and the overview keys', () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')

    invalidateAvailabilityCounters(client, 'club-1')

    expect(spy).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'availability-summary'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'overview'] })
  })
})
