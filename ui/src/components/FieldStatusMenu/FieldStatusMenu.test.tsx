import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FieldStatusMenu } from './FieldStatusMenu'
import type { FieldStatus } from '../../utils/fieldStatus'

function renderMenu(status: FieldStatus, onAction = vi.fn(), onClose = vi.fn()) {
  const anchor = document.createElement('button')
  document.body.appendChild(anchor)
  render(<FieldStatusMenu status={status} anchorEl={anchor} onClose={onClose} onAction={onAction} />)
  return { onAction, onClose }
}

// docs/specs/099-fields-directory.md
describe('FieldStatusMenu', () => {
  it.each([
    ['unverified', 'Unverified', ['Verify', 'Reject…']],
    ['verified', 'Verified', []],
    ['rejected', 'Rejected', ['Reopen']],
  ] as const)('headed by the current status, a %s field offers only %j', (status, heading, labels) => {
    renderMenu(status)

    expect(screen.getByText(/^Status:/)).toHaveTextContent(`Status: ${heading}`)
    expect(screen.queryAllByRole('menuitem').map((item) => item.textContent)).toEqual(labels)
  })

  it('never offers Verify on a rejected field (it is reopened first)', () => {
    renderMenu('rejected')
    expect(screen.queryByRole('menuitem', { name: 'Verify' })).not.toBeInTheDocument()
  })

  it('closes and reports the chosen action', async () => {
    const { onAction, onClose } = renderMenu('unverified')

    await userEvent.click(screen.getByRole('menuitem', { name: /Reject/ }))

    expect(onClose).toHaveBeenCalled()
    expect(onAction).toHaveBeenCalledWith('reject')
  })

  it('renders nothing while there is no anchor', () => {
    render(<FieldStatusMenu status="unverified" anchorEl={null} onClose={vi.fn()} onAction={vi.fn()} />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
