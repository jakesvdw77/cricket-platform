import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ManagerShell } from './ManagerShell'
import { baseTheme } from '../../theme'

// Stubs window.matchMedia so MUI's useMediaQuery sees a viewport of the given width.
function stubViewport(width: number) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      const min = /min-width:\s*([\d.]+)px/.exec(query)
      const max = /max-width:\s*([\d.]+)px/.exec(query)
      const matches = (min ? width >= Number(min[1]) : true) && (max ? width <= Number(max[1]) : true)
      return { matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() }
    }),
  )
}

function renderShell(path = '/manage/players') {
  return render(
    <ThemeProvider theme={baseTheme}>
    <MemoryRouter initialEntries={[path]}>
      <ManagerShell
        brand="Riverside CC"
        user={{ name: 'Sam Manager', email: 'sam@riverside.cc' }}
        onLogout={vi.fn()}
        profileTo="/manage/profile"
        logoUrl={null}
      >
        <div>Page content</div>
      </ManagerShell>
    </MemoryRouter>
    </ThemeProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('ManagerShell', () => {
  it('375 px: bottom tab bar and no side menu; Menu opens the sheet', async () => {
    stubViewport(375)
    renderShell()

    expect(screen.getByText('Page content')).toBeInTheDocument()
    expect(screen.getByText(/Cricket Legend Platform/)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Manager' })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Manager tabs' })).toBeInTheDocument()

    expect(screen.queryByRole('link', { name: 'Leagues' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(await screen.findByRole('link', { name: 'Leagues' })).toBeInTheDocument()
  })

  it('1000 px: icons-only rail with a label per link, no bottom bar', () => {
    stubViewport(1000)
    renderShell()

    const nav = screen.getByRole('navigation', { name: 'Manager' })
    expect(nav).toHaveStyle({ width: '64px' })
    expect(screen.queryByText('People')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Players' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('navigation', { name: 'Manager tabs' })).not.toBeInTheDocument()
  })

  it('1280 px: full side menu with group headings, no bottom bar', () => {
    stubViewport(1280)
    renderShell()

    expect(screen.getByRole('navigation', { name: 'Manager' })).toHaveStyle({ width: '232px' })
    expect(screen.getByText('People')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Manager tabs' })).not.toBeInTheDocument()
  })

  it('has the Notifications bell in the header at every width, linking to the sending page', () => {
    for (const width of [375, 1280]) {
      stubViewport(width)
      const { unmount } = renderShell()
      expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/manage/notifications')
      unmount()
    }
  })

  it('uses the brand-tone header at every width', () => {
    stubViewport(1280)
    renderShell()

    expect(screen.getByRole('banner')).toHaveStyle({ backgroundColor: 'rgb(47, 110, 79)' })
  })
})
