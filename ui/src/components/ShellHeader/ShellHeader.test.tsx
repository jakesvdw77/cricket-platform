import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { ShellHeader } from './ShellHeader'
import type { ShellHeaderProps } from './ShellHeader'
import { baseTheme, withClubBranding } from '../../theme'

describe('ShellHeader', () => {
  it('renders the brand and leading content', () => {
    render(
      <MemoryRouter>
        <ShellHeader
          brand="Riverside CC"
          user={{ name: 'Sam Manager' }}
          onLogout={vi.fn()}
          profileTo="/manage/profile"
          leading={<span>Menu</span>}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('Riverside CC')).toBeInTheDocument()
    expect(screen.getByText('Menu')).toBeInTheDocument()
  })

  it('passes the avatar name and profile route through to AvatarMenu', () => {
    render(
      <MemoryRouter>
        <ShellHeader brand="Cricket Legend Platform" user={{ name: 'Ada Lovelace' }} onLogout={vi.fn()} profileTo="/admin/profile" />
      </MemoryRouter>,
    )

    expect(screen.getByText('AL')).toBeInTheDocument()
  })

  it('renders no club-logo avatar at all when logoUrl is not passed (AppShell/BottomTabShell, unchanged)', () => {
    render(
      <MemoryRouter>
        <ShellHeader brand="Cricket Legend Platform" user={{ name: 'Ada Lovelace' }} onLogout={vi.fn()} profileTo="/admin/profile" />
      </MemoryRouter>,
    )

    // Just the one AvatarMenu avatar — no separate club-logo avatar rendered.
    expect(document.querySelectorAll('.MuiAvatar-root')).toHaveLength(1)
  })

  it('renders the club logo image when logoUrl is a real URL', () => {
    render(
      <MemoryRouter>
        <ShellHeader
          brand="Riverside CC"
          user={{ name: 'Sam Manager' }}
          onLogout={vi.fn()}
          profileTo="/manage/profile"
          logoUrl="/media/logo.png"
        />
      </MemoryRouter>,
    )

    const avatars = document.querySelectorAll('.MuiAvatar-root')
    expect(avatars).toHaveLength(2)
    expect(avatars[0].querySelector('img')).toHaveAttribute('src', '/media/logo.png')
  })

  it('falls back to the brand\'s initials when logoUrl is explicitly null (a real club with no logo uploaded)', () => {
    render(
      <MemoryRouter>
        <ShellHeader
          brand="Riverside CC"
          user={{ name: 'Sam Manager' }}
          onLogout={vi.fn()}
          profileTo="/manage/profile"
          logoUrl={null}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('RC')).toBeInTheDocument()
  })
})

describe('ShellHeader tone', () => {
  const props = { brand: 'Riverside CC', user: { name: 'Sam Manager' }, onLogout: vi.fn(), profileTo: '/manage/profile' }

  function renderWithTheme(theme: Theme, extra: Partial<ShellHeaderProps> = {}) {
    render(
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <ShellHeader {...props} {...extra} />
        </MemoryRouter>
      </ThemeProvider>,
    )
  }

  it('plain (default): white header with a divider, as the admin and player shells have it', () => {
    renderWithTheme(baseTheme)

    expect(screen.getByRole('banner')).not.toHaveStyle({ backgroundColor: 'rgb(47, 110, 79)' })
    expect(screen.getByRole('banner')).toHaveStyle({ borderBottomWidth: '1px' })
  })

  it('brand: solid club colour with the contrast text colour', () => {
    renderWithTheme(baseTheme, { tone: 'brand' })

    expect(screen.getByRole('banner')).toHaveStyle({ backgroundColor: 'rgb(47, 110, 79)', color: 'rgb(255, 255, 255)' })
  })

  it('brand: a light club colour gets dark text, not white', () => {
    const light = withClubBranding('#f5d442')
    renderWithTheme(light, { tone: 'brand' })

    const header = screen.getByRole('banner')
    expect(header).toHaveStyle({ backgroundColor: 'rgb(245, 212, 66)' })
    expect(light.palette.primary.contrastText).not.toBe('#ffffff')
    expect(header).toHaveStyle({ color: light.palette.primary.contrastText })
  })

  it('brand: the logo slot is a white tile, with the initials fallback when there is no logo', () => {
    renderWithTheme(baseTheme, { tone: 'brand', logoUrl: null })

    const initials = screen.getByText('RC')
    expect(initials.closest('.MuiAvatar-root')).toHaveStyle({ backgroundColor: 'rgb(255, 255, 255)' })
  })

  it('brand: the account avatar uses the on-brand look, not the solid primary disc', () => {
    renderWithTheme(baseTheme, { tone: 'brand' })

    const avatar = screen.getByText('SM').closest('.MuiAvatar-root') as HTMLElement
    expect(avatar).not.toHaveStyle({ backgroundColor: 'rgb(47, 110, 79)' })
    expect(avatar).toHaveStyle({ color: 'rgb(255, 255, 255)' })
  })

  it('renders no Notifications bell unless notificationsTo is passed (admin and player shells)', () => {
    renderWithTheme(baseTheme, { tone: 'brand' })

    expect(screen.queryByRole('link', { name: 'Notifications' })).not.toBeInTheDocument()
  })

  it('renders a Notifications bell link next to the account button when notificationsTo is passed', () => {
    renderWithTheme(baseTheme, { tone: 'brand', notificationsTo: '/manage/notifications' })

    const bell = screen.getByRole('link', { name: 'Notifications' })
    expect(bell).toHaveAttribute('href', '/manage/notifications')
    expect(bell).toHaveStyle({ color: 'rgb(255, 255, 255)' })
    expect(bell.nextElementSibling).toBe(screen.getByRole('button', { name: 'Account menu' }))
  })
})
