import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getLeagueSeasonDates } from '../api/leagueSeasonDatesApi'
import { useLeagueDatesHint } from './useLeagueDatesHint'

vi.mock('../api/leagueSeasonDatesApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/leagueSeasonDatesApi')>()),
  getLeagueSeasonDates: vi.fn(),
}))

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

describe('useLeagueDatesHint', () => {
  beforeEach(() => {
    vi.mocked(getLeagueSeasonDates).mockReset()
    vi.mocked(getLeagueSeasonDates).mockResolvedValue({ startDate: '2026-09-01', endDate: '2027-07-31' })
  })

  it('says nothing and does not look up without a league and season', () => {
    const { result } = renderHook(() => useLeagueDatesHint('c1', '', 's1', '2030-01-01'), { wrapper })
    expect(result.current).toEqual({ range: null, outside: false, message: undefined })
    expect(getLeagueSeasonDates).not.toHaveBeenCalled()
  })

  it('reports a day outside the range with the league wording', async () => {
    const { result } = renderHook(() => useLeagueDatesHint('c1', 'l1', 's1', '2027-08-01T10:00'), { wrapper })
    await waitFor(() => expect(result.current.outside).toBe(true))
    expect(result.current.message).toMatch(/^This league runs from .+ to .+\.$/)
    expect(result.current.range).toEqual({ startDate: '2026-09-01', endDate: '2027-07-31' })
  })

  it('has no message for a day inside the range or a blank day', async () => {
    const { result, rerender } = renderHook(({ day }) => useLeagueDatesHint('c1', 'l1', 's1', day), { wrapper, initialProps: { day: '2026-10-01' } })
    await waitFor(() => expect(result.current.range).not.toBeNull())
    expect(result.current.outside).toBe(false)
    rerender({ day: '' })
    expect(result.current.outside).toBe(false)
    expect(result.current.message).toBeUndefined()
  })

  it('stays unrestricted when the lookup finds no dates', async () => {
    vi.mocked(getLeagueSeasonDates).mockResolvedValue(null)
    const { result } = renderHook(() => useLeagueDatesHint('c1', 'l1', 's1', '2030-01-01'), { wrapper })
    await waitFor(() => expect(getLeagueSeasonDates).toHaveBeenCalled())
    expect(result.current.outside).toBe(false)
  })
})
