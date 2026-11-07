import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ResultCard } from './ResultCard'
import { ResultTable } from './ResultTable'
import { makeListItem } from './resultTestUtils'

// docs/specs/145 acceptance 3a: the manager sees which results are in the Player Hub on the Results list, in the card view and in the table.
const shown = makeListItem({ id: 'match-1' }, { visibleToPlayers: true })
const hidden = makeListItem({ id: 'match-2' }, { id: 'result-2', matchId: 'match-2', visibleToPlayers: false })
const draft = makeListItem({ id: 'match-3' }, { id: 'result-3', matchId: 'match-3', status: 'DRAFT', publishedAt: null, visibleToPlayers: false })

const wrap = (ui: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>
)
const card = (item: typeof shown) => (
  <ResultCard item={item} teamsById={new Map()} leaguesById={new Map()} seasonsById={new Map()} onPublish={() => undefined} onShare={() => undefined} />
)

describe('ResultCard In Player Hub chip', () => {
  it('shows the chip next to Published when the result is shown in the Player Hub', () => {
    render(wrap(card(shown)))
    expect(screen.getByText('Published')).toBeInTheDocument()
    expect(screen.getByText('In Player Hub')).toBeInTheDocument()
  })

  it('shows no chip for a published result that is not shown, or for a draft', () => {
    const { unmount } = render(wrap(card(hidden)))
    expect(screen.queryByText('In Player Hub')).not.toBeInTheDocument()
    unmount()
    render(wrap(card(draft)))
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.queryByText('In Player Hub')).not.toBeInTheDocument()
  })
})

describe('ResultTable In Player Hub chip', () => {
  const table = (items: (typeof shown)[]) =>
    render(wrap(<ResultTable items={items} teamsById={new Map()} toolbar={null} empty={null} renderActions={() => null} />))

  it('shows the chip only on the rows whose result is in the Player Hub', () => {
    table([shown, hidden, draft])
    expect(screen.getAllByTestId('result-hub-chip')).toHaveLength(1)
    expect(screen.getByTestId('result-hub-chip')).toHaveTextContent('In Player Hub')
    expect(screen.getAllByText('Published')).toHaveLength(2)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })
})
