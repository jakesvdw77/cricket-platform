import { renderHook, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useUrlFlag } from './useUrlFlag'

function wrapper(initial: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
}

describe('useUrlFlag', () => {
  it('reads the flag from the address and defaults to off', () => {
    expect(renderHook(() => useUrlFlag('past'), { wrapper: wrapper('/x?past=1') }).result.current[0]).toBe(true)
    expect(renderHook(() => useUrlFlag('past'), { wrapper: wrapper('/x') }).result.current[0]).toBe(false)
  })

  it('writes and clears the flag while keeping the other parameters', () => {
    const { result } = renderHook(() => ({ flag: useUrlFlag('past'), location: useLocation() }), { wrapper: wrapper('/x?league=l1') })
    act(() => result.current.flag[1](true))
    expect(result.current.location.search).toBe('?league=l1&past=1')
    expect(result.current.flag[0]).toBe(true)
    act(() => result.current.flag[1](false))
    expect(result.current.location.search).toBe('?league=l1')
  })
})
