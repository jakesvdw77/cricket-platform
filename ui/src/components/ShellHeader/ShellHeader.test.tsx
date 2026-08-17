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
})
