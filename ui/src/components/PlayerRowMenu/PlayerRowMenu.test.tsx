import { useState } from 'react'
import { MenuItem } from '@mui/material'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayerRowMenu } from './PlayerRowMenu'
import type { PlayerRowMenuProps } from './PlayerRowMenu'

function Harness(props: Partial<PlayerRowMenuProps> & { onReorder: PlayerRowMenuProps['onReorder'] }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return (
    <>
      <button onClick={(event) => setAnchor(event.currentTarget)}>open</button>
      <PlayerRowMenu
        anchor={anchor}
        onClose={() => setAnchor(null)}
        playerId="b"
        playerName="Bob Birch"
        ids={['a', 'b', 'c']}
        {...props}
      />
    </>
  )
}

async function open() {
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
}

describe('PlayerRowMenu', () => {
  it('offers the position field, Move up and Move down, and sends the full new order', async () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} />)
    await open()

    expect(screen.getByLabelText('Batting position for Bob Birch')).toHaveAttribute('placeholder', '2')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move up' }))
    expect(onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
  })

  it('moves the row to a typed position on Enter, once', async () => {
    const onReorder = vi.fn()
    render(<Harness onReorder={onReorder} positionLabel="Bowling position" />)
    await open()

    await userEvent.type(screen.getByLabelText('Bowling position for Bob Birch'), '3{Enter}')

    expect(onReorder).toHaveBeenCalledTimes(1)
    expect(onReorder).toHaveBeenCalledWith(['a', 'c', 'b'])
  })

  it('disables Move up for the first row and Move down for the last', async () => {
    render(<Harness onReorder={vi.fn()} playerId="a" />)
    await open()
    expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('menuitem', { name: 'Move down' })).not.toHaveAttribute('aria-disabled')
  })

  it('has no Move items for a row that is not in the numbered list, and can disable the field with a reason', async () => {
    render(
      <Harness
        onReorder={vi.fn()}
        playerId="w"
        positionDisabledReason="All 11 places are filled."
      />,
    )
    await open()

    expect(screen.queryByRole('menuitem', { name: 'Move up' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Batting position for Bob Birch')).toBeDisabled()
    expect(screen.getByText('All 11 places are filled.')).toBeInTheDocument()
  })

  it('renders the extra items it is given around the reorder items', async () => {
    render(
      <Harness
        onReorder={vi.fn()}
        before={[<MenuItem key="swap">Swap player...</MenuItem>]}
        after={[<MenuItem key="remove">Remove</MenuItem>]}
      />,
    )
    await open()

    const items = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(items[0]).toBe('Swap player...')
    expect(items.at(-1)).toBe('Remove')
  })
})
