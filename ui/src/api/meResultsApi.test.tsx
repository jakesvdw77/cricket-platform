import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import {
  RESULTS_PAGE_SIZE, getMyPlayerResult, getMyPlayerResults, getMyPlayerResultsFilters, getMyPlayerResultsSummary, myResultsKey,
  useMyPlayerResult, useMyPlayerResults, useMyPlayerResultsFilters, useMyPlayerResultsSummaries, useMyPlayerResultsSummary,
} from './meResultsApi'
import { newQueryClient } from '../test/accountTestUtils'
import { battingRow, makeResultDetail, makeResultList, makeResultSummary } from '../test/hubResultFixtures'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

// docs/specs/145: every read is under /me/players/{key}/results; only the scope parts that are set are sent; the hooks are keyed by
// player and scope, wait for their `enabled`, and page by the server's hasMore.
const get = vi.mocked(api.get)
const FULL = { seasonId: 's1', teamId: 't1', leagueId: 'l1', competition: 'FRIENDLY' as const }

function wrapper() {
  const client = newQueryClient()
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  get.mockReset()
  get.mockResolvedValue({ data: {} })
})

describe('meResultsApi requests', () => {
  it('sends no scope params for an empty scope, with the page and the fixed page size', async () => {
    await getMyPlayerResults('k1', {}, 0)
    expect(get).toHaveBeenCalledWith('/me/players/k1/results', { params: { page: 0, size: RESULTS_PAGE_SIZE } })
  })

  it('sends exactly the scope parts that are set and omits null ones', async () => {
    await getMyPlayerResults('k1', FULL, 2)
    await getMyPlayerResultsSummary('k1', { seasonId: 's1', teamId: null, leagueId: undefined })
    expect(get).toHaveBeenNthCalledWith(1, '/me/players/k1/results', { params: { seasonId: 's1', teamId: 't1', leagueId: 'l1', competition: 'FRIENDLY', page: 2, size: RESULTS_PAGE_SIZE } })
    expect(get).toHaveBeenNthCalledWith(2, '/me/players/k1/results/summary', { params: { seasonId: 's1' } })
  })

  it('reads the filters and one result without params', async () => {
    await getMyPlayerResultsFilters('k1')
    await getMyPlayerResult('k1', 'm9')
    expect(get).toHaveBeenNthCalledWith(1, '/me/players/k1/results/filters')
    expect(get).toHaveBeenNthCalledWith(2, '/me/players/k1/results/m9')
  })

  it('keys every read under the player so a different player never shares a cache entry', () => {
    expect(myResultsKey('k1')).toEqual(['me', 'players', 'k1', 'results'])
    expect(myResultsKey('k1')).not.toEqual(myResultsKey('k2'))
  })
})

describe('meResultsApi hooks', () => {
  it('pages the list by the server hasMore and stops when there is no more', async () => {
    get.mockImplementation(async (_url, config) => {
      const page = (config?.params as { page: number }).page
      return { data: makeResultList([battingRow({ matchId: `m${page}` })], { page: { number: page, size: 1, totalElements: 2, hasMore: page === 0 } }) }
    })
    const { result } = renderHook(() => useMyPlayerResults('k1', {}), { wrapper: wrapper() })
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1))
    expect(result.current.hasNextPage).toBe(true)
    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(false)
    expect(get.mock.calls.map((call) => (call[1]?.params as { page: number }).page)).toEqual([0, 1])
  })

  it('does not ask while disabled or without a key', async () => {
    const wrap = wrapper()
    renderHook(() => useMyPlayerResults('k1', {}, false), { wrapper: wrap })
    renderHook(() => useMyPlayerResultsSummary(undefined, {}), { wrapper: wrap })
    renderHook(() => useMyPlayerResultsFilters(undefined), { wrapper: wrap })
    renderHook(() => useMyPlayerResult('k1', undefined), { wrapper: wrap })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(get).not.toHaveBeenCalled()
  })

  it('reads the summary, the filters and one result', async () => {
    get.mockImplementation(async (url) => ({ data: url.endsWith('/summary') ? makeResultSummary({ matches: 7 }) : url.endsWith('/filters') ? { seasons: [], teams: [], leagues: [], combos: [] } : makeResultDetail() }))
    const wrap = wrapper()
    const summary = renderHook(() => useMyPlayerResultsSummary('k1', FULL), { wrapper: wrap })
    const filters = renderHook(() => useMyPlayerResultsFilters('k1'), { wrapper: wrap })
    const detail = renderHook(() => useMyPlayerResult('k1', 'm1'), { wrapper: wrap })
    await waitFor(() => expect(summary.result.current.data?.matches).toBe(7))
    await waitFor(() => expect(filters.result.current.data?.seasons).toEqual([]))
    await waitFor(() => expect(detail.result.current.data?.venue).toBe('Main Oval'))
  })

  it('asks one summary per scope, each with its own scope params', async () => {
    get.mockResolvedValue({ data: makeResultSummary() })
    const scopes = [{ seasonId: 's1' }, { seasonId: 's1', leagueId: 'l1' }]
    const many = renderHook(() => useMyPlayerResultsSummaries('k1', scopes), { wrapper: wrapper() })
    await waitFor(() => expect(many.result.current.every((query) => query.data)).toBe(true))
    expect(get.mock.calls.map((call) => call[1])).toEqual([{ params: { seasonId: 's1' } }, { params: { seasonId: 's1', leagueId: 'l1' } }])
  })
})
