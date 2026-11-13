import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Fact, FactsCard, FactTile } from './HubFacts'

// Shared by the league page and the Club info page (docs/specs/148).
describe('HubFacts', () => {
  it('draws a FactTile as a label over a value', () => {
    render(<FactTile label="Season" value="2026/27" />)

    expect(screen.getByText('Season')).toBeInTheDocument()
    expect(screen.getByText('2026/27')).toBeInTheDocument()
  })

  it('draws a FactsCard as a heading over its Fact rows, with an optional trailing action', () => {
    render(
      <FactsCard title="Club details" testId="facts">
        <Fact label="Phone" value="082 555 0100" action={<button type="button">Call</button>} />
        <Fact label="Email" value="a@b.co" last />
      </FactsCard>,
    )

    const card = within(screen.getByTestId('facts'))
    expect(card.getByRole('heading', { name: 'Club details' })).toBeInTheDocument()
    expect(card.getByText('Phone')).toBeInTheDocument()
    expect(card.getByText('a@b.co')).toBeInTheDocument()
    expect(card.getAllByRole('button', { name: 'Call' })).toHaveLength(1)
  })
})
