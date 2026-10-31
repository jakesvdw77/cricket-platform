import type { ReactNode } from 'react'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useAfterSave, useBackLink, useReturnTo } from './useReturnTo'

type Entry = string | { pathname: string; search?: string; state?: unknown }

function wrapperFor(entry: Entry) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  }
}

const ORIGIN = '%2Fmanage%2Ffixtures%2Fleagues%2Fl-1%2Fschedule%3FseasonId%3Ds-1'

describe('useReturnTo', () => {
  it('returns the validated origin from the address', () => {
    const { result } = renderHook(() => useReturnTo(), { wrapper: wrapperFor(`/manage/fixtures/matches/new?returnTo=${ORIGIN}&returnLabel=TVL%20schedule`) })
    expect(result.current).toEqual({ to: '/manage/fixtures/leagues/l-1/schedule?seasonId=s-1', label: 'TVL schedule' })
  })

  it('has an empty label when only returnTo is given', () => {
    const { result } = renderHook(() => useReturnTo(), { wrapper: wrapperFor(`/manage/x?returnTo=${ORIGIN}`) })
    expect(result.current?.label).toBe('')
  })

  it('ignores an invalid returnTo', () => {
    const { result } = renderHook(() => useReturnTo(), { wrapper: wrapperFor('/manage/x?returnTo=https%3A%2F%2Fevil.example&returnLabel=Evil') })
    expect(result.current).toBeNull()
  })

  it('is null when absent', () => {
    const { result } = renderHook(() => useReturnTo(), { wrapper: wrapperFor('/manage/x') })
    expect(result.current).toBeNull()
  })

  it('falls back to the legacy router state { backTo, backLabel }', () => {
    const { result } = renderHook(() => useReturnTo(), {
      wrapper: wrapperFor({ pathname: '/manage/x', state: { backTo: '/manage/fixtures/results', backLabel: 'Results' } }),
    })
    expect(result.current).toEqual({ to: '/manage/fixtures/results', label: 'Results' })
  })

  it('prefers the address over the legacy state and ignores an unsafe legacy state', () => {
    const both = renderHook(() => useReturnTo(), {
      wrapper: wrapperFor({ pathname: '/manage/x', search: `?returnTo=${ORIGIN}&returnLabel=New`, state: { backTo: '/manage/old', backLabel: 'Old' } }),
    })
    expect(both.result.current?.label).toBe('New')
    const unsafe = renderHook(() => useReturnTo(), { wrapper: wrapperFor({ pathname: '/manage/x', state: { backTo: '//evil', backLabel: 'x' } }) })
    expect(unsafe.result.current).toBeNull()
  })
})

describe('useBackLink', () => {
  it('returns the default unchanged without a returnTo', () => {
    const { result } = renderHook(() => useBackLink('/manage/fixtures/matches', 'Back to Matches'), { wrapper: wrapperFor('/manage/x') })
    expect(result.current).toEqual({ to: '/manage/fixtures/matches', label: 'Back to Matches' })
  })

  it('reads "Back to {label}" and the origin with a returnTo', () => {
    const { result } = renderHook(() => useBackLink('/manage/fixtures/matches', 'Back to Matches'), {
      wrapper: wrapperFor(`/manage/x?returnTo=${ORIGIN}&returnLabel=TVL%20schedule`),
    })
    expect(result.current).toEqual({ to: '/manage/fixtures/leagues/l-1/schedule?seasonId=s-1', label: 'Back to TVL schedule' })
  })

  it('reads "Back" when the origin has no label', () => {
    const { result } = renderHook(() => useBackLink(undefined, 'Back'), { wrapper: wrapperFor(`/manage/x?returnTo=${ORIGIN}`) })
    expect(result.current.label).toBe('Back')
  })
})

describe('useAfterSave', () => {

  function setup(entry: string) {
    return renderHook(
      () => ({ save: useAfterSave('/manage/fixtures/matches'), location: useLocation() }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="*" element={<>{children}</>} />
            </Routes>
          </MemoryRouter>
        ),
      },
    )
  }

  it('navigates to the page default without an origin', () => {
    const { result } = setup('/manage/fixtures/matches/new')
    act(() => result.current.save())
    expect(result.current.location.pathname).toBe('/manage/fixtures/matches')
  })

  it('navigates to the origin and carries router state such as the delete notice', () => {
    const { result } = setup(`/manage/fixtures/matches/new?returnTo=${ORIGIN}`)
    act(() => result.current.save({ state: { notice: 'Match deleted.' } }))
    expect(result.current.location.pathname).toBe('/manage/fixtures/leagues/l-1/schedule')
    expect(result.current.location.search).toBe('?seasonId=s-1')
    expect(result.current.location.state).toEqual({ notice: 'Match deleted.' })
  })

  it('adds showAll=1 for a league Schedule origin when asked', () => {
    const { result } = setup(`/manage/fixtures/matches/new?returnTo=${ORIGIN}`)
    act(() => result.current.save({ showAll: true }))
    expect(result.current.location.search).toBe('?seasonId=s-1&showAll=1')
  })

  it('ignores an unsafe origin', () => {
    const { result } = setup('/manage/fixtures/matches/new?returnTo=%2F%2Fevil.example')
    act(() => result.current.save())
    expect(result.current.location.pathname).toBe('/manage/fixtures/matches')
  })
})
