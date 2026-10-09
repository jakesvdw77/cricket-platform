import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SelectionMatchesTable } from './SelectionMatchesTable'
import { makeMatch, makeSide, sampleMatches } from './teamSelectionTestUtils'
import type { TeamSelectionMatch } from '../../../api/teamSelectionApi'

function renderTable(matches: TeamSelectionMatch[], props: Partial<React.ComponentProps<typeof SelectionMatchesTable>> = {}) {
  return render(
    <MemoryRouter>
      <SelectionMatchesTable matches={matches} {...props} />
    </MemoryRouter>,
  )
}

describe('SelectionMatchesTable', () => {
  it('renders the header and one row per club side', () => {
    renderTable(sampleMatches())
    expect(screen.getByRole('table', { name: 'Team selection by match' })).toBeInTheDocument()
    for (const name of [/^When$/, /^Match$/, /^Team$/, /Selection/, /^Status$/]) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(screen.getAllByTestId('selection-row')).toHaveLength(4)
  })

  it('shows two rows for a derby, one per side', () => {
    const derby = makeMatch({
      matchId: 'derby',
      sides: [
        makeSide({ sideId: 's-a', teamId: 'team-1', teamName: 'Vets A', opponentName: 'Vets B' }),
        makeSide({ sideId: 's-b', teamId: 'team-2', teamName: 'Vets B', opponentName: 'Vets A', home: false }),
      ],
    })
    renderTable([derby])
    expect(screen.getAllByTestId('selection-row')).toHaveLength(2)
    const teams = screen.getAllByTestId('selection-row-team').map((cell) => cell.textContent)
    expect(teams).toEqual(['Vets AHome', 'Vets BAway'])
  })

  it('names the match home first and the away side second', () => {
    renderTable(sampleMatches())
    expect(screen.getByText('Riverside Vets A v Oakfield CC')).toBeInTheDocument()
    expect(screen.getByText('Lakeside CC v Riverside Vets A')).toBeInTheDocument()
  })

  it('shows the picked count against the limit, the status chip and the league under the match', () => {
    renderTable(sampleMatches())
    const rows = screen.getAllByTestId('selection-row')
    expect(within(rows[1]).getByTestId('selection-m-2-team-2-picked')).toHaveTextContent('7 Picked')
    expect(within(rows[1]).getByText('In progress')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Ready to announce')).toBeInTheDocument()
    expect(screen.getAllByText('Over 40 League').length).toBeGreaterThan(0)
  })

  it('marks the desktop-only cells so a phone keeps Match, Picked and the chevron', () => {
    renderTable(sampleMatches().slice(0, 1))
    const row = screen.getByTestId('selection-row')
    expect(row.querySelectorAll('[data-desktop-only="true"]').length).toBeGreaterThanOrEqual(5)
    expect(screen.getByTestId('selection-row-phone-when')).toBeInTheDocument()
    expect(within(row).getByText('0/12')).toBeInTheDocument()
  })

  it('links the whole row and Select players to the select page helper', () => {
    renderTable(sampleMatches().slice(0, 1))
    const expected = '/manage/team-selection/matches/m-1/sides/side-1'
    expect(screen.getByRole('link', { name: 'Riverside Vets A v Oakfield CC' })).toHaveAttribute('href', expected)
    expect(screen.getByRole('link', { name: 'Select players' })).toHaveAttribute('href', expected)
  })

  it('offers Announce on a side that is ready, and Select players on the others', async () => {
    const onAnnounce = vi.fn()
    const matches = sampleMatches()
    renderTable(matches, { onAnnounce })
    const rows = screen.getAllByTestId('selection-row')
    expect(within(rows[0]).queryByRole('button', { name: 'Announce' })).not.toBeInTheDocument()
    await userEvent.click(within(rows[2]).getByRole('button', { name: 'Announce' }))
    expect(onAnnounce).toHaveBeenCalledWith(matches[2], matches[2].sides[0])
    expect(within(rows[3]).getByRole('link', { name: 'Select players' })).toBeInTheDocument()
  })

  it('does not let the action buttons wrap', () => {
    renderTable(sampleMatches().slice(0, 1))
    expect(screen.getByRole('link', { name: 'Select players' })).toHaveStyle({ whiteSpace: 'nowrap' })
  })

  it('disables the Announce button of the side being announced', () => {
    renderTable(sampleMatches(), { onAnnounce: vi.fn(), announcingSideId: 'side-3' })
    expect(screen.getByRole('button', { name: 'Announcing…' })).toBeDisabled()
  })
})
