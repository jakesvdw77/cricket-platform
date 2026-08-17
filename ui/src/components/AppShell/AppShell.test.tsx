import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './AppShell'

const navItems = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'Club Onboarding', to: '/admin/onboarding' },
]

function renderShell(initialPath = '/admin', onLogout = vi.fn()) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="*"
          element={
            <AppShell
              brand="Cricket Legend Platform"
              navItems={navItems}
              user={{ name: 'Ada Lovelace', email: 'ada@example.com' }}
              onLogout={onLogout}
              profileTo="/admin/profile"
            >
              <div>Page content</div>
            </AppShell>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
  return onLogout
}

describe('AppShell', () => {
  it('renders the brand, sidebar nav, and page content', () => {
    renderShell()

    expect(screen.getByText('Cricket Legend Platform')).toBeInTheDocument()
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Club Onboarding').length).toBeGreaterThan(0)
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('marks the current route selected in the sidebar', () => {
    renderShell('/admin/onboarding')

    const link = screen.getAllByText('Club Onboarding')[0].closest('a')
    expect(link).toHaveClass('Mui-selected')
  })

  it('opens the mobile drawer from the menu button', async () => {
    renderShell()

    expect(screen.getAllByText('Dashboard')).toHaveLength(1)

    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(1)
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

    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/admin/profile')
  })
})
