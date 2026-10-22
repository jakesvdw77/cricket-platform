import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PlayerHeadlineTiles } from './PlayerHeadlineTiles'
import type { PlayerStats } from '../../../api/playerStatsApi'

// docs/specs/117-stats-dashboard.md (decision 14): the Matches, Runs, Wickets, Catches strip shared by the Matches tab and the Overview tab,
// with the `tile-*` test ids it had when it lived in MatchesTab.
const stats = (over: { matches?: number | null; runs?: number | null; wickets?: number | null; catches?: number | null } = {}) =>
  ({
    basis: { matchesCounted: 'matches' in over ? over.matches : 18 },
    batting: { runs: 'runs' in over ? over.runs : 412 },
    bowling: { wickets: 'wickets' in over ? over.wickets : 21 },
    fielding: { catches: 'catches' in over ? over.catches : 9 },
  }) as unknown as PlayerStats

describe('PlayerHeadlineTiles', () => {
  it('renders the four tiles in order with the same test ids, labels and the server\'s figures', () => {
    render(<PlayerHeadlineTiles stats={stats()} />)
    const expected: [string, string, string][] = [
      ['tile-matches', 'Matches', '18'],
      ['tile-runs', 'Runs', '412'],
      ['tile-wickets', 'Wickets', '21'],
      ['tile-catches', 'Catches', '9'],
    ]
    const tiles = expected.map(([id]) => screen.getByTestId(id))
    for (const [index, [id, label, value]] of expected.entries()) {
      expect(tiles[index]).toHaveTextContent(label)
      expect(screen.getByTestId(`${id}-value`)).toHaveTextContent(value)
    }
    // document order is Matches, Runs, Wickets, Catches
    for (let index = 1; index < tiles.length; index += 1) {
      expect(tiles[index - 1].compareDocumentPosition(tiles[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('shows a dash for a figure that is not on file, and keeps a real 0 as 0', () => {
    render(<PlayerHeadlineTiles stats={stats({ runs: null, wickets: 0 })} />)
    expect(screen.getByTestId('tile-runs-value')).toHaveTextContent('–')
    expect(screen.getByTestId('tile-wickets-value')).toHaveTextContent(/^0$/)
  })
})
