import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AvatarMenu } from './AvatarMenu'

describe('AvatarMenu', () => {
  it('shows initials on the closed avatar button', () => {
    render(
      <MemoryRouter>
        <AvatarMenu name="Jaco Smith" onLogout={vi.fn()} />
      </MemoryRouter>,
    )

    expect(screen.getByText('JS')).toBeInTheDocument()
  })

  it('opens the menu with name/email and calls onLogout when Log out is clicked', async () => {
    const onLogout = vi.fn()
    render(
      <MemoryRouter>
        <AvatarMenu name="Jaco Smith" email="jaco@riverside.cc" onLogout={onLogout} />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getByText('Jaco Smith')).toBeInTheDocument()
    expect(screen.getByText('jaco@riverside.cc')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }))

    expect(onLogout).toHaveBeenCalledOnce()
  })

  it('links Profile to the configured route', async () => {
    render(
      <MemoryRouter>
        <AvatarMenu name="Jaco Smith" onLogout={vi.fn()} profileTo="/player/profile" />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))

    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/player/profile')
  })

  it('adds Player Hub only when a route is given (docs/specs/119)', async () => {
    const { unmount } = render(
      <MemoryRouter>
        <AvatarMenu name="Jaco Smith" onLogout={vi.fn()} />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.queryByRole('menuitem', { name: 'Player Hub' })).not.toBeInTheDocument()
    unmount()

    render(
      <MemoryRouter>
        <AvatarMenu name="Jaco Smith" onLogout={vi.fn()} myPlayersTo="/account" />
      </MemoryRouter>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
    expect(screen.getByRole('menuitem', { name: 'Player Hub' })).toHaveAttribute('href', '/account')
  })

  describe('Switch profile (docs/specs/119 slice 4)', () => {
    const items = (onChoose = vi.fn()) => [
      { key: 'MY_PLAYERS:', title: 'Player Hub', subtitle: 'Sam and 1 more', active: true, onChoose: vi.fn() },
      { key: 'MANAGER:c1', title: 'Club manager', subtitle: 'Riverside CC', active: false, onChoose },
    ]

    it('is hidden with no items or a single card', async () => {
      render(
        <MemoryRouter>
          <AvatarMenu name="Jaco Smith" onLogout={vi.fn()} profileItems={items().slice(0, 1)} />
        </MemoryRouter>,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
      expect(screen.queryByRole('menuitem', { name: 'Switch profile' })).not.toBeInTheDocument()
    })

    it('opens the switcher and choosing another card calls its handler', async () => {
      const onChoose = vi.fn()
      render(
        <MemoryRouter>
          <AvatarMenu name="Jaco Smith" onLogout={vi.fn()} profileItems={items(onChoose)} />
        </MemoryRouter>,
      )
      await userEvent.click(screen.getByRole('button', { name: 'Account menu' }))
      await userEvent.click(screen.getByRole('menuitem', { name: 'Switch profile' }))
      await userEvent.click(await screen.findByRole('menuitem', { name: /Club manager.*Riverside CC/ }))
      expect(onChoose).toHaveBeenCalledOnce()
    })
  })
})
