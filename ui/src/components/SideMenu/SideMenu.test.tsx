import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@mui/material/styles'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SideMenu } from './SideMenu'
import { MANAGER_NAV } from '../ManagerShell/managerNav'
import { baseTheme } from '../../theme'

function renderMenu(path: string, props: Partial<ComponentProps<typeof SideMenu>> = {}) {
  return render(
    <ThemeProvider theme={baseTheme}>
      <MemoryRouter initialEntries={[path]}>
        <SideMenu groups={MANAGER_NAV} {...props} />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('SideMenu', () => {
  it('renders every group heading and item link', () => {
    renderMenu('/manage')

    for (const heading of ['Schedule', 'People', 'Club']) {
      expect(screen.getByText(heading, { selector: '.MuiTypography-overline' })).toBeInTheDocument()
    }
    const nav = screen.getByRole('navigation', { name: 'Manager' })
    const labels = within(nav).getAllByRole('link').map((link) => link.textContent)
    expect(labels).toEqual([
      'Overview',
      'Seasons',
      'Leagues',
      'Matches',
      'Availability',
      'Team selection',
      'Results',
      'Leaderboards',
      'Teams',
      'Players',
      'Communication',
      'Club profile',
      'Fields',
      'Gallery',
      'Access',
    ])
    expect(screen.getByRole('link', { name: 'Availability' })).toHaveAttribute('href', '/manage/availability')
    expect(screen.getByRole('link', { name: 'Fields' })).toHaveAttribute('href', '/manage/fixtures/fields')
  })

  it('lists Fields under the Club heading, right after Club profile (docs/specs/099)', () => {
    renderMenu('/manage')
    const nav = screen.getByRole('navigation', { name: 'Manager' })
    const links = within(nav).getAllByRole('link').map((link) => link.textContent)
    expect(links.indexOf('Fields')).toBe(links.indexOf('Club profile') + 1)
    expect(links.indexOf('Fields')).toBeGreaterThan(links.indexOf('Communication'))
  })

  it('highlights Fields on its list, add and detail routes', () => {
    for (const path of ['/manage/fixtures/fields', '/manage/fixtures/fields/new', '/manage/fixtures/fields/f1', '/manage/fixtures/fields/f1/edit']) {
      const { unmount } = renderMenu(path)
      expect(screen.getByRole('link', { name: 'Fields' }), path).toHaveAttribute('aria-current', 'page')
      expect(screen.getByRole('link', { name: 'Matches' }), path).not.toHaveAttribute('aria-current')
      unmount()
    }
  })

  it('marks Overview active on /manage only', () => {
    renderMenu('/manage')

    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')).toHaveLength(1)
  })

  it('highlights Matches on a nested match route (the edit page)', () => {
    renderMenu('/manage/fixtures/matches/abc/edit')

    expect(screen.getByRole('link', { name: 'Matches' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current')
  })

  it('highlights Availability on every Availability page, and only it', () => {
    for (const path of [
      '/manage/availability',
      '/manage/availability/players',
      '/manage/availability/coverage',
      '/manage/availability/new',
      '/manage/availability/group/r1',
      '/manage/availability/squad/m/p',
      '/manage/section-availability',
      '/manage/player-availability',
    ]) {
      const { unmount } = renderMenu(path)
      expect(screen.getByRole('link', { name: 'Availability' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')).toHaveLength(1)
      unmount()
    }
  })

  it('has no Notifications item and highlights nothing on the Notifications page', () => {
    renderMenu('/manage/notifications')
    expect(screen.queryByRole('link', { name: 'Notifications' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')).toHaveLength(0)
  })

  it('highlights Teams (not Club profile) on a section-scoped team route, Club profile on structure', () => {
    const { unmount } = renderMenu('/manage/sections/s1/teams/t1')
    expect(screen.getByRole('link', { name: 'Teams' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Club profile' })).not.toHaveAttribute('aria-current')
    unmount()

    renderMenu('/manage/sections')
    expect(screen.getByRole('link', { name: 'Club profile' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not match a sibling route that merely shares a prefix string', () => {
    renderMenu('/manage/players-archive')

    expect(screen.getByRole('link', { name: 'Players' })).not.toHaveAttribute('aria-current')
  })

  it('shows a count badge only for a positive count', () => {
    renderMenu('/manage', { badges: { availability: 3, squads: 0 } })

    expect(screen.getByTestId('badge-availability')).toHaveTextContent('3')
    expect(screen.queryByTestId('badge-squads')).not.toBeInTheDocument()
  })

  it('collapsed: hides labels and group headings, keeps an aria-label per link and a tooltip on hover', async () => {
    renderMenu('/manage/players', { collapsed: true, badges: { availability: 2 } })

    expect(screen.queryByText('People')).not.toBeInTheDocument()
    expect(screen.queryByText('Teams')).not.toBeInTheDocument()
    const players = screen.getByRole('link', { name: 'Players' })
    expect(players).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Availability, 2' })).toBeInTheDocument()

    await userEvent.hover(players)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Players')
  })

  it('classic look: draws each icon on a mid green tile with a cream ring (docs/specs/120), the same 36 px footprint as before', () => {
    renderMenu('/manage', { look: 'classic' })

    const nav = screen.getByRole('navigation', { name: 'Manager' })
    const tile = within(nav).getAllByTestId('brand-icon-tile')[0]
    expect(tile).toHaveStyle({ width: '36px', height: '36px', backgroundColor: 'rgb(20, 99, 63)' })
  })

  it('classic look: is the dark menu ground, and the current row is gold on a gold tint', () => {
    renderMenu('/manage/players', { look: 'classic' })

    const nav = screen.getByRole('navigation', { name: 'Manager' })
    expect(nav).toHaveStyle({ backgroundColor: 'rgb(10, 46, 29)' })
    expect(screen.getByRole('link', { name: 'Players' })).toHaveStyle({ color: 'rgb(232, 184, 61)', fontWeight: '700' })
  })

  describe('quiet look (docs/specs/139, the default)', () => {
    it('puts the icons on a faint ghost tile, not the cream-ringed tile, and takes the tile away with ghost off', () => {
      const { unmount } = renderMenu('/manage')
      const nav = screen.getByRole('navigation', { name: 'Manager' })
      expect(within(nav).queryByTestId('brand-icon-tile')).not.toBeInTheDocument()
      expect(nav.querySelector('.side-menu-icon-tile')).toHaveStyle({ width: '36px', height: '36px' })
      unmount()

      renderMenu('/manage', { ghost: false })
      expect(screen.getByRole('navigation', { name: 'Manager' }).querySelector('.side-menu-icon-tile')).toHaveStyle({ backgroundColor: 'rgba(0, 0, 0, 0)' })
    })

    it('marks the current row with gold text, a lighter green row and aria-current, and quiets the others', () => {
      renderMenu('/manage/players')
      const current = screen.getByRole('link', { name: 'Players' })
      expect(current).toHaveAttribute('aria-current', 'page')
      expect(current).toHaveStyle({ color: 'rgb(232, 184, 61)', fontWeight: '700', minHeight: '44px' })
      expect(screen.getByRole('link', { name: 'Teams' })).not.toHaveAttribute('aria-current')
    })

    it('shows no collapse control unless the shell gives one, then toggles it and names the state', async () => {
      const { unmount } = renderMenu('/manage')
      expect(screen.queryByRole('button', { name: /menu$/i })).not.toBeInTheDocument()
      unmount()

      let calls = 0
      renderMenu('/manage', { onToggleCollapsed: () => { calls += 1 } })
      const button = screen.getByRole('button', { name: 'Collapse menu' })
      expect(button).toHaveAttribute('aria-expanded', 'true')
      await userEvent.click(button)
      expect(calls).toBe(1)
    })

    it('says Expand menu on the icon rail', () => {
      renderMenu('/manage', { collapsed: true, onToggleCollapsed: () => undefined })
      expect(screen.getByRole('button', { name: 'Expand menu' })).toHaveAttribute('aria-expanded', 'false')
    })
  })
})
