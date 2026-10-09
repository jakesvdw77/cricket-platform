import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useListViewPreference } from './useListViewPreference'

const KEY = 'playerList:view'

describe('useListViewPreference (docs/specs/088)', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to cards, or to the default the page passes', () => {
    expect(renderHook(() => useListViewPreference(KEY)).result.current[0]).toBe('cards')
    expect(renderHook(() => useListViewPreference(KEY, 'list')).result.current[0]).toBe('list')
  })

  it('restores the remembered view on the first render', () => {
    localStorage.setItem(KEY, 'list')

    expect(renderHook(() => useListViewPreference(KEY)).result.current[0]).toBe('list')
  })

  it('saves the choice the moment it changes, and a new mount gets it back', () => {
    const first = renderHook(() => useListViewPreference(KEY))

    act(() => first.result.current[1]('list'))

    expect(first.result.current[0]).toBe('list')
    expect(localStorage.getItem(KEY)).toBe('list')
    first.unmount()
    const second = renderHook(() => useListViewPreference(KEY))
    expect(second.result.current[0]).toBe('list')

    act(() => second.result.current[1]('cards'))
    expect(localStorage.getItem(KEY)).toBe('cards')
  })

  it('remembers each page under its own key', () => {
    const players = renderHook(() => useListViewPreference('playerList:view'))
    act(() => players.result.current[1]('list'))

    expect(renderHook(() => useListViewPreference('matchList:view')).result.current[0]).toBe('cards')
  })

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(KEY, 'grid')

    expect(renderHook(() => useListViewPreference(KEY)).result.current[0]).toBe('cards')
  })

  it('still works for this visit when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useListViewPreference(KEY))

    expect(result.current[0]).toBe('cards')
    act(() => result.current[1]('list'))
    expect(result.current[0]).toBe('list')
  })
})
