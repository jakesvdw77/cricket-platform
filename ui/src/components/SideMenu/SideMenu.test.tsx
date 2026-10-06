import type { ComponentProps } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SideMenu } from './SideMenu'
import { MANAGER_NAV } from '../ManagerShell/managerNav'

function renderMenu(path: string, props: Partial<ComponentProps<typeof SideMenu>> = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SideMenu groups={MANAGER_NAV} {...props} />
    </MemoryRouter>,
  )
}

describe('SideMenu', () => {
  it('renders every group heading and item link', () => {
    renderMenu('/manage')

    for (const heading of ['Matches', 'People', 'Availability', 'Club']) {
      expect(screen.getByText(heading, { selector: '.MuiTypography-overline' })).toBeInTheDocument()
    }
    const nav = screen.getByRole('navigation', { name: 'Manager' })
    const labels = within(nav).getAllByRole('link').map((link) => link.textContent)
    expect(labels).toEqual([
      'Overview',
      'Matches',
      'Leagues',
      'Results',
      'Teams',
      'Players',
      'Squads',
      'Polls',
      'Communication',
      'Club profile',
      'Gallery',
      'Notifications',
      'Managers',
    ])
    expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('href', '/manage/availability')
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

  it('highlights Polls on the availability, group poll and legacy redirect routes', () => {
    for (const path of ['/manage/availability/players', '/manage/availability/group/r1', '/manage/player-availability']) {
      const { unmount } = renderMenu(path)
      expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('aria-current', 'page')
      unmount()
    }
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
    renderMenu('/manage', { badges: { polls: 3, squads: 0 } })

    expect(screen.getByTestId('badge-polls')).toHaveTextContent('3')
    expect(screen.queryByTestId('badge-squads')).not.toBeInTheDocument()
  })

  it('collapsed: hides labels and group headings, keeps an aria-label per link and a tooltip on hover', async () => {
    renderMenu('/manage/players', { collapsed: true, badges: { polls: 2 } })

    expect(screen.queryByText('People')).not.toBeInTheDocument()
    expect(screen.queryByText('Teams')).not.toBeInTheDocument()
    const players = screen.getByRole('link', { name: 'Players' })
    expect(players).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Polls, 2' })).toBeInTheDocument()

    await userEvent.hover(players)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Players')
  })
})
