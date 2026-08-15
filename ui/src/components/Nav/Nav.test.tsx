import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Nav } from './Nav'

const items = [
  { label: 'Matches', to: '/matches' },
  { label: 'Teams', to: '/teams' },
]

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

describe('Nav', () => {
  it('marks the current route as selected', () => {
    render(
      <MemoryRouter initialEntries={['/teams']}>
        <Nav items={items} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('tab', { name: 'Teams' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Matches' })).toHaveAttribute('aria-selected', 'false')
  })

  it('navigates when an item is activated', async () => {
    render(
      <MemoryRouter initialEntries={['/matches']}>
        <Nav items={items} />
        <LocationDisplay />
        <Routes>
          <Route path="/matches" element={null} />
          <Route path="/teams" element={null} />
        </Routes>
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Teams' }))

    expect(screen.getByTestId('location')).toHaveTextContent('/teams')
  })
})
