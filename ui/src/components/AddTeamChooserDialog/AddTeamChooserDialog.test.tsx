import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AddTeamChooserDialog } from './AddTeamChooserDialog'

function setup(extra: { copyDisabledReason?: string } = {}) {
  const handlers = { onClose: vi.fn(), onChooseOwn: vi.fn(), onChooseOpponent: vi.fn(), onChooseCopy: vi.fn() }
  render(<AddTeamChooserDialog open {...handlers} {...extra} />)
  return handlers
}

describe('AddTeamChooserDialog', () => {
  it('is titled "Add a team" with an Our team and an Opponent team tile', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Add a team' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Our team/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Opponent team/ })).toBeInTheDocument()
  })

  it('calls the matching handler for each tile', async () => {
    const user = userEvent.setup()
    const handlers = setup()
    await user.click(screen.getByRole('button', { name: /Our team/ }))
    expect(handlers.onChooseOwn).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /Opponent team/ }))
    expect(handlers.onChooseOpponent).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: /Copy teams/ }))
    expect(handlers.onChooseCopy).toHaveBeenCalledTimes(1)
  })

  it('offers three tiles, each with an explanation', () => {
    setup()
    expect(screen.getByRole('button', { name: /Copy teams.*another league or season/ })).toBeEnabled()
    expect(screen.getByText("One of your club's teams playing in this league this season.")).toBeInTheDocument()
    expect(screen.getByText('A team you play against. It is only used in this league and season.')).toBeInTheDocument()
  })

  it('disables Copy teams with the reason when there is no season', async () => {
    const handlers = setup({ copyDisabledReason: 'Pick a season first.' })
    const tile = screen.getByRole('button', { name: /Copy teams/ })
    expect(tile).toBeDisabled()
    expect(tile).toHaveTextContent('Pick a season first.')
    expect(handlers.onChooseCopy).not.toHaveBeenCalled()
  })

  it('can be chosen from the keyboard', async () => {
    const user = userEvent.setup()
    const handlers = setup()
    screen.getByRole('button', { name: /Opponent team/ }).focus()
    await user.keyboard('{Enter}')
    expect(handlers.onChooseOpponent).toHaveBeenCalledTimes(1)
  })

  it('closes on Cancel', async () => {
    const user = userEvent.setup()
    const handlers = setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
  })
})
