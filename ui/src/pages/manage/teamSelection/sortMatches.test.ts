import { describe, expect, it } from 'vitest'
import { makeMatch } from './teamSelectionTestUtils'
import { sortMatchesByDate } from './sortMatches'

describe('sortMatchesByDate', () => {
  const early = makeMatch({ matchId: 'early', matchDate: '2026-11-01T10:00:00' })
  const late = makeMatch({ matchId: 'late', matchDate: '2026-11-08T10:00:00' })

  it('puts the soonest match first, and the latest first when asked, without changing the input', () => {
    const input = [late, early]
    expect(sortMatchesByDate(input, 'asc').map((match) => match.matchId)).toEqual(['early', 'late'])
    expect(sortMatchesByDate(input, 'desc').map((match) => match.matchId)).toEqual(['late', 'early'])
    expect(input.map((match) => match.matchId)).toEqual(['late', 'early'])
  })
})
