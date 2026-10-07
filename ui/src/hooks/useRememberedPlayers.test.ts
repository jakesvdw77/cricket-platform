import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRememberedPlayers } from './useRememberedPlayers'
import { REMEMBERED_PLAYERS_KEY } from '../utils/rememberedPlayers'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('useRememberedPlayers', () => {
  it('is empty until the club is known', () => {
    const { result } = renderHook(() => useRememberedPlayers(null, 'poll-1'))
    expect(result.current.players).toEqual([])
    act(() => result.current.remember('Liam', 'Carter'))
    expect(localStorage.getItem(REMEMBERED_PLAYERS_KEY)).toBeNull()
  })

  it('remembers after a save and reports the answered time for this poll only', () => {
    const { result, rerender } = renderHook(({ pollId }) => useRememberedPlayers('club-1', pollId), {
      initialProps: { pollId: 'poll-1' },
    })
    act(() => result.current.remember('Liam', 'Carter'))
    expect(result.current.players).toHaveLength(1)
    expect(result.current.players[0].answeredAt).not.toBeNull()
    rerender({ pollId: 'poll-2' })
    expect(result.current.players[0].answeredAt).toBeNull()
  })

  it('removes one and forgets all', () => {
    const { result } = renderHook(() => useRememberedPlayers('club-1', 'poll-1'))
    act(() => result.current.remember('Liam', 'Carter'))
    act(() => result.current.remember('Emma', 'Carter'))
    act(() => result.current.remove({ firstName: 'Liam', lastName: 'Carter' }))
    expect(result.current.players.map((p) => p.firstName)).toEqual(['Emma'])
    act(() => result.current.forgetAll())
    expect(result.current.players).toEqual([])
  })

  it('works when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useRememberedPlayers('club-1', 'poll-1'))
    expect(() => act(() => result.current.remember('Liam', 'Carter'))).not.toThrow()
    expect(result.current.players).toEqual([])
  })
})
