import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HubPillStrip } from './HubPillStrip'
import { HUB_NAV } from './hubNav'
import type { HubNavItem } from './hubNav'

// docs/specs/121: the phone's sub menu as a pill row.
const account = HUB_NAV.find((item) => item.id === 'account') as HubNavItem
const club = HUB_NAV.find((item) => item.id === 'club') as HubNavItem

describe('HubPillStrip', () => {
  it('renders one pill per child in a navigation named for the section, and marks the selected one', () => {
    render(<HubPillStrip label="Club pages" items={club.children as HubNavItem[]} selectedId="club.fields" onSelect={vi.fn()} />)

    const nav = screen.getByRole('navigation', { name: 'Club pages' })
    const pills = nav.querySelectorAll('button')
    expect(Array.from(pills).map((pill) => pill.textContent)).toEqual(['Club info', 'Bookings', 'Field Directory', 'Other Services'])
    expect(screen.getByRole('button', { name: 'Field Directory' })).toHaveAttribute('aria-current', 'page')
    expect(Array.from(pills).filter((pill) => pill.hasAttribute('aria-current'))).toHaveLength(1)
  })

  it('marks Soon pills with a dashed border, and the selected pill is never dashed', () => {
    render(<HubPillStrip label="Club pages" items={club.children as HubNavItem[]} selectedId="club.fields" onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Bookings' })).toHaveStyle({ borderStyle: 'dashed' })
    expect(screen.getByRole('button', { name: 'Field Directory' })).toHaveStyle({ borderStyle: 'solid' })
  })

  it('reports the tapped pill, Soon or live', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<HubPillStrip label="Club pages" items={club.children as HubNavItem[]} selectedId="club.fields" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Bookings' }))
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'club.bookings' }))
    await user.click(screen.getByRole('button', { name: 'Club info' }))
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'club.info' }))
  })

  it('still reports action items so the page can act on them', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<HubPillStrip label="Account pages" items={account.children as HubNavItem[]} selectedId="account.invitations" onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'signOut' }))
    await user.click(screen.getByRole('button', { name: 'Link more players' }))
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'findPlayers' }))
  })
})
