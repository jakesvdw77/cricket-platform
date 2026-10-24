import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import AccessPage from './AccessPage'
import { renderRoutes } from '../../../test/accountTestUtils'

// docs/specs/119 Part 3: Access has two tabs and the tab lives in the URL.
const routes = (
  <Route path="/manage/permissions" element={<AccessPage />}>
    <Route index element={<div>Managers placeholder</div>} />
    <Route path="player-accounts" element={<div>Player accounts content</div>} />
  </Route>
)

describe('AccessPage', () => {
  it('shows the Access title and two tabs, Managers selected on the base URL with its placeholder', () => {
    renderRoutes('/manage/permissions', routes)

    expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument()
    const tabs = screen.getAllByRole('link').map((link) => link.textContent)
    expect(tabs).toEqual(['Managers', 'Player accounts'])
    expect(screen.getByRole('link', { name: 'Managers' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Player accounts' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Managers placeholder')).toBeInTheDocument()
  })

  it('a refresh on the Player accounts URL keeps that tab selected', () => {
    renderRoutes('/manage/permissions/player-accounts', routes)

    expect(screen.getByRole('link', { name: 'Player accounts' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Managers' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Player accounts content')).toBeInTheDocument()
  })

  it('switches tabs by following the links, which are real URLs', async () => {
    renderRoutes('/manage/permissions', routes)

    expect(screen.getByRole('link', { name: 'Player accounts' })).toHaveAttribute('href', '/manage/permissions/player-accounts')
    expect(screen.getByRole('link', { name: 'Managers' })).toHaveAttribute('href', '/manage/permissions')
    await userEvent.click(screen.getByRole('link', { name: 'Player accounts' }))

    expect(await screen.findByText('Player accounts content')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Player accounts' })).toHaveAttribute('aria-current', 'page')
  })
})
