import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlayerStatusMenu } from './PlayerStatusMenu'
import type { PlayerStatus } from '../../utils/playerStatus'

function renderMenu(status: PlayerStatus, onAction = vi.fn(), onClose = vi.fn()) {
  const anchor = document.createElement('button')
  document.body.appendChild(anchor)
  render(<PlayerStatusMenu status={status} anchorEl={anchor} onClose={onClose} onAction={onAction} />)
  return { onAction, onClose }
}

describe('PlayerStatusMenu (docs/specs/088)', () => {
  it.each([
    ['unverified', ['Verify', 'Reject']],
    ['verified', ['Suspend']],
    ['rejected', ['Verify']],
    ['suspended', ['Reactivate']],
  ] as const)('headed by the current status, a %s player offers only %j', (status, labels) => {
    renderMenu(status)

    expect(screen.getByText(/^Status:/)).toHaveTextContent(`Status: ${status[0].toUpperCase()}${status.slice(1)}`)
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(labels)
  })

  it('closes and reports the chosen action', async () => {
    const { onAction, onClose } = renderMenu('unverified')

    await userEvent.click(screen.getByRole('menuitem', { name: 'Reject' }))

    expect(onClose).toHaveBeenCalled()
    expect(onAction).toHaveBeenCalledWith('reject')
  })

  it('renders nothing while there is no anchor', () => {
    render(<PlayerStatusMenu status="verified" anchorEl={null} onClose={vi.fn()} onAction={vi.fn()} />)

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
