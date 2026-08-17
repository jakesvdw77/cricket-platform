import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BottomTabShell } from './BottomTabShell'

const navItems = [
  { label: 'Fixtures', to: '/player' },
  { label: 'Profile', to: '/player/profile' },
]

function renderShell(onLogout = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/player']}>
      <Routes>
        <Route
          path="*"
          element={
            <BottomTabShell
              brand="Cricket Legend Platform"
              navItems={navItems}
              user={{ name: 'Alex Player' }}
              onLogout={onLogout}
              profileTo="/player/profile"
            >
              <div>Tab content</div>
            </BottomTabShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
  return onLogout
}

describe('BottomTabShell', () => {
  it('renders the brand, tab bar, content, and footer', () => {
    renderShell()

    expect(screen.getByText('Cricket Legend Platform')).toBeInTheDocument()
    expect(screen.getAllByText('Fixtures').length).toBeGreaterThan(0)
    expect(screen.getByText('Tab content')).toBeInTheDocument()
    expect(screen.getByText(/© \d{4} Cricket Legend Platform/)).toBeInTheDocument()
  })

  it('logs out via the avatar menu', async () => {
    const onLogout = renderShell()

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))

    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('links the avatar menu Profile item to the given profileTo route', async () => {
    renderShell()

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/player/profile')
  })
})
