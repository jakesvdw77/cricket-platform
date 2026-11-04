import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { SelectionMatchesTable } from './SelectionMatchesTable'
import { makeMatch, makeSide, sampleMatches } from './teamSelectionTestUtils'
import type { TeamSelectionMatch } from '../../../api/teamSelectionApi'

function renderTable(matches: TeamSelectionMatch[], props: Partial<React.ComponentProps<typeof SelectionMatchesTable>> = {}) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SelectionMatchesTable matches={matches} {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
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
    expect(within(rows[1]).getByTestId('selection-m-2-team-2-label')).toHaveTextContent('7 of 12')
    expect(within(rows[1]).getByText('In Progress')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Ready To Announce')).toBeInTheDocument()
    expect(screen.getAllByText('Over 40 League').length).toBeGreaterThan(0)
  })

  it('marks the desktop-only cells so a phone keeps Match, Picked and the chevron', () => {
    renderTable(sampleMatches().slice(0, 1))
    const row = screen.getByTestId('selection-row')
    expect(row.querySelectorAll('[data-desktop-only="true"]').length).toBeGreaterThanOrEqual(5)
    expect(screen.getByTestId('selection-row-phone-when')).toBeInTheDocument()
    expect(within(row).getByText('0/12')).toBeInTheDocument()
  })

  it('links the whole row and the kebab\'s Select Players to the select page helper', async () => {
    const user = userEvent.setup()
    renderTable(sampleMatches().slice(0, 1))
    const expected = '/manage/team-selection/matches/m-1/sides/side-1'
    expect(screen.getByRole('link', { name: 'Riverside Vets A v Oakfield CC' })).toHaveAttribute('href', expected)
    await user.click(screen.getByRole('button', { name: /^Actions for/ }))
    expect(await screen.findByRole('menuitem', { name: /^Select Players/ })).toHaveAttribute('href', expected)
  })

  it('has ONE kebab per row and no chevron column', () => {
    renderTable(sampleMatches())
    const rows = screen.getAllByTestId('selection-row')
    for (const row of rows) {
      expect(within(row).getAllByRole('button', { name: /^Actions for/ })).toHaveLength(1)
    }
    expect(screen.queryByRole('columnheader', { name: 'Open' })).not.toBeInTheDocument()
  })

  it('offers a quick Announce Team button on a side that is ready only, and lists Announce Team in every kebab', async () => {
    const user = userEvent.setup()
    const onAnnounce = vi.fn()
    const matches = sampleMatches()
    renderTable(matches, { onAnnounce })
    const rows = screen.getAllByTestId('selection-row')
    expect(within(rows[0]).queryByRole('button', { name: 'Announce Team' })).not.toBeInTheDocument()
    await user.click(within(rows[2]).getByRole('button', { name: 'Announce Team' }))
    expect(onAnnounce).toHaveBeenCalledWith(matches[2], matches[2].sides[0])

    await user.click(within(rows[0]).getByRole('button', { name: /^Actions for/ }))
    const item = await screen.findByRole('menuitem', { name: /^Announce Team/ })
    expect(item).toHaveAttribute('aria-disabled', 'true')
  })

  it('lists Share Team last in the kebab, enabled for an announced side only', async () => {
    const user = userEvent.setup()
    const onShare = vi.fn()
    const matches = sampleMatches()
    renderTable(matches, { onAnnounce: vi.fn(), onShare })
    const rows = screen.getAllByTestId('selection-row')

    await user.click(within(rows[0]).getByRole('button', { name: /^Actions for/ }))
    const first = await screen.findAllByRole('menuitem')
    expect(first[first.length - 1]).toHaveTextContent(/^Share Team/)
    expect(first[first.length - 1]).toHaveAttribute('aria-disabled', 'true')
    await user.keyboard('{Escape}')

    await user.click(within(rows[3]).getByRole('button', { name: /^Actions for/ }))
    await user.click(await screen.findByRole('menuitem', { name: /^Share Team/ }))
    expect(onShare).toHaveBeenCalledWith(matches[3], matches[3].sides[0])
  })

  it('renders one flat card with the toolbar fused above the header when a toolbar is given, and the empty message in its place with no rows', () => {
    const client = new QueryClient()
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SelectionMatchesTable matches={sampleMatches()} toolbar={<div>Bar</div>} empty={<div>Nothing here</div>} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('selection-fused-card')).toContainElement(screen.getByText('Bar'))
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument()
    rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <SelectionMatchesTable matches={[]} toolbar={<div>Bar</div>} empty={<div>Nothing here</div>} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(screen.getByText('Bar')).toBeInTheDocument()
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('disables the Announce button of the side being announced', () => {
    renderTable(sampleMatches(), { onAnnounce: vi.fn(), announcingSideId: 'side-3' })
    expect(screen.getByRole('button', { name: 'Announcing…' })).toBeDisabled()
  })
})
