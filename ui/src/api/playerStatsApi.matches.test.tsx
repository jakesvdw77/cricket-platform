import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPlayerMatches, PLAYER_MATCHES_PAGE_SIZE, usePlayerMatches } from './playerStatsApi'
import { defaultMatchesServer, makeRows, playerMatchesApi } from '../test/playerMatchesFixtures'
import type { MatchesServer } from '../test/playerMatchesFixtures'

// docs/specs/115-player-match-list.md, "API and hook": getPlayerMatches sends only the filters that are set plus direction/page/size;
// usePlayerMatches is an infinite query of 20, keyed under the stats prefix.
const apiGet = vi.fn()
vi.mock('./axiosConfig', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }))

let server: MatchesServer
beforeEach(() => {
  server = defaultMatchesServer(makeRows(45))
  apiGet.mockReset()
  apiGet.mockImplementation((url: string, config?: unknown) => playerMatchesApi(server).get(url, config as never))
})

describe('getPlayerMatches', () => {
  it('calls the matches url with direction, page and the default size of 20, and no filter params when none is set', async () => {
    await getPlayerMatches('club-1', 'player-1', {}, 'desc', 0)
    expect(apiGet).toHaveBeenCalledWith('/manage/clubs/club-1/players/player-1/stats/matches', {
      params: { direction: 'desc', page: 0, size: 20 },
    })
  })

  it('sends the filters that are set and drops the empty ones', async () => {
    await getPlayerMatches(
      'club-1', 'player-1',
      { seasonId: 's1', leagueId: null, teamId: 't1', sectionId: '', competition: 'FRIENDLY' },
      'asc', 2, 5,
    )
    expect(apiGet.mock.calls[0][1].params).toEqual({ seasonId: 's1', teamId: 't1', competition: 'FRIENDLY', direction: 'asc', page: 2, size: 5 })
  })
})

describe('usePlayerMatches', () => {
  const wrapper = (client: QueryClient) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }

  it('pages 20 at a time, appends on fetchNextPage, and stops when hasMore is false', async () => {
    expect(PLAYER_MATCHES_PAGE_SIZE).toBe(20)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => usePlayerMatches('club-1', 'player-1', {}, 'desc'), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.rows).toHaveLength(20))
    expect(result.current.hasNextPage).toBe(true)

    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.rows).toHaveLength(40))
    expect(server.calls.map((c) => c.page)).toEqual([0, 1])
    expect(result.current.rows[20].matchId).toBe('match-21')

    await act(async () => { await result.current.fetchNextPage() })
    await waitFor(() => expect(result.current.rows).toHaveLength(45))
    expect(result.current.hasNextPage).toBe(false)
    expect(result.current.lastPage?.page.totalElements).toBe(45)
    expect(result.current.firstPage?.page.number).toBe(0)
  })

  it('is keyed under the stats prefix with the filters then the direction, and is disabled without a club or player', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const filters = { seasonId: 's1', competition: 'LEAGUE' as const }
    const { result } = renderHook(() => usePlayerMatches('club-1', 'player-1', filters, 'asc'), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.firstPage).toBeDefined())
    const keys = client.getQueryCache().getAll().map((query) => query.queryKey)
    expect(keys).toContainEqual([
      'managed-club', 'club-1', 'players', 'player-1', 'stats', 'matches',
      { seasonId: 's1', leagueId: null, teamId: null, sectionId: null, competition: 'LEAGUE' },
      'asc',
    ])

    apiGet.mockClear()
    const { result: idle } = renderHook(() => usePlayerMatches(undefined, 'player-1', {}, 'desc'), { wrapper: wrapper(client) })
    expect(idle.current.rows).toEqual([])
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('a refresh of the stats prefix refetches the list', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { result } = renderHook(() => usePlayerMatches('club-1', 'player-1', {}, 'desc'), { wrapper: wrapper(client) })
    await waitFor(() => expect(result.current.rows).toHaveLength(20))
    await act(async () => { await client.invalidateQueries({ queryKey: ['managed-club', 'club-1', 'players', 'player-1', 'stats'] }) })
    await waitFor(() => expect(server.calls.length).toBeGreaterThanOrEqual(2))
  })
})
