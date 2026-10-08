import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChangeAnswer } from './useChangeAnswer'
import { useRoundWindowIds } from './useRoundWindowIds'
import { at, makeGame, makePlayer } from './testData'

const setPlayerStatus = vi.fn()
const setRoundPlayerStatus = vi.fn()
const getRoundMatches = vi.fn()

vi.mock('../../../api/matchAvailabilityApi', () => ({
  setPlayerStatus: (...args: unknown[]) => setPlayerStatus(...args),
}))
vi.mock('../../../api/sectionAvailabilityApi', () => ({
  setRoundPlayerStatus: (...args: unknown[]) => setRoundPlayerStatus(...args),
  getRoundMatches: (...args: unknown[]) => getRoundMatches(...args),
}))

const SQUAD = makeGame({ matchId: 'm-squad', pollType: 'SQUAD', pollId: 'poll-9', roundId: null, matchDate: at(10, 3, 9) })
const GROUP = makeGame({ matchId: 'm-group', pollType: 'GROUP', pollId: 'round-1', roundId: 'round-1', matchDate: at(10, 3, 14) })
const NO_POLL = makeGame({ matchId: 'm-none', pollType: null, pollId: null, roundId: null })
const PLAYER = makePlayer('p1', 'Jane', 'Smith', 7, [['m-squad', 'UNSURE'], ['m-group', 'UNSURE']])

let client: QueryClient
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  setPlayerStatus.mockResolvedValue({})
  setRoundPlayerStatus.mockResolvedValue({})
  getRoundMatches.mockResolvedValue([
    { matchId: 'm-group', windowId: 'win-7' },
    { matchId: 'm-other', windowId: 'win-8' },
  ])
})

describe('useChangeAnswer (085 F)', () => {
  it('saves a squad poll game with setPlayerStatus and refreshes the grid and counters', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useChangeAnswer('club-1'), { wrapper })

    let ok = false
    await act(async () => {
      ok = await result.current.handlers.onChange(PLAYER, SQUAD, 'AVAILABLE')
    })

    expect(ok).toBe(true)
    expect(setPlayerStatus).toHaveBeenCalledWith('club-1', 'm-squad', 'poll-9', 'p1', 'AVAILABLE')
    expect(setRoundPlayerStatus).not.toHaveBeenCalled()
    const keys = invalidate.mock.calls.map((call) => JSON.stringify((call[0] as { queryKey: unknown }).queryKey))
    expect(keys).toContain(JSON.stringify(['managed-club', 'club-1', 'player-availability']))
    expect(keys).toContain(JSON.stringify(['managed-club', 'club-1', 'availability-summary']))
    expect(keys).toContain(JSON.stringify(['managed-club', 'club-1', 'availability-polls']))
    expect(keys).toContain(JSON.stringify(['managed-club', 'club-1', 'section-availability-rounds']))
    expect(result.current.handlers.pendingKeys.size).toBe(0)
  })

  it('saves a group poll game with setRoundPlayerStatus and the window id looked up from the round matches', async () => {
    const { result } = renderHook(() => useChangeAnswer('club-1'), { wrapper })

    await act(async () => {
      await result.current.handlers.onChange(PLAYER, GROUP, 'UNAVAILABLE')
    })

    expect(getRoundMatches).toHaveBeenCalledWith('club-1', 'round-1')
    expect(setRoundPlayerStatus).toHaveBeenCalledWith('club-1', 'round-1', 'p1', 'win-7', 'UNAVAILABLE')
  })

  it('fetches a round\'s matches once and serves the next answer from the cache', async () => {
    const { result } = renderHook(() => useChangeAnswer('club-1'), { wrapper })

    await act(async () => {
      await result.current.handlers.onChange(PLAYER, GROUP, 'AVAILABLE')
    })
    await act(async () => {
      await result.current.handlers.onChange(PLAYER, GROUP, 'UNSURE')
    })

    expect(getRoundMatches).toHaveBeenCalledTimes(1)
    expect(setRoundPlayerStatus).toHaveBeenCalledTimes(2)
  })

  it('reports a failure, does not refresh, and surfaces the error message', async () => {
    setPlayerStatus.mockRejectedValue(new Error('boom'))
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useChangeAnswer('club-1'), { wrapper })

    let ok = true
    await act(async () => {
      ok = await result.current.handlers.onChange(PLAYER, SQUAD, 'AVAILABLE')
    })

    expect(ok).toBe(false)
    await waitFor(() => expect(result.current.error).toBe('Something went wrong saving that answer. Please try again.'))
    expect(invalidate).not.toHaveBeenCalled()
    expect(result.current.handlers.pendingKeys.size).toBe(0)
  })

  it('refuses a game without a poll', async () => {
    const { result } = renderHook(() => useChangeAnswer('club-1'), { wrapper })

    let ok = true
    await act(async () => {
      ok = await result.current.handlers.onChange(PLAYER, NO_POLL, 'AVAILABLE')
    })

    expect(ok).toBe(false)
    expect(setPlayerStatus).not.toHaveBeenCalled()
    expect(setRoundPlayerStatus).not.toHaveBeenCalled()
  })

  it('fails when the round has no window for the match', async () => {
    getRoundMatches.mockResolvedValue([])
    const { result } = renderHook(() => useChangeAnswer('club-1'), { wrapper })

    let ok = true
    await act(async () => {
      ok = await result.current.handlers.onChange(PLAYER, GROUP, 'AVAILABLE')
    })

    expect(ok).toBe(false)
    expect(setRoundPlayerStatus).not.toHaveBeenCalled()
    // Its own message, not the generic retry text.
    expect(result.current.error).toBe('This game changed since the grid loaded. Refresh the page and try again.')
  })

  it('keeps both cells pending while two saves overlap, and each re-enables only when its own save settles', async () => {
    let finishFirst: () => void = () => undefined
    setPlayerStatus.mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve }))
    const second = makeGame({ matchId: 'm-second', pollType: 'SQUAD', pollId: 'poll-2', roundId: null })
    const { result } = renderHook(() => useChangeAnswer('club-1'), { wrapper })

    let firstDone: Promise<boolean> = Promise.resolve(false)
    act(() => {
      firstDone = result.current.handlers.onChange(PLAYER, SQUAD, 'AVAILABLE')
    })
    await act(async () => {
      await result.current.handlers.onChange(PLAYER, second, 'AVAILABLE')
    })

    // The second save finished; the first is still running and its cell is still disabled.
    expect([...result.current.handlers.pendingKeys]).toEqual(['p1:m-squad'])
    await act(async () => {
      finishFirst()
      await firstDone
    })
    expect(result.current.handlers.pendingKeys.size).toBe(0)
  })

  it('keeps a failure visible when another save succeeds afterwards, and clears it on the next attempt', async () => {
    setPlayerStatus.mockRejectedValueOnce(new Error('boom'))
    const { result } = renderHook(() => useChangeAnswer('club-1'), { wrapper })

    await act(async () => {
      await result.current.handlers.onChange(PLAYER, SQUAD, 'AVAILABLE')
    })
    expect(result.current.error).toBe('Something went wrong saving that answer. Please try again.')
    await act(async () => {
      await result.current.handlers.onChange(PLAYER, SQUAD, 'UNSURE')
    })
    expect(result.current.error).toBeNull()
  })
})

describe('useRoundWindowIds (085 F)', () => {
  it('maps a match to its window through the round matches, loading them once per round', async () => {
    const { result } = renderHook(() => useRoundWindowIds('club-1'), { wrapper })

    await expect(result.current('round-1', 'm-group')).resolves.toBe('win-7')
    await expect(result.current('round-1', 'm-other')).resolves.toBe('win-8')
    expect(getRoundMatches).toHaveBeenCalledTimes(1)
    await expect(result.current('round-1', 'm-missing')).rejects.toThrow(/No window/)
  })
})
