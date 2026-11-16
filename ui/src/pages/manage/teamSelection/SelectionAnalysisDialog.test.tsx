import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import type { TeamSelectionOverview } from '../../../api/teamSelectionApi'
import { SelectionAnalysisDialog } from './SelectionAnalysisDialog'
import type { TeamSelectionHubContext } from './hubContext'

vi.mock('../../../api/teamSelectionApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../api/teamSelectionApi')>()),
  useTeamSelection: () => ({ data: undefined, isPending: true, fetchStatus: 'idle', isError: false }),
}))

const overview = {
  matches: [
    { matchId: 'm1', leagueId: null, sides: [{ sideId: 's1', teamId: 't1', teamName: 'Vets', announced: true, picks: [
      { playerId: 'p1', firstName: 'Ann', lastName: 'One', twelfthMan: false },
      { playerId: 'p2', firstName: 'Bob', lastName: 'Two', twelfthMan: true },
    ] }] },
  ],
  players: [
    { playerId: 'p1', firstName: 'Ann', lastName: 'One', pickedCount: 1, cells: [{ matchId: 'm1', teamId: 't1', availability: 'AVAILABLE', picked: true }] },
    { playerId: 'p2', firstName: 'Bob', lastName: 'Two', pickedCount: 1, cells: [] },
    { playerId: 'p3', firstName: 'Cat', lastName: 'Three', pickedCount: 0, cells: [{ matchId: 'm1', teamId: 't1', availability: 'AVAILABLE', picked: false }] },
  ],
  counts: {},
  truncated: false,
} as unknown as TeamSelectionOverview

const hub = {
  clubId: 'club-1',
  overview: { data: overview, isPending: false, isError: false, fetchStatus: 'idle' },
  filters: { seasonId: 's', leagueId: null, sectionId: null, teamId: null },
  seasonId: 's',
  scopeText: () => 'Vets · 2026/2027',
} as unknown as TeamSelectionHubContext

const renderDialog = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SelectionAnalysisDialog hub={hub} open onClose={() => undefined} />
    </QueryClientProvider>,
  )

describe('SelectionAnalysisDialog', () => {
  it('draws a bar per player, most picked first, with the figures and a dashed block for a player not picked', () => {
    renderDialog()
    const rows = screen.getAllByTestId('analysis-row')
    expect(rows.map((row) => within(row).getByRole('img').getAttribute('aria-label'))).toEqual([
      'Ann One: 1 of 1 games',
      'Bob Two: 1 of 1 games, 1 as 12th man',
      'Cat Three: 0 of 1 games',
    ])
    expect(screen.getByText('Vets · 2026/2027 · 1 game')).toBeInTheDocument()
    expect(screen.getAllByTestId('not-picked-block')).toHaveLength(1)
    expect(screen.getByText('Not Picked Yet')).toBeInTheDocument()
    expect(screen.getByText('Not picked')).toBeInTheDocument()
  })

  it('counts announced teams only when asked', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Announced Only' }))
    expect(screen.getByText('Vets · 2026/2027 · 1 game')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'All Selections' }))
    expect(screen.getAllByTestId('analysis-row')).toHaveLength(3)
  })
})
