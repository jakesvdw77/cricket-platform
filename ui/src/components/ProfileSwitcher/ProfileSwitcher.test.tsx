import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileSwitcher } from './ProfileSwitcher'
import type { ProfileSwitchItem } from './ProfileSwitcher'
import { clearViewport, setPhone } from '../../test/accountTestUtils'

// docs/specs/119 slice 4: Switch profile is a menu on desktop and a bottom sheet on a phone, hiding nothing about the loaded card.
const items = (onPlayers = vi.fn(), onManager = vi.fn()): ProfileSwitchItem[] => [
  { key: 'MY_PLAYERS:', title: 'Player Hub', subtitle: 'Sam and 1 more', active: true, onChoose: onPlayers },
  { key: 'MANAGER:c1', title: 'Club manager', subtitle: null, active: false, onChoose: onManager },
]

const anchor = () => document.body.appendChild(document.createElement('button'))

afterEach(clearViewport)

describe('ProfileSwitcher', () => {
  it('is a menu on desktop with the loaded card marked, and choosing another card closes it and switches', async () => {
    setPhone(false)
    const onClose = vi.fn()
    const onManager = vi.fn()
    render(<ProfileSwitcher items={items(vi.fn(), onManager)} anchorEl={anchor()} onClose={onClose} />)

    const loaded = screen.getByRole('menuitem', { name: /Player Hub/ })
    expect(loaded).toHaveAttribute('aria-current', 'true')
    expect(screen.getByLabelText('Loaded')).toBeInTheDocument()
    expect(screen.getByText('Sam and 1 more')).toBeInTheDocument()
    expect(document.querySelector('.MuiDrawer-paperAnchorBottom')).toBeNull()

    await userEvent.click(screen.getByRole('menuitem', { name: /Club manager/ }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onManager).toHaveBeenCalledOnce()
  })

  it('choosing the card that is already loaded only closes the menu', async () => {
    setPhone(false)
    const onClose = vi.fn()
    const onPlayers = vi.fn()
    render(<ProfileSwitcher items={items(onPlayers)} anchorEl={anchor()} onClose={onClose} />)

    await userEvent.click(screen.getByRole('menuitem', { name: /Player Hub/ }))

    expect(onClose).toHaveBeenCalledOnce()
    expect(onPlayers).not.toHaveBeenCalled()
  })

  it('is a bottom sheet titled Switch profile on a phone', async () => {
    setPhone(true)
    const onManager = vi.fn()
    render(<ProfileSwitcher items={items(vi.fn(), onManager)} anchorEl={anchor()} onClose={vi.fn()} />)

    expect(await screen.findByLabelText('Switch profile', { selector: '.MuiDrawer-paperAnchorBottom' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('menuitem', { name: /Club manager/ }))
    expect(onManager).toHaveBeenCalledOnce()
  })

  it('renders nothing while closed', () => {
    setPhone(false)
    render(<ProfileSwitcher items={items()} anchorEl={null} onClose={vi.fn()} />)

    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })
})
