import { describe, expect, it } from 'vitest'
import type { Innings, ResultDraft } from '../api/matchResultApi'
import { checkMargin } from './marginCheck'

const names = { home: 'Home', away: 'Away' }
const inn = (sequence: number, battingSide: 'HOME' | 'AWAY', runs: number, wickets: number, kind: 'REGULAR' | 'SUPER_OVER' = 'REGULAR'): Innings => ({
  sequence, kind, battingSide, runs, wickets, balls: 240,
})
const draft = (patch: Partial<ResultDraft>, innings: Innings[]): ResultDraft => ({ outcomeType: 'WON', decidedBy: 'REGULAR', innings, ...patch })

describe('checkMargin', () => {
  it('batting first wins by the run difference', () => {
    const result = checkMargin(draft({ winningSide: 'HOME', marginType: 'RUNS', marginValue: 24 }, [inn(1, 'HOME', 212, 6), inn(2, 'AWAY', 188, 9)]), names)
    expect(result.status).toBe('match')
    expect(result.expected).toEqual({ type: 'RUNS', value: 24 })
  })

  it('flags a wrong run margin with both figures', () => {
    const result = checkMargin(draft({ winningSide: 'HOME', marginType: 'RUNS', marginValue: 20 }, [inn(1, 'HOME', 212, 6), inn(2, 'AWAY', 188, 9)]), names)
    expect(result.status).toBe('mismatch')
    expect(result.reason).toContain('20 runs')
    expect(result.reason).toContain('24 runs')
  })

  it('chasing side wins by the wickets in hand', () => {
    const result = checkMargin(draft({ winningSide: 'AWAY', marginType: 'WICKETS', marginValue: 4 }, [inn(1, 'HOME', 180, 8), inn(2, 'AWAY', 181, 6)]), names)
    expect(result.status).toBe('match')
  })

  it('catches the wrong winner when the chaser fell short', () => {
    const result = checkMargin(draft({ winningSide: 'AWAY', marginType: 'WICKETS', marginValue: 1 }, [inn(1, 'HOME', 200, 5), inn(2, 'AWAY', 150, 10)]), names)
    expect(result.status).toBe('mismatch')
    expect(result.suggestion).toMatchObject({ winningSide: 'HOME', marginType: 'RUNS', marginValue: 50 })
  })

  it('a tie needs level scores', () => {
    const level = [inn(1, 'HOME', 150, 8), inn(2, 'AWAY', 150, 9)]
    expect(checkMargin(draft({ outcomeType: 'TIE' }, level), names).status).toBe('match')
    expect(checkMargin(draft({ outcomeType: 'TIE' }, [inn(1, 'HOME', 150, 8), inn(2, 'AWAY', 140, 9)]), names).status).toBe('mismatch')
  })

  it('a super over win is decided by the super over runs', () => {
    const innings = [inn(1, 'HOME', 150, 8), inn(2, 'AWAY', 150, 9), inn(3, 'AWAY', 12, 1, 'SUPER_OVER'), inn(4, 'HOME', 8, 2, 'SUPER_OVER')]
    expect(checkMargin(draft({ decidedBy: 'SUPER_OVER', winningSide: 'AWAY' }, innings), names).status).toBe('match')
    expect(checkMargin(draft({ decidedBy: 'SUPER_OVER', winningSide: 'HOME' }, innings), names).status).toBe('mismatch')
  })

  it('does not check DLS margins or no-result outcomes', () => {
    const innings = [inn(1, 'HOME', 200, 5), inn(2, 'AWAY', 150, 4)]
    expect(checkMargin(draft({ decidedBy: 'DLS', winningSide: 'HOME', marginType: 'RUNS', marginValue: 12 }, innings), names).status).toBe('cannot-check')
    expect(checkMargin(draft({ outcomeType: 'ABANDONED' }, innings), names).status).toBe('cannot-check')
  })

  it('needs both innings', () => {
    expect(checkMargin(draft({}, [inn(1, 'HOME', 100, 3)]), names).status).toBe('cannot-check')
  })
})
