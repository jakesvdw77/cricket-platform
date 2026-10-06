import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BottomTabBar } from './BottomTabBar'
import { MANAGER_NAV, managerTabs } from '../ManagerShell/managerNav'

function renderBar(path: string, props: Partial<ComponentProps<typeof BottomTabBar>> = {}) {
  const onMenuClick = vi.fn()
  render(
    <MemoryRouter initialEntries={[path]}>
      <BottomTabBar tabs={managerTabs()} groups={MANAGER_NAV} onMenuClick={onMenuClick} {...props} />
    </MemoryRouter>,
  )
  return onMenuClick
}

describe('BottomTabBar', () => {
  it('renders Home, Matches, Polls, Players and a Menu button', () => {
    renderBar('/manage')

    const nav = screen.getByRole('navigation', { name: 'Manager tabs' })
    expect(nav).toHaveTextContent(/^HomeMatchesPollsPlayersMenu$/)
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/manage')
    expect(screen.getByRole('link', { name: 'Polls' })).toHaveAttribute('href', '/manage/availability')
    expect(screen.getByRole('button', { name: 'Menu' })).toBeInTheDocument()
  })

  it('marks the tab for the current route, including nested routes', () => {
    renderBar('/manage/fixtures/matches/1/edit')

    expect(screen.getByRole('link', { name: 'Matches' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('lights no tab when the current route is not a tab (e.g. Gallery)', () => {
    renderBar('/manage/gallery')

    expect(screen.getAllByRole('link').some((link) => link.hasAttribute('aria-current'))).toBe(false)
  })

  it('calls onMenuClick from the Menu button, and shows it expanded and the tabs unlit while open', async () => {
    const onMenuClick = renderBar('/manage', { menuOpen: true })

    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
    await userEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(onMenuClick).toHaveBeenCalledOnce()
  })

  it('shows a badge for a positive count', () => {
    renderBar('/manage', { badges: { polls: 4 } })

    expect(screen.getByTestId('badge-polls')).toHaveTextContent('4')
  })
})
