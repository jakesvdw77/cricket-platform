import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LeagueTeamTable } from './LeagueTeamTable'
import type { LeagueTeam } from '../../../api/leagueTeamApi'
import { makeLeagueTeam } from '../leagueTeams/testUtils'

function setPhone(phone: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: phone && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia
})

function renderTable(teams: LeagueTeam[]) {
  const handlers = { onEdit: vi.fn(), onToggleActive: vi.fn(), onRemove: vi.fn() }
  render(<LeagueTeamTable teams={teams} {...handlers} />)
  return handlers
}

describe('LeagueTeamTable', () => {
  it('shows the column headers and the name, abbreviation, usage and status of a row', () => {
    renderTable([makeLeagueTeam({ referencedByMatchCount: 3 })])
    for (const name of ['Team', 'Abbreviation', 'Used in', 'Status']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    const row = screen.getByTestId('league-team-row')
    expect(within(row).getByTestId('league-team-name')).toHaveTextContent('Centurion Brits CC')
    expect(within(row).getByTestId('league-team-abbreviation')).toHaveTextContent('CBC')
    expect(within(row).getByTestId('league-team-used-in')).toHaveTextContent('3 matches')
    expect(within(row).getByText('Active')).toBeInTheDocument()
  })

  it('uses the singular for one match and a dash for none', () => {
    renderTable([makeLeagueTeam({ referencedByMatchCount: 1 }), makeLeagueTeam({ id: 'lt-2', name: 'Police', referencedByMatchCount: 0 })])
    const [one, none] = screen.getAllByTestId('league-team-used-in')
    expect(one).toHaveTextContent('1 match')
    expect(none).toHaveTextContent('-')
  })

  it('mutes an inactive row and labels its toggle Reactivate, with the actions still enabled', () => {
    renderTable([makeLeagueTeam({ active: false })])
    expect(screen.getByTestId('league-team-row')).toHaveAttribute('data-inactive', 'true')
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivate Centurion Brits CC' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Deactivate Centurion Brits CC' })).not.toBeInTheDocument()
  })

  it('wires Edit, Deactivate and Remove on desktop', async () => {
    const user = userEvent.setup()
    const team = makeLeagueTeam()
    const handlers = renderTable([team])
    await user.click(screen.getByRole('button', { name: 'Edit Centurion Brits CC' }))
    await user.click(screen.getByRole('button', { name: 'Deactivate Centurion Brits CC' }))
    await user.click(screen.getByRole('button', { name: 'Remove Centurion Brits CC' }))
    expect(handlers.onEdit).toHaveBeenCalledWith(team)
    expect(handlers.onToggleActive).toHaveBeenCalledWith(team)
    expect(handlers.onRemove).toHaveBeenCalledWith(team)
  })

  describe('on a phone', () => {
    it('puts the abbreviation and matches under the name and opens the three-dot menu', async () => {
      setPhone(true)
      const user = userEvent.setup()
      const team = makeLeagueTeam({ referencedByMatchCount: 3 })
      const handlers = renderTable([team])
      expect(screen.getByTestId('league-team-phone-line')).toHaveTextContent('CBC · 3 matches')

      await user.click(screen.getByRole('button', { name: 'Centurion Brits CC, more actions' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
      expect(handlers.onEdit).toHaveBeenCalledWith(team)

      await user.click(screen.getByRole('button', { name: 'Centurion Brits CC, more actions' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Deactivate' }))
      expect(handlers.onToggleActive).toHaveBeenCalledWith(team)

      await user.click(screen.getByRole('button', { name: 'Centurion Brits CC, more actions' }))
      await user.click(await screen.findByRole('menuitem', { name: 'Remove' }))
      expect(handlers.onRemove).toHaveBeenCalledWith(team)
    })
  })
})
