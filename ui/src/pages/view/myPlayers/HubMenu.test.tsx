import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HubMenu } from './HubMenu'
import type { HubMenuProps } from './HubMenu'
import { HUB_NAV } from './hubNav'
import type { HubNavItem } from './hubNav'

// docs/specs/121: one level of the menu, a roving tab stop, and names that carry the state.
const counts = { openPolls: 0, invitations: 0, linkRequests: 0 }
const club = HUB_NAV.find((item) => item.id === 'club') as HubNavItem

function renderMenu(props: Partial<HubMenuProps> = {}) {
  const onSelect = vi.fn()
  render(<HubMenu items={HUB_NAV} counts={counts} onSelect={onSelect} levelKey="root" {...props} />)
  return onSelect
}

const rows = () => within(screen.getByRole('navigation', { name: 'Player sections' })).getAllByRole('button')

describe('HubMenu', () => {
  it('renders exactly one level: the seven main rows, or a parent\'s children, never both', () => {
    const first = render(<HubMenu items={HUB_NAV} counts={counts} onSelect={vi.fn()} levelKey="root" />)
    expect(rows()).toHaveLength(7)
    expect(screen.queryByRole('button', { name: /Field Directory/ })).not.toBeInTheDocument()
    first.unmount()

    renderMenu({ items: club.children, levelKey: 'club' })
    expect(rows().map((row) => row.getAttribute('data-hub-item'))).toEqual(['club.info', 'club.bookings', 'club.fields', 'club.services'])
    expect(screen.queryByRole('button', { name: /^Availability/ })).not.toBeInTheDocument()
  })

  it('has one tab stop, on the selected row or else the first', () => {
    renderMenu({ selectedId: 'profile' })
    expect(rows().filter((row) => row.tabIndex === 0).map((row) => row.getAttribute('data-hub-item'))).toEqual(['profile'])
  })

  it('first row is the tab stop without a selection', () => {
    renderMenu()
    expect(rows().filter((row) => row.tabIndex === 0).map((row) => row.getAttribute('data-hub-item'))).toEqual(['availability'])
  })

  it('moves focus with Down, Up, Home and End, stopping at the ends, and the tab stop follows focus', async () => {
    const user = userEvent.setup()
    renderMenu()
    const all = rows()

    await user.tab()
    expect(all[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(all[1]).toHaveFocus()
    expect(all.filter((row) => row.tabIndex === 0)).toEqual([all[1]])
    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(all[0]).toHaveFocus()
    await user.keyboard('{End}')
    expect(all[6]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(all[6]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(all[0]).toHaveFocus()
  })

  it('selects the row with Enter and with a click', async () => {
    const user = userEvent.setup()
    const onSelect = renderMenu()

    await user.tab()
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'updates' }))
    await user.click(screen.getByRole('button', { name: /^Profile/ }))
    expect(onSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'profile' }))
  })

  it('marks only a selected leaf with aria-current, never a parent', () => {
    const first = render(<HubMenu items={HUB_NAV} counts={counts} onSelect={vi.fn()} levelKey="root" selectedId="availability" />)
    expect(rows().filter((row) => row.getAttribute('aria-current') === 'page').map((row) => row.getAttribute('data-hub-item'))).toEqual(['availability'])
    first.unmount()

    renderMenu({ selectedId: 'club' })
    expect(rows().some((row) => row.hasAttribute('aria-current'))).toBe(false)
  })

  it('names a parent "..., opens sub menu"', () => {
    renderMenu()
    expect(screen.getByRole('button', { name: 'Club, opens sub menu' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Availability' })).toBeInTheDocument()
  })

  it('keeps Soon items focusable and names them "..., Soon, not available yet"', async () => {
    const user = userEvent.setup()
    const onSelect = renderMenu({ items: club.children, levelKey: 'club' })

    const bookings = screen.getByRole('button', { name: 'Bookings, Soon, not available yet' })
    expect(bookings).toBeEnabled()
    act(() => bookings.focus())
    expect(bookings).toHaveFocus()
    await user.click(bookings)
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'club.bookings' }))
    expect(screen.getByRole('button', { name: 'Field Directory' })).toBeInTheDocument()
  })

  it('shows a count as just the number, with the full wording in the accessible name', () => {
    renderMenu({ counts: { openPolls: 2, invitations: 1, linkRequests: 2 } })

    const availability = screen.getByRole('button', { name: 'Availability, 2 open' })
    expect(availability).toHaveTextContent('2Availability')
    expect(availability).not.toHaveTextContent('open')
    const account = screen.getByRole('button', { name: 'Account, 3 new, opens sub menu' })
    expect(account).toHaveTextContent('3Account')
  })

  it('shows a dashed Soon pill on a Soon row, and none on a live one', () => {
    renderMenu({ items: club.children, levelKey: 'club' })
    expect(screen.getByRole('button', { name: /^Bookings/ })).toHaveTextContent('SoonBookings')
    expect(screen.getByRole('button', { name: 'Field Directory' })).not.toHaveTextContent('Soon')
  })

  it('moves focus to focusId when given', () => {
    renderMenu({ items: club.children, levelKey: 'club', focusId: 'club.fields' })
    expect(screen.getByRole('button', { name: 'Field Directory' })).toHaveFocus()
  })
})
