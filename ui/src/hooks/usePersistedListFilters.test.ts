import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePersistedListFilters } from './usePersistedListFilters'

interface Filters extends Record<string, unknown> {
  sectionId: string | null
}

const DEFAULTS: Filters = { sectionId: null }

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('usePersistedListFilters', () => {
  it('starts from defaults when nothing is persisted yet', () => {
    const { result } = renderHook(() => usePersistedListFilters('test:filters', DEFAULTS))

    expect(result.current[0]).toEqual(DEFAULTS)
  })

  it('round-trips a set value across a simulated remount', () => {
    const { result, unmount } = renderHook(() => usePersistedListFilters('test:filters', DEFAULTS))

    act(() => {
      result.current[1]({ sectionId: 'section-1' })
    })
    expect(result.current[0]).toEqual({ sectionId: 'section-1' })

    unmount()

    const { result: remounted } = renderHook(() => usePersistedListFilters('test:filters', DEFAULTS))
    expect(remounted.current[0]).toEqual({ sectionId: 'section-1' })
  })

  it('falls back to defaults when the storage key is missing', () => {
    const { result } = renderHook(() => usePersistedListFilters('missing:filters', DEFAULTS))

    expect(result.current[0]).toEqual(DEFAULTS)
  })

  it('falls back to defaults when the persisted value is corrupt JSON', () => {
    localStorage.setItem('corrupt:filters', '{not valid json')

    const { result } = renderHook(() => usePersistedListFilters('corrupt:filters', DEFAULTS))

    expect(result.current[0]).toEqual(DEFAULTS)
  })

  it('falls back to defaults, without crashing, when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage unavailable')
    })

    const { result } = renderHook(() => usePersistedListFilters('throwing:filters', DEFAULTS))

    expect(result.current[0]).toEqual(DEFAULTS)
  })

  it('does not crash, and keeps the in-memory update, when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded')
    })

    const { result } = renderHook(() => usePersistedListFilters('quota:filters', DEFAULTS))

    act(() => {
      result.current[1]({ sectionId: 'section-1' })
    })

    expect(result.current[0]).toEqual({ sectionId: 'section-1' })
  })

  it('never manages a search field itself — callers keep search as their own separate state', () => {
    const { result } = renderHook(() => usePersistedListFilters('search-check:filters', DEFAULTS))

    expect(result.current[0]).not.toHaveProperty('search')

    act(() => {
      result.current[1]({ sectionId: 'section-1' })
    })

    expect(result.current[0]).not.toHaveProperty('search')
    expect(JSON.parse(localStorage.getItem('search-check:filters') as string)).not.toHaveProperty('search')
  })
})
