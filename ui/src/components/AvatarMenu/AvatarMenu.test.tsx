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
})
