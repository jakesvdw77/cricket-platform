import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LeagueTeamCard } from './LeagueTeamCard'
import { makeLeagueTeam } from './testUtils'

function renderCard(overrides = {}) {
  const handlers = { onEdit: vi.fn(), onToggleActive: vi.fn(), onRemove: vi.fn() }
  render(<LeagueTeamCard leagueTeam={makeLeagueTeam(overrides)} {...handlers} />)
  return handlers
}

describe('LeagueTeamCard', () => {
  it('shows the name, abbreviation and usage count', () => {
    renderCard({ referencedByMatchCount: 3 })
    expect(screen.getByRole('heading', { name: 'Centurion Brits CC' })).toBeInTheDocument()
    expect(screen.getByText('CBC')).toBeInTheDocument()
    expect(screen.getByText('3 matches')).toBeInTheDocument()
    expect(screen.queryByText('Inactive')).not.toBeInTheDocument()
  })

  it('offers Edit, Deactivate and Remove for an active team and wires the callbacks', async () => {
    const user = userEvent.setup()
    const handlers = renderCard()
    await user.click(screen.getByRole('button', { name: 'Edit Centurion Brits CC' }))
    await user.click(screen.getByRole('button', { name: 'Deactivate Centurion Brits CC' }))
    await user.click(screen.getByRole('button', { name: 'Remove Centurion Brits CC' }))
    expect(handlers.onEdit).toHaveBeenCalledTimes(1)
    expect(handlers.onToggleActive).toHaveBeenCalledTimes(1)
    expect(handlers.onRemove).toHaveBeenCalledTimes(1)
  })

  it('shows an Inactive badge and Reactivate for an inactive team', () => {
    renderCard({ active: false })
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivate Centurion Brits CC' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Deactivate/ })).not.toBeInTheDocument()
  })
})
