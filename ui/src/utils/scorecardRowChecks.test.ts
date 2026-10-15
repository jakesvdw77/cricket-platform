import { describe, expect, it } from 'vitest'
import { battingRowProblem, bowlingRowProblem, duplicatePositionKeys, wicketsFullyAttributed } from './scorecardRowChecks'

const bat = (patch: object) => ({ howOut: 'CAUGHT' as const, runs: null, balls: null, fours: null, sixes: null, ...patch })
const bowl = (patch: object) => ({ balls: null, maidens: null, runs: null, wickets: null, wides: null, noBalls: null, dots: null, wicketsSource: 'MANUAL' as const, ...patch })

describe('scorecardRowChecks', () => {
  it('flags figures with no how out, but not a Did not bat row', () => {
    expect(battingRowProblem(bat({ howOut: null, runs: 5 }))).toBe('Choose how out')
    expect(battingRowProblem(bat({ howOut: 'DID_NOT_BAT' }))).toBeNull()
    expect(battingRowProblem(bat({ howOut: null }))).toBeNull()
  })

  it('flags boundaries above the runs and fewer balls than boundaries', () => {
    expect(battingRowProblem(bat({ runs: 10, fours: 2, sixes: 1 }))).toMatch(/more than the runs/)
    expect(battingRowProblem(bat({ runs: 40, balls: 2, fours: 2, sixes: 1 }))).toBe('Fewer balls than boundaries')
    expect(battingRowProblem(bat({ runs: 40, balls: 30, fours: 2, sixes: 1 }))).toBeNull()
  })

  it('finds batters sharing a position', () => {
    expect([...duplicatePositionKeys([{ position: 1, k: 'a' }, { position: 1, k: 'b' }, { position: 2, k: 'c' }], (e) => e.k)]).toEqual(['a', 'b'])
  })

  it('knows when every wicket-taking dismissal names its bowler', () => {
    expect(wicketsFullyAttributed([{ howOut: 'BOWLED', bowlerPlayerId: 'x' }, { howOut: 'RUN_OUT', bowlerPlayerId: null }])).toBe(true)
    expect(wicketsFullyAttributed([{ howOut: 'BOWLED', bowlerPlayerId: null }])).toBe(false)
  })

  it('flags impossible bowling figures', () => {
    const ctx = { ballsPerOver: 6, dismissalWickets: 1 }
    expect(bowlingRowProblem(bowl({ balls: 14, maidens: 3 }), ctx)).toBe('More maidens than complete overs')
    expect(bowlingRowProblem(bowl({ balls: 12, dots: 13 }), ctx)).toBe('More dot balls than balls bowled')
    expect(bowlingRowProblem(bowl({ wickets: 2 }), ctx)).toBe('More wickets than the dismissals credit')
    expect(bowlingRowProblem(bowl({ wickets: 2 }), { ...ctx, dismissalWickets: null })).toBeNull()
    expect(bowlingRowProblem(bowl({ wickets: 2, wicketsSource: 'DERIVED' }), ctx)).toBeNull()
    expect(bowlingRowProblem(bowl({ runs: 5, wides: 4, noBalls: 2 }), ctx)).toBe('Wides and no-balls are more than the runs')
    expect(bowlingRowProblem(bowl({ balls: 12, maidens: 2, runs: 20, wickets: 1 }), ctx)).toBeNull()
  })
})
