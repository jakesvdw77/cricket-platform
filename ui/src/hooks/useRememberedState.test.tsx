import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useRememberedState } from './useRememberedState'

describe('useRememberedState', () => {
  beforeEach(() => localStorage.clear())

  it('starts from the default and saves each change under its key', () => {
    const { result } = renderHook(() => useRememberedState<string>('k:one', 'a'))
    expect(result.current[0]).toBe('a')
    act(() => result.current[1]('b'))
    expect(result.current[0]).toBe('b')
    expect(JSON.parse(localStorage.getItem('k:one') as string)).toBe('b')
  })

  it('starts from what was saved, so a filter comes back on the next visit', () => {
    localStorage.setItem('k:two', JSON.stringify('saved'))
    const { result } = renderHook(() => useRememberedState<string>('k:two', 'a'))
    expect(result.current[0]).toBe('saved')
  })

  it('ignores a saved value that is not valid, and one that is not JSON', () => {
    localStorage.setItem('k:bad', JSON.stringify('nonsense'))
    const { result, rerender } = renderHook(({ key }) => useRememberedState<'x' | 'y'>(key, 'x', (value) => value === 'x' || value === 'y'), { initialProps: { key: 'k:bad' } })
    expect(result.current[0]).toBe('x')
    localStorage.setItem('k:junk', '{not json')
    rerender({ key: 'k:junk' })
    expect(result.current[0]).toBe('x')
  })

  it('loads the new key\'s own value when the key changes (another club), and does not overwrite it with the old value', () => {
    localStorage.setItem('k:club-2', JSON.stringify('two'))
    const { result, rerender } = renderHook(({ key }) => useRememberedState<string>(key, 'a'), { initialProps: { key: 'k:club-1' } })
    act(() => result.current[1]('one'))
    rerender({ key: 'k:club-2' })
    expect(result.current[0]).toBe('two')
    expect(JSON.parse(localStorage.getItem('k:club-1') as string)).toBe('one')
    expect(JSON.parse(localStorage.getItem('k:club-2') as string)).toBe('two')
  })

  it('does not save while the key is not known yet', () => {
    const { result } = renderHook(() => useRememberedState<string>(null, 'a'))
    act(() => result.current[1]('b'))
    expect(result.current[0]).toBe('b')
    expect(localStorage.length).toBe(0)
  })
})
