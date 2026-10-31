import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LeagueTabActions } from './LeagueTabActions'

describe('LeagueTabActions', () => {
  it('renders the buttons inline when there is no layout target', () => {
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={{}} />}>
            <Route index element={<LeagueTabActions><button type="button">Do it</button></LeagueTabActions>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getAllByRole('button', { name: 'Do it' })).toHaveLength(1)
  })

  it('portals the buttons into the target element when the layout provides one', () => {
    const target = document.createElement('div')
    target.setAttribute('data-testid', 'target')
    document.body.appendChild(target)
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Outlet context={{ tabActionsTarget: target }} />}>
            <Route index element={<LeagueTabActions><button type="button">Do it</button></LeagueTabActions>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByTestId('target')).toContainElement(screen.getByRole('button', { name: 'Do it' }))
    expect(screen.getAllByRole('button', { name: 'Do it' })).toHaveLength(1)
    target.remove()
  })
})
