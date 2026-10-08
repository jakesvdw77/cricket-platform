import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { StatusOverrideMenu } from './StatusOverrideMenu'

function renderMenu(props: Partial<React.ComponentProps<typeof StatusOverrideMenu>> = {}) {
  const onSelect = vi.fn()
  render(
    <StatusOverrideMenu playerName="Jane Smith" slotLabel="Sat 3 Oct · Morning" status="UNSURE" disabled={false} onSelect={onSelect} {...props}>
      {(trigger) => <button type="button" {...trigger}>open</button>}
    </StatusOverrideMenu>,
  )
  return onSelect
}

describe('StatusOverrideMenu', () => {
  it('offers the three answers with the current one selected, and names the trigger by default', async () => {
    const user = userEvent.setup()
    const onSelect = renderMenu()

    await user.click(screen.getByRole('button', { name: "Set Jane Smith's sat 3 oct · morning availability" }))
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['Available', 'Unsure', 'Unavailable'])
    expect(screen.getByRole('menuitem', { name: 'Unsure' })).toHaveClass('Mui-selected')
    await user.click(screen.getByRole('menuitem', { name: 'Available' }))
    expect(onSelect).toHaveBeenCalledWith('AVAILABLE')
  })

  it('shows an optional title and a last extra entry that runs its own action', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const extra = vi.fn()
    renderMenu({ onSelect, title: 'Jane Smith, Sat 3 Oct 09:00', extraItem: { label: 'Open poll', onSelect: extra }, triggerLabel: 'Jane, Available' })

    await user.click(screen.getByRole('button', { name: 'Jane, Available' }))
    expect(screen.getByText('Jane Smith, Sat 3 Oct 09:00')).toBeInTheDocument()
    const items = screen.getAllByRole('menuitem')
    expect(items[items.length - 1]).toHaveTextContent('Open poll')
    await user.click(screen.getByRole('menuitem', { name: 'Open poll' }))
    expect(extra).toHaveBeenCalledTimes(1)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('announces the popup and its state, and does not open while disabled', async () => {
    const user = userEvent.setup()
    renderMenu({ disabled: true })

    const trigger = screen.getByRole('button')
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('has no extra entry or title unless asked', async () => {
    const user = userEvent.setup()
    renderMenu()

    await user.click(screen.getByRole('button'))
    expect(screen.getAllByRole('menuitem')).toHaveLength(3)
  })
})
