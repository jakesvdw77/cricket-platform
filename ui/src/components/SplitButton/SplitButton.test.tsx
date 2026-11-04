import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SplitButton } from './SplitButton'

function setup() {
  const main = vi.fn()
  const other = vi.fn()
  render(
    <SplitButton
      label="Capture New Result"
      onClick={main}
      items={[
        { id: 'import', label: 'Import Result', onClick: other },
      ]}
    />,
  )
  return { main, other }
}

describe('SplitButton', () => {
  it('runs the main action from the left half', async () => {
    const { main } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Capture New Result' }))
    expect(main).toHaveBeenCalledTimes(1)
  })

  it('lists the main action first in the caret menu, then the related ones, and closes on Escape', async () => {
    setup()
    const caret = screen.getByRole('button', { name: 'More options for Capture New Result' })
    await userEvent.click(caret)
    const items = await screen.findAllByRole('menuitem')
    expect(items.map((item) => item.textContent)).toEqual(['Capture New Result', 'Import Result'])
    expect(caret).toHaveAttribute('aria-expanded', 'true')
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
  })

  it('opens a menu of the related actions from the caret and runs the chosen one', async () => {
    const { other } = setup()
    const caret = screen.getByRole('button', { name: 'More options for Capture New Result' })
    expect(caret).toHaveAttribute('aria-haspopup', 'menu')
    await userEvent.click(caret)
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Import Result' }))
    expect(other).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
