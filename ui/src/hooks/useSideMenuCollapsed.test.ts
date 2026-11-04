import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SIDE_MENU_COLLAPSED_KEY, useSideMenuCollapsed } from './useSideMenuCollapsed'

describe('useSideMenuCollapsed', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('is open by default', () => {
    expect(renderHook(() => useSideMenuCollapsed()).result.current[0]).toBe(false)
  })

  it('toggles, remembers the choice and restores it on a new mount', () => {
    const first = renderHook(() => useSideMenuCollapsed())
    act(() => first.result.current[1]())
    expect(first.result.current[0]).toBe(true)
    expect(localStorage.getItem(SIDE_MENU_COLLAPSED_KEY)).toBe('true')
    first.unmount()
    expect(renderHook(() => useSideMenuCollapsed()).result.current[0]).toBe(true)
  })

  it('stays open and still toggles for the visit when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useSideMenuCollapsed())
    expect(result.current[0]).toBe(false)
    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)
  })
})
