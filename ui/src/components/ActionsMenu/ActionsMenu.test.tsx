import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActionsMenu } from './ActionsMenu'
import type { ActionsMenuItem } from './ActionsMenu'
import { clearViewport, setPhone } from '../../test/accountTestUtils'

function renderMenu(items: ActionsMenuItem[], disabled = false) {
  return render(
    <MemoryRouter initialEntries={['/start']}>
      <Routes>
        <Route path="/start" element={<ActionsMenu items={items} disabled={disabled} />} />
        <Route path="/there" element={<p>Arrived</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ActionsMenu', () => {
  afterEach(() => clearViewport())

  it('shows a labelled Actions button on desktop and lists the items when opened', async () => {
    renderMenu([{ id: 'a', label: 'First', onClick: vi.fn() }, { id: 'b', label: 'Second', onClick: vi.fn() }])
    const trigger = screen.getByRole('button', { name: 'Actions' })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['First', 'Second'])
  })

  it('runs an item and closes the menu', async () => {
    const onClick = vi.fn()
    renderMenu([{ id: 'a', label: 'First', onClick }])
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'First' }))
    await vi.waitFor(() => expect(screen.queryByRole('menuitem')).not.toBeInTheDocument())
    // The action runs once the menu has closed, with focus already back on the trigger.
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('navigates for an item with a link', async () => {
    renderMenu([{ id: 'a', label: 'Go', to: '/there' }])
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))
    expect(screen.getByRole('menuitem', { name: 'Go' })).toHaveAttribute('href', '/there')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Go' }))
    expect(await screen.findByText('Arrived')).toBeInTheDocument()
  })

  it('does not run a disabled item and keeps its reason available', async () => {
    const onClick = vi.fn()
    renderMenu([{ id: 'a', label: 'Blocked', onClick, disabled: true, reason: 'Not while a poll is open' }])
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }))
    const item = screen.getByRole('menuitem', { name: 'Blocked' })
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(item).toHaveAccessibleDescription('Not while a poll is open')
    fireEvent.click(item)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('disables the trigger', () => {
    renderMenu([{ id: 'a', label: 'First', onClick: vi.fn() }], true)
    expect(screen.getByRole('button', { name: 'Actions' })).toBeDisabled()
  })

  it('is a 44 px three-dots icon button on a phone, with 44 px items', async () => {
    setPhone(true)
    renderMenu([{ id: 'a', label: 'First', onClick: vi.fn() }])
    const trigger = screen.getByRole('button', { name: 'Actions' })
    expect(trigger).not.toHaveTextContent('Actions')
    expect(trigger.querySelector('[data-testid="MoreVertIcon"]')).not.toBeNull()
    await userEvent.click(trigger)
    expect(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'First' })).toBeInTheDocument()
  })

  it('opens from the keyboard and closes on Escape, returning focus to the trigger', async () => {
    renderMenu([{ id: 'a', label: 'First', onClick: vi.fn() }])
    const trigger = screen.getByRole('button', { name: 'Actions' })
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    await vi.waitFor(() => expect(trigger).toHaveFocus())
  })
})
