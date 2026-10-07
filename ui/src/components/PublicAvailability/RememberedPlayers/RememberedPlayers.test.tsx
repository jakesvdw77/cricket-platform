import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RememberedPlayers } from './RememberedPlayers'

const players = [
  { firstName: 'Liam', lastName: 'Carter', answeredAt: '2026-10-13T16:40:00Z' },
  { firstName: 'Emma', lastName: 'Carter', answeredAt: null },
]

function setup() {
  const handlers = { onSelect: vi.fn(), onRemove: vi.fn(), onForgetAll: vi.fn(), onSomeoneElse: vi.fn() }
  render(<RememberedPlayers players={players} {...handlers} />)
  return handlers
}

describe('RememberedPlayers', () => {
  it('lists names with last answered text', () => {
    setup()
    expect(screen.getByText('Liam Carter')).toBeInTheDocument()
    expect(screen.getByText(/^Answered /)).toBeInTheDocument()
    expect(screen.getByText('Emma Carter')).toBeInTheDocument()
    expect(screen.getByText('Not answered yet')).toBeInTheDocument()
  })

  it('selects a player by tapping the name', async () => {
    const { onSelect } = setup()
    await userEvent.click(screen.getByRole('button', { name: /^Emma Carter/ }))
    expect(onSelect).toHaveBeenCalledWith(players[1])
  })

  it('removes one player', async () => {
    const { onRemove } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Remove Liam Carter from this device' }))
    expect(onRemove).toHaveBeenCalledWith(players[0])
  })

  it('forgets the device and offers someone else', async () => {
    const { onForgetAll, onSomeoneElse } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Forget this device' }))
    await userEvent.click(screen.getByRole('button', { name: 'Someone else? Enter their details' }))
    expect(onForgetAll).toHaveBeenCalled()
    expect(onSomeoneElse).toHaveBeenCalled()
  })
})
