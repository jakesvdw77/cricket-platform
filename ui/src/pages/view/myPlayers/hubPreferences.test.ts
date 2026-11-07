import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readHubFlag, useHubFlag, writeHubFlag } from './hubPreferences'
import { HUB_TICKER_KEY, useHubTickerPreference } from './useHubTickerPreference'

// Per-device Hub preferences: 'off' switches one off, everything else (absent, corrupt, storage unavailable) is on.
beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('hubPreferences', () => {
  it('is on by default, and off only for the value off', () => {
    expect(readHubFlag('k')).toBe(true)
    localStorage.setItem('k', 'off')
    expect(readHubFlag('k')).toBe(false)
    localStorage.setItem('k', 'garbage')
    expect(readHubFlag('k')).toBe(true)
  })

  it('is on when storage cannot be read, and a failed write does not throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(readHubFlag('k')).toBe(true)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => writeHubFlag('k', false)).not.toThrow()
  })

  it('writes off as the value off and on by removing the key', () => {
    writeHubFlag('k', false)
    expect(localStorage.getItem('k')).toBe('off')
    writeHubFlag('k', true)
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('updates a mounted hook in the same tab and on a storage event from another tab', () => {
    const { result } = renderHook(() => useHubFlag('k'))
    expect(result.current[0]).toBe(true)

    act(() => result.current[1](false))
    expect(result.current[0]).toBe(false)

    act(() => {
      localStorage.removeItem('k')
      window.dispatchEvent(new StorageEvent('storage', { key: 'k' }))
    })
    expect(result.current[0]).toBe(true)
  })
})

describe('useHubTickerPreference', () => {
  it('reads and writes hub:ticker', () => {
    const { result } = renderHook(() => useHubTickerPreference())
    expect(result.current[0]).toBe(true)
    act(() => result.current[1](false))
    expect(localStorage.getItem(HUB_TICKER_KEY)).toBe('off')
    expect(result.current[0]).toBe(false)
  })
})
