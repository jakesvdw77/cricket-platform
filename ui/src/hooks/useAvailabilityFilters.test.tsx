import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Link, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAvailabilityFilters } from './useAvailabilityFilters'

const KEY = 'availability:filters:club-1'

function wrapperFor(path: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
  }
}

function Where() {
  const { pathname, search } = useLocation()
  return <div data-testid="where">{`${pathname}${search}`}</div>
}

beforeEach(() => {
  localStorage.clear()
})

describe('useAvailabilityFilters (docs/specs/083)', () => {
  it('starts empty and saves choices under the one per-club key', () => {
    const { result } = renderHook(() => useAvailabilityFilters('club-1'), { wrapper: wrapperFor('/') })
    expect(result.current.filters).toEqual({ leagueId: null, sectionId: null, teamId: null })

    act(() => result.current.setFilters({ leagueId: 'l1', sectionId: 's1' }))

    expect(result.current.filters).toMatchObject({ leagueId: 'l1', sectionId: 's1' })
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toMatchObject({ leagueId: 'l1', sectionId: 's1' })
  })

  it('restores the saved filters on a later visit', () => {
    localStorage.setItem(KEY, JSON.stringify({ leagueId: 'l1', sectionId: null, teamId: 't1' }))
    const { result } = renderHook(() => useAvailabilityFilters('club-1'), { wrapper: wrapperFor('/') })
    expect(result.current.filters).toMatchObject({ leagueId: 'l1', teamId: 't1' })
  })

  it('lets the address win over the saved value on load, and saves it', async () => {
    localStorage.setItem(KEY, JSON.stringify({ leagueId: 'l-saved', sectionId: 's-saved', teamId: null }))
    const { result } = renderHook(() => useAvailabilityFilters('club-1'), { wrapper: wrapperFor('/?league=l-url') })
    await waitFor(() => expect(result.current.filters.leagueId).toBe('l-url'))
    // A filter missing from the address keeps its saved value.
    expect(result.current.filters.sectionId).toBe('s-saved')
    expect(JSON.parse(localStorage.getItem(KEY) as string).leagueId).toBe('l-url')
  })

  it('clears the team when the section changes, but keeps it when only the league changes', () => {
    const { result } = renderHook(() => useAvailabilityFilters('club-1'), { wrapper: wrapperFor('/') })
    act(() => result.current.setFilters({ sectionId: 's1', teamId: 't1' }))
    act(() => result.current.setFilters({ leagueId: 'l1' }))
    expect(result.current.filters.teamId).toBe('t1')
    act(() => result.current.setFilters({ sectionId: 's2' }))
    expect(result.current.filters.teamId).toBeNull()
  })

  it('clearFilters clears League, Section and Team', () => {
    const { result } = renderHook(() => useAvailabilityFilters('club-1'), { wrapper: wrapperFor('/') })
    act(() => result.current.setFilters({ leagueId: 'l1', sectionId: 's1', teamId: 't1' }))
    act(() => result.current.clearFilters())
    expect(result.current.filters).toEqual({ leagueId: null, sectionId: null, teamId: null })
  })

  it('ignores a seasonId in an older saved value and in the address', async () => {
    localStorage.setItem(KEY, JSON.stringify({ leagueId: 'l1', sectionId: null, teamId: null, seasonId: 'y1' }))
    const { result } = renderHook(() => useAvailabilityFilters('club-1'), { wrapper: wrapperFor('/?season=y2') })
    expect(result.current.filters).toEqual({ leagueId: 'l1', sectionId: null, teamId: null })
    expect(Object.keys(result.current.filters)).not.toContain('seasonId')
  })

  it('seeds once from the three old per-view keys when the new key is absent, then ignores them', () => {
    localStorage.setItem('playerAvailability:filters:club-1', JSON.stringify({ seasonId: 'y1', leagueId: 'l1', sectionId: null, teamId: 't1' }))
    localStorage.setItem('availabilityCoverage:filters:club-1', JSON.stringify({ seasonId: 'y2', leagueId: 'l2', sectionId: 's-cov' }))
    localStorage.setItem('availabilityPolls:filters:club-1', JSON.stringify({ sectionId: 's-polls', type: 'ALL' }))
    const { result } = renderHook(() => useAvailabilityFilters('club-1'), { wrapper: wrapperFor('/') })

    expect(result.current.filters).toEqual({ leagueId: 'l1', sectionId: 's-cov', teamId: 't1' })
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toMatchObject(result.current.filters)

    // Changing the new key afterwards is never overridden by the old ones.
    act(() => result.current.clearFilters())
    const again = renderHook(() => useAvailabilityFilters('club-1'), { wrapper: wrapperFor('/') })
    expect(again.result.current.filters.leagueId).toBeNull()
  })

  it('does not seed when the new key already exists', () => {
    localStorage.setItem(KEY, JSON.stringify({ leagueId: null, sectionId: null, teamId: null }))
    localStorage.setItem('playerAvailability:filters:club-1', JSON.stringify({ leagueId: 'l1' }))
    const { result } = renderHook(() => useAvailabilityFilters('club-1'), { wrapper: wrapperFor('/') })
    expect(result.current.filters.leagueId).toBeNull()
  })

  it('does not save or seed without a club', () => {
    localStorage.setItem('playerAvailability:filters:undefined', JSON.stringify({ leagueId: 'l1' }))
    const { result } = renderHook(() => useAvailabilityFilters(undefined), { wrapper: wrapperFor('/') })
    expect(result.current.filters.leagueId).toBeNull()
  })

  describe('across tabs and the address', () => {
    function Hub() {
      const { filters, setFilters } = useAvailabilityFilters('club-1')
      return (
        <>
          <Link to="/players">Players</Link>
          <Link to="/polls">Polls</Link>
          <button type="button" onClick={() => setFilters({ sectionId: 's1' })}>
            pick section
          </button>
          <button type="button" onClick={() => setFilters({ sectionId: null })}>
            clear section
          </button>
          <BackButton />
          <div data-testid="section">{filters.sectionId ?? 'none'}</div>
          <Where />
          <Outlet />
        </>
      )
    }
    function BackButton() {
      const navigate = useNavigate()
      return (
        <button type="button" onClick={() => navigate(-1)}>
          back
        </button>
      )
    }
    function renderHub(path: string | string[]) {
      const entries = Array.isArray(path) ? path : [path]
      return render(
        <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
          <Routes>
            <Route element={<Hub />}>
              <Route path="/polls" element={<div>polls</div>} />
              <Route path="/players" element={<div>players</div>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      )
    }

    it('mirrors a choice in the address, keeps it when switching tabs, and removes it when cleared', async () => {
      const user = userEvent.setup()
      renderHub('/polls')

      await user.click(screen.getByRole('button', { name: 'pick section' }))
      await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/polls?section=s1'))

      await user.click(screen.getByRole('link', { name: 'Players' }))
      await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/players?section=s1'))
      expect(screen.getByTestId('section')).toHaveTextContent('s1')

      await user.click(screen.getByRole('button', { name: 'clear section' }))
      await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/players$/))
    })

    it('applies a section from the address on load and keeps other query parameters', async () => {
      renderHub('/polls?section=s9&showClosed=true')
      await waitFor(() => expect(screen.getByTestId('section')).toHaveTextContent('s9'))
      expect(screen.getByTestId('where')).toHaveTextContent('showClosed=true')
    })

    it('the back button restores exactly that entry: a filter missing from it becomes none', async () => {
      const user = userEvent.setup()
      renderHub(['/polls', '/polls?section=s1'])
      await waitFor(() => expect(screen.getByTestId('section')).toHaveTextContent('s1'))

      await user.click(screen.getByRole('button', { name: 'back' }))
      await waitFor(() => expect(screen.getByTestId('section')).toHaveTextContent('none'))
    })

    it('the back button restores a different value from the earlier entry', async () => {
      const user = userEvent.setup()
      renderHub(['/polls?section=s1', '/polls?section=s2'])
      await waitFor(() => expect(screen.getByTestId('section')).toHaveTextContent('s2'))

      await user.click(screen.getByRole('button', { name: 'back' }))
      await waitFor(() => expect(screen.getByTestId('section')).toHaveTextContent('s1'))
    })

    it('keeps the filters when a bare address is opened on another page of the hub', async () => {
      const user = userEvent.setup()
      renderHub('/polls?section=s1')
      await waitFor(() => expect(screen.getByTestId('section')).toHaveTextContent('s1'))

      await user.click(screen.getByRole('link', { name: 'Players' }))
      await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/players?section=s1'))
      expect(screen.getByTestId('section')).toHaveTextContent('s1')
    })

    it('writes the saved filters into a bare address on load (replace, so no extra history entry)', async () => {
      localStorage.setItem(KEY, JSON.stringify({ leagueId: 'l1', sectionId: 's1', teamId: null }))
      const user = userEvent.setup()
      renderHub(['/elsewhere', '/polls'])
      await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/polls?league=l1&section=s1'))

      // replace: going back leaves /polls, not an earlier /polls entry.
      await user.click(screen.getByRole('button', { name: 'back' }))
      expect(screen.queryByTestId('where')).not.toBeInTheDocument()
    })
  })
})
