import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { HubTabBar, hubPanelId, hubTabId } from './HubTabBar'

// The generic tablist (docs/specs/148, generalised from the league tab bar).
type Id = 'one' | 'two' | 'three'
const TABS = [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }, { id: 'three', label: 'Three' }] as const

function Harness({ onChange, counts }: { onChange?: (id: Id) => void; counts?: Partial<Record<Id, number>> }) {
  const [value, setValue] = useState<Id>('one')
  return <HubTabBar<Id> tabs={TABS} value={value} counts={counts} ariaLabel="Things" idPrefix="x" onChange={(id) => { setValue(id); onChange?.(id) }} />
}

describe('HubTabBar', () => {
  it('is a labelled tablist with ids that match the panels, and one selected tab in the tab order', () => {
    render(<Harness />)

    expect(screen.getByRole('tablist', { name: 'Things' })).toBeInTheDocument()
    const one = screen.getByRole('tab', { name: 'One' })
    expect(one).toHaveAttribute('aria-selected', 'true')
    expect(one).toHaveAttribute('id', hubTabId('x', 'one'))
    expect(one).toHaveAttribute('aria-controls', hubPanelId('x', 'one'))
    expect(one).toHaveAttribute('tabindex', '0')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute('tabindex', '-1')
  })

  it('moves with the arrow keys, wrapping round, moving focus and reporting the tab', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    screen.getByRole('tab', { name: 'One' }).focus()

    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('three')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveAttribute('aria-selected', 'true')
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('one')
    await user.click(screen.getByRole('tab', { name: 'Two' }))
    expect(onChange).toHaveBeenLastCalledWith('two')
  })

  it('shows a count badge only where a count is given, and keeps it out of the tab name', () => {
    render(<Harness counts={{ two: 5, three: 0 }} />)

    expect(screen.getByRole('tab', { name: 'One' })).toHaveTextContent(/^One$/)
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveTextContent('Two5')
    expect(screen.getByRole('tab', { name: 'Three' })).toHaveTextContent('Three0')
  })
})
