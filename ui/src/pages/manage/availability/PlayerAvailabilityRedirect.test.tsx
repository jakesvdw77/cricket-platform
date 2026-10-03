import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import PlayerAvailabilityRedirect from './PlayerAvailabilityRedirect'

function LocationProbe() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  return (
    <div>
      <div data-testid="location">{`${pathname}${search}`}</div>
      <button type="button" onClick={() => navigate(-1)}>
        Back
      </button>
    </div>
  )
}

function renderAt(path: string, entries: string[] = [path]) {
  return render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route path="/start" element={<LocationProbe />} />
        <Route path="/manage/player-availability" element={<PlayerAvailabilityRedirect />} />
        <Route path="/manage/availability/players" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PlayerAvailabilityRedirect (docs/specs/073)', () => {
  it('redirects to the Players view, keeping the query string', () => {
    renderAt('/manage/player-availability?x=1')

    expect(screen.getByTestId('location')).toHaveTextContent('/manage/availability/players?x=1')
  })

  it('redirects without a query string too', () => {
    renderAt('/manage/player-availability')

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/manage\/availability\/players$/)
  })

  it('replaces the history entry: Back does not return to the old URL', async () => {
    renderAt('/manage/player-availability?x=1', ['/start', '/manage/player-availability?x=1'])
    expect(screen.getByTestId('location')).toHaveTextContent('/manage/availability/players?x=1')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Back' }))

    expect(screen.getByTestId('location')).toHaveTextContent(/^\/start$/)
  })
})
