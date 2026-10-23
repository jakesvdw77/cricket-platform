import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotSelectedBanner } from './NotSelectedBanner'

describe('NotSelectedBanner', () => {
  it('says there is no selection and offers Populate, which is only a notice', async () => {
    const onPopulate = vi.fn()
    render(<NotSelectedBanner notice={{ kind: 'none' }} onPopulate={onPopulate} />)
    expect(screen.getByText(/no team is selected for this match/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Populate from the team' }))
    expect(onPopulate).toHaveBeenCalledOnce()
  })

  it('counts the short list with the right singular or plural', () => {
    const { rerender } = render(<NotSelectedBanner notice={{ kind: 'short', count: 7 }} />)
    expect(screen.getByText(/Only 7 players are on our team list/)).toBeInTheDocument()
    rerender(<NotSelectedBanner notice={{ kind: 'short', count: 1 }} />)
    expect(screen.getByText(/Only 1 player is on our team list/)).toBeInTheDocument()
  })

  it('goes back to Teams from the scorecard steps and can be dismissed for the visit', async () => {
    const onOpenTeams = vi.fn()
    render(<NotSelectedBanner notice={{ kind: 'short', count: 8 }} onOpenTeams={onOpenTeams} />)
    await userEvent.click(screen.getByRole('button', { name: 'Open Teams' }))
    expect(onOpenTeams).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByTestId('not-selected-banner')).not.toBeInTheDocument()
  })

  it('offers Select players, which calls back in the page and leaves no link to another page', async () => {
    const onSelectPlayers = vi.fn()
    render(<NotSelectedBanner notice={{ kind: 'none' }} onSelectPlayers={onSelectPlayers} />)
    expect(screen.queryByRole('button', { name: 'Select the team' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Select players' }))
    expect(onSelectPlayers).toHaveBeenCalledOnce()
  })

  it('disables its actions while the step is disabled', () => {
    render(<NotSelectedBanner notice={{ kind: 'none' }} onSelectPlayers={vi.fn()} onPopulate={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: 'Select players' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Populate from the team' })).toBeDisabled()
  })
})
