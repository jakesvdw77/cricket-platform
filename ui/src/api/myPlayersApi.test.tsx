import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from './axiosConfig'
import { getMyPlayerLeague, getMyPlayerLeagues, listMyPlayerFields, useMyPlayerLeague, useMyPlayerLeagues } from './myPlayersApi'

vi.mock('./axiosConfig', () => ({ default: { get: vi.fn() } }))

describe('myPlayersApi', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  // The axios baseURL already adds /api/v1; a second /v1 here once shipped and broke the Field Directory.
  it('asks for the fields of a player at /me/players/{key}/fields, with no extra version prefix', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })

    await expect(listMyPlayerFields('k1')).resolves.toEqual([])

    expect(api.get).toHaveBeenCalledWith('/me/players/k1/fields')
    expect(vi.mocked(api.get).mock.calls[0][0]).not.toMatch(/\/v1\//)
  })
})

describe('myPlayersApi league reads (docs/specs/123)', () => {
  beforeEach(() => vi.mocked(api.get).mockReset())

  it('lists a player\'s leagues at /me/players/{key}/leagues, with the season only when given and no version prefix', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { seasons: [], seasonId: 's1', leagues: [] } })

    await getMyPlayerLeagues('k1')
    await getMyPlayerLeagues('k1', 's0')

    expect(api.get).toHaveBeenNthCalledWith(1, '/me/players/k1/leagues', { params: undefined })
    expect(api.get).toHaveBeenNthCalledWith(2, '/me/players/k1/leagues', { params: { seasonId: 's0' } })
    for (const call of vi.mocked(api.get).mock.calls) expect(call[0]).not.toMatch(/\/v1\//)
  })

  it('reads one league at /me/players/{key}/leagues/{id}', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })

    await getMyPlayerLeague('k1', 'l1', 's0')
    await getMyPlayerLeague('k1', 'l1')

    expect(api.get).toHaveBeenNthCalledWith(1, '/me/players/k1/leagues/l1', { params: { seasonId: 's0' } })
    expect(api.get).toHaveBeenNthCalledWith(2, '/me/players/k1/leagues/l1', { params: undefined })
    for (const call of vi.mocked(api.get).mock.calls) expect(call[0]).not.toMatch(/\/v1\//)
  })

  function withClient() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
    return { client, wrapper }
  }

  it('keys the list under [me, players, key, leagues, season] so a player or season switch refetches', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { seasons: [], seasonId: 's1', leagues: [] } })
    const { client, wrapper } = withClient()

    const { result } = renderHook(() => useMyPlayerLeagues('k1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    renderHook(() => useMyPlayerLeagues('k1', 's0'), { wrapper })
    await waitFor(() => expect(client.getQueryCache().find({ queryKey: ['me', 'players', 'k1', 'leagues', 's0'] })).toBeDefined())

    expect(client.getQueryCache().find({ queryKey: ['me', 'players', 'k1', 'leagues', 'current'] })).toBeDefined()
  })

  it('keys a league under [me, players, key, leagues, id, season] and does not fetch without a key or id', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: {} })
    const { client, wrapper } = withClient()

    renderHook(() => useMyPlayerLeague('k1', 'l1'), { wrapper })
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))
    renderHook(() => useMyPlayerLeague(undefined, 'l1'), { wrapper })
    renderHook(() => useMyPlayerLeague('k1', undefined), { wrapper })
    renderHook(() => useMyPlayerLeagues(undefined), { wrapper })

    expect(client.getQueryCache().find({ queryKey: ['me', 'players', 'k1', 'leagues', 'l1', 'current'] })).toBeDefined()
    expect(api.get).toHaveBeenCalledTimes(1)
  })
})
