import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import api from './axiosConfig'
import { availabilitySummaryKey, getAvailabilitySummary, typeFilterFor, invalidateAvailabilityCounters } from './availabilitySummaryApi'
import type { AvailabilitySummary } from './availabilitySummaryApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('availabilitySummaryApi', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('GETs the club availability summary and returns its data', async () => {
    const summary = { openPolls: 2 } as AvailabilitySummary
    vi.mocked(api.get).mockResolvedValueOnce({ data: summary })

    await expect(getAvailabilitySummary('club-1')).resolves.toBe(summary)
    expect(api.get).toHaveBeenCalledWith('/manage/clubs/club-1/availability/summary', { params: {} })
  })

  it('sends only the filters that are set', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })

    await getAvailabilitySummary('club-1', {
      leagueId: 'l-1', sectionId: 's-1', teamId: 't-1', type: 'SQUAD', includeClosed: true,
    })
    expect(api.get).toHaveBeenLastCalledWith('/manage/clubs/club-1/availability/summary', {
      params: { leagueId: 'l-1', sectionId: 's-1', teamId: 't-1', type: 'SQUAD', includeClosed: true },
    })

    await getAvailabilitySummary('club-1', { leagueId: null, sectionId: null, type: 'ALL', includeClosed: false })
    expect(api.get).toHaveBeenLastCalledWith('/manage/clubs/club-1/availability/summary', { params: {} })
  })

  it('derives the poll type from the two toggles', () => {
    expect(typeFilterFor(true, true)).toBe('ALL')
    expect(typeFilterFor(true, false)).toBe('GROUP')
    expect(typeFilterFor(false, true)).toBe('SQUAD')
  })

  it('keys the summary per club', () => {
    expect(availabilitySummaryKey('club-1', {})).toEqual(['managed-club', 'club-1', 'availability-summary', {}])
  })

  it('keeps the filtered key under the invalidation prefix and distinct per filter', () => {
    const key = availabilitySummaryKey('club-1', { sectionId: 's-1', includeClosed: true })
    expect(key.slice(0, 3)).toEqual(['managed-club', 'club-1', 'availability-summary'])
    expect(key).not.toEqual(availabilitySummaryKey('club-1', { sectionId: 's-1' }))
  })

  it('invalidates the summary and the overview keys', () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')

    invalidateAvailabilityCounters(client, 'club-1')

    expect(spy).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'availability-summary'] })
    expect(spy).toHaveBeenCalledWith({ queryKey: ['managed-club', 'club-1', 'overview'] })
  })
})
