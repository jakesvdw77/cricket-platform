import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import SectionAvailabilityRedirect from './SectionAvailabilityRedirect'

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <div data-testid="location">{`${pathname}${search}`}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/manage/section-availability" element={<SectionAvailabilityRedirect />} />
        <Route path="/manage/availability/new" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SectionAvailabilityRedirect (docs/specs/064)', () => {
  it('redirects to the New poll screen with type=group and keeps sectionId and matchId', () => {
    renderAt('/manage/section-availability?sectionId=section-1&matchId=match-2')

    const url = new URL(screen.getByTestId('location').textContent as string, 'http://x')
    expect(url.pathname).toBe('/manage/availability/new')
    expect(url.searchParams.get('type')).toBe('group')
    expect(url.searchParams.get('sectionId')).toBe('section-1')
    expect(url.searchParams.get('matchId')).toBe('match-2')
  })

  it('still lands on the group branch when there is no query string', () => {
    renderAt('/manage/section-availability')

    expect(screen.getByTestId('location')).toHaveTextContent('/manage/availability/new?type=group')
  })
})
