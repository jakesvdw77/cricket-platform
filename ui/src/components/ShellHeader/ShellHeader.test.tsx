import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ShellHeader } from './ShellHeader'

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

    expect(screen.getByText('RI')).toBeInTheDocument()
  })
})
