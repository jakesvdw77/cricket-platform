import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StageChip } from './StageChip'
import { matchSideName } from './matchCardHelpers'

describe('StageChip (spec 155)', () => {
  it('shows the stage as a chip', () => {
    render(<StageChip match={{ stage: 'Semi-final' }} />)
    expect(screen.getByTestId('match-stage-chip')).toHaveTextContent('Semi-final')
  })

  it('shows nothing for a pool match', () => {
    const { container } = render(<StageChip match={{ stage: null }} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('matchSideName (spec 155)', () => {
  const base = { homeTeamId: null, homeTeamName: '1st in the pool', awayTeamId: null, awayTeamName: 'Paarl Heat', homePlaceholder: true, awayPlaceholder: false }
  it('reads a TBC side as "TBC: text" and a real side by its name', () => {
    expect(matchSideName(base, 'home', new Map())).toBe('TBC: 1st in the pool')
    expect(matchSideName(base, 'away', new Map())).toBe('Paarl Heat')
  })
})
