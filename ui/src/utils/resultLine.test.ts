import { describe, expect, it } from 'vitest'
import { inningsFor, inningsScoreText, resultLine, resultPerspective } from './resultLine'
import type { ResultLineInput } from './resultLine'

const names = { home: 'Irene Villagers 1', away: 'Pretoria CC' }
const base: ResultLineInput = {
  outcomeType: 'WON',
  decidedBy: 'REGULAR',
  winningSide: 'HOME',
  marginType: 'RUNS',
  marginValue: 24,
}

describe('resultLine', () => {
  it('writes a win by runs and by wickets', () => {
    expect(resultLine(base, names)).toBe('Irene Villagers 1 won by 24 runs')
    expect(resultLine({ ...base, winningSide: 'AWAY', marginType: 'WICKETS', marginValue: 1 }, names)).toBe(
      'Pretoria CC won by 1 wicket',
    )
  })

  it('marks DLS and super over wins', () => {
    expect(resultLine({ ...base, decidedBy: 'DLS' }, names)).toBe('Irene Villagers 1 won by 24 runs (DLS)')
    expect(resultLine({ ...base, decidedBy: 'SUPER_OVER', marginType: null, marginValue: null }, names)).toBe(
      'Tied · Irene Villagers 1 won in the super over',
    )
  })

  it('writes the outcomes with no winner and the forfeit', () => {
    const none = { ...base, winningSide: null, marginType: null, marginValue: null }
    expect(resultLine({ ...none, outcomeType: 'TIE' }, names)).toBe('Match tied')
    expect(resultLine({ ...none, outcomeType: 'DRAW' }, names)).toBe('Match drawn')
    expect(resultLine({ ...none, outcomeType: 'NO_RESULT' }, names)).toBe('No result')
    expect(resultLine({ ...none, outcomeType: 'ABANDONED' }, names)).toBe('Abandoned')
    expect(resultLine({ ...base, outcomeType: 'FORFEIT', winningSide: 'AWAY' }, names)).toBe('Pretoria CC won by forfeit')
    expect(resultLine({ ...none, outcomeType: null }, names)).toBe('Result not entered yet')
  })
})

describe('resultPerspective', () => {
  it('reads a win and a loss from the club side', () => {
    expect(resultPerspective(base, { home: true, away: false })).toBe('won')
    expect(resultPerspective(base, { home: false, away: true })).toBe('lost')
  })

  it('is neutral for an internal match, a foreign match and a result with no winner', () => {
    expect(resultPerspective(base, { home: true, away: true })).toBe('neutral')
    expect(resultPerspective(base, { home: false, away: false })).toBe('neutral')
    expect(resultPerspective({ outcomeType: 'TIE', winningSide: null }, { home: true, away: false })).toBe('neutral')
  })

  it('counts a forfeit by its receiving side', () => {
    expect(resultPerspective({ outcomeType: 'FORFEIT', winningSide: 'AWAY' }, { home: true, away: false })).toBe('lost')
  })
})

describe('inningsScoreText', () => {
  it('writes runs, wickets and overs', () => {
    expect(inningsScoreText({ battingSide: 'HOME', runs: 212, wickets: 6, balls: 240 })).toBe('212/6 (40.0)')
    expect(inningsScoreText({ battingSide: 'HOME', runs: 150, wickets: null, balls: null })).toBe('150')
    expect(inningsScoreText({ battingSide: 'HOME', runs: null, wickets: null, balls: null })).toBe('')
  })

  it('picks one side innings in sequence order', () => {
    const innings = [
      { sequence: 4, battingSide: 'HOME' as const, runs: 9, wickets: 0, balls: 6 },
      { sequence: 1, battingSide: 'HOME' as const, runs: 200, wickets: 5, balls: 240 },
      { sequence: 2, battingSide: 'AWAY' as const, runs: 200, wickets: 8, balls: 240 },
    ]
    expect(inningsFor(innings, 'HOME').map((item) => item.sequence)).toEqual([1, 4])
  })
})

describe('resultLine gaps', () => {
  it('uses singular units for a margin of one', () => {
    expect(resultLine({ ...base, marginValue: 1 }, names)).toBe('Irene Villagers 1 won by 1 run')
    expect(resultLine({ ...base, marginType: 'WICKETS', marginValue: 1, winningSide: 'AWAY' }, names)).toBe('Pretoria CC won by 1 wicket')
  })

  it('degrades gracefully when the margin or the winner is missing', () => {
    expect(resultLine({ ...base, marginType: null, marginValue: null }, names)).toBe('Irene Villagers 1 won')
    expect(resultLine({ ...base, winningSide: null }, names)).toBe('Won')
    expect(resultLine({ ...base, outcomeType: null }, names)).toBe('Result not entered yet')
  })

  it('writes a DLS win with its margin and the draw / tie / no result outcomes', () => {
    expect(resultLine({ ...base, decidedBy: 'DLS', marginType: 'WICKETS', marginValue: 3, winningSide: 'AWAY' }, names)).toBe('Pretoria CC won by 3 wickets (DLS)')
    expect(resultLine({ ...base, outcomeType: 'DRAW' }, names)).toBe('Match drawn')
    expect(resultLine({ ...base, outcomeType: 'TIE', winningSide: null }, names)).toBe('Match tied')
    expect(resultLine({ ...base, outcomeType: 'NO_RESULT', winningSide: null }, names)).toBe('No result')
  })

  it('writes innings scores with a non-six over length and zero wickets', () => {
    expect(inningsScoreText({ battingSide: 'HOME', runs: 40, wickets: 0, balls: 38 }, 5)).toBe('40/0 (7.3)')
  })
})
