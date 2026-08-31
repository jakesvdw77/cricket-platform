import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GridNavShell } from './GridNavShell'

function renderShell(onLogout = vi.fn(), logoUrl?: string | null) {
  render(
    <MemoryRouter>
      <GridNavShell
        brand="Riverside CC"
        user={{ name: 'Sam Manager', email: 'sam@riverside.cc' }}
        onLogout={onLogout}
        profileTo="/manage/profile"
        {...(logoUrl !== undefined && { logoUrl })}
      >
        <div>Grid content</div>
      </GridNavShell>
    </MemoryRouter>,
  )
  return onLogout
}

describe('GridNavShell', () => {
  it('renders the brand, children, and footer', () => {
    renderShell()

    expect(screen.getByText('Riverside CC')).toBeInTheDocument()
    expect(screen.getByText('Grid content')).toBeInTheDocument()
    expect(screen.getByText(/Cricket Legend Platform/)).toBeInTheDocument()
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

    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/manage/profile')
  })

  it('passes logoUrl through to the header, rendering the club logo avatar alongside the account avatar', () => {
    renderShell(vi.fn(), '/media/logo.png')

    // Two avatars once a logo is passed: the club logo (header, left) and the account menu
    // avatar (header, right, AvatarMenu's own) — query all rather than the first match so this
    // doesn't accidentally pass by finding AvatarMenu's avatar instead of the new one.
    const avatars = document.querySelectorAll('.MuiAvatar-root')
    expect(avatars).toHaveLength(2)
    expect(avatars[0].querySelector('img')).toHaveAttribute('src', '/media/logo.png')
  })

  it('omits the logo avatar entirely when logoUrl is not passed at all, leaving only the account menu avatar', () => {
    renderShell()

    expect(document.querySelectorAll('.MuiAvatar-root')).toHaveLength(1)
  })
})
