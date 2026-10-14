import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PLAYER_NAME_MODE_KEY, resetPlayerNameModeForTests, usePlayerNameMode } from './usePlayerNameMode'

describe('usePlayerNameMode (docs/specs/101)', () => {
  beforeEach(() => {
    localStorage.clear()
    resetPlayerNameModeForTests()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('defaults to Full name', () => {
    expect(renderHook(() => usePlayerNameMode()).result.current[0]).toBe('full')
  })

  it('restores the remembered mode', () => {
    localStorage.setItem(PLAYER_NAME_MODE_KEY, 'first')
    expect(renderHook(() => usePlayerNameMode()).result.current[0]).toBe('first')
  })

  it('saves the choice and a new mount gets it back', () => {
    const first = renderHook(() => usePlayerNameMode())
    act(() => first.result.current[1]('first'))

    expect(localStorage.getItem(PLAYER_NAME_MODE_KEY)).toBe('first')
    first.unmount()
    expect(renderHook(() => usePlayerNameMode()).result.current[0]).toBe('first')
  })

  it('changes every user of the hook at once', () => {
    const toggle = renderHook(() => usePlayerNameMode())
    const label = renderHook(() => usePlayerNameMode())
    act(() => toggle.result.current[1]('first'))

    expect(label.result.current[0]).toBe('first')
  })

  it('ignores a stored value it does not know', () => {
    localStorage.setItem(PLAYER_NAME_MODE_KEY, 'nickname')
    expect(renderHook(() => usePlayerNameMode()).result.current[0]).toBe('full')
  })

  it('still works for this visit when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => usePlayerNameMode())

    expect(result.current[0]).toBe('full')
    act(() => result.current[1]('first'))
    expect(result.current[0]).toBe('first')
  })
})
