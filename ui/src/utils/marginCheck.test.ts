import { describe, expect, it } from 'vitest'
import type { Innings, ResultDraft } from '../api/matchResultApi'
import { checkMargin, suggestionText } from './marginCheck'

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

describe('checkMargin gaps', () => {
  const run = [inn(1, 'HOME', 200, 5), inn(2, 'AWAY', 176, 9)]

  it('matches a correct run margin and mentions the contradiction only as a warning-style reason', () => {
    const right = checkMargin(draft({ winningSide: 'HOME', marginType: 'RUNS', marginValue: 24 }, run), names)
    expect(right.status).toBe('match')
    expect(right.reason).toBe('The margin of 24 runs matches the scores.')
    const wrong = checkMargin(draft({ winningSide: 'HOME', marginType: 'RUNS', marginValue: 30 }, run), names)
    expect(wrong.status).toBe('mismatch')
    expect(wrong.reason).toBe('You entered won by 30 runs; the scores say 24 runs.')
    expect(wrong.suggestion).toMatchObject({ winningSide: 'HOME', marginType: 'RUNS', marginValue: 24 })
  })

  it('asks for a margin when none was entered and still proposes one', () => {
    const check = checkMargin(draft({ winningSide: 'HOME' }, run), names)
    expect(check.status).toBe('mismatch')
    expect(check.reason).toBe('No margin entered; the scores say 24 runs.')
  })

  it('proposes the wickets in hand for the chasing side, singular for one', () => {
    const chase = [inn(1, 'HOME', 150, 8), inn(2, 'AWAY', 151, 9)]
    const check = checkMargin(draft({ winningSide: 'AWAY' }, chase), names)
    expect(check.suggestion).toMatchObject({ winningSide: 'AWAY', marginType: 'WICKETS', marginValue: 1 })
    expect(suggestionText(check.suggestion!, names)).toBe('Away won by 1 wicket')
  })

  it('treats level scores as a tie suggestion and a "was it a tie" mismatch for a win', () => {
    const level = [inn(1, 'HOME', 150, 8), inn(2, 'AWAY', 150, 9)]
    const check = checkMargin(draft({ winningSide: 'HOME', marginType: 'RUNS', marginValue: 0 }, level), names)
    expect(check.status).toBe('mismatch')
    expect(check.suggestion).toMatchObject({ outcomeType: 'TIE' })
    expect(suggestionText(check.suggestion!, names)).toBe('Match tied')
  })

  it('asks for another super over when the super over is level, and for the innings when none are in', () => {
    const level = [inn(1, 'HOME', 150, 8), inn(2, 'AWAY', 150, 9)]
    const tied = [...level, inn(3, 'AWAY', 10, 1, 'SUPER_OVER'), inn(4, 'HOME', 10, 1, 'SUPER_OVER')]
    expect(checkMargin(draft({ decidedBy: 'SUPER_OVER', winningSide: 'HOME' }, tied), names).reason).toBe('The super over is level too; add another super over.')
    expect(checkMargin(draft({ decidedBy: 'SUPER_OVER', winningSide: 'HOME' }, level), names).status).toBe('cannot-check')
  })

  it('flags a super over win when the regular scores were not level', () => {
    const check = checkMargin(draft({ decidedBy: 'SUPER_OVER', winningSide: 'HOME' }, run), names)
    expect(check.status).toBe('mismatch')
    expect(check.reason).toMatch(/needs level scores/)
  })

  it('checks a DLS winner against the target', () => {
    const innings = [inn(1, 'HOME', 200, 5), inn(2, 'AWAY', 150, 4)]
    expect(checkMargin(draft({ decidedBy: 'DLS', winningSide: 'AWAY', dlsTarget: 160 }, innings), names).status).toBe('mismatch')
    expect(checkMargin(draft({ decidedBy: 'DLS', winningSide: 'HOME', dlsTarget: 160 }, innings), names).status).toBe('cannot-check')
  })

  it('mentions overs to spare when a chase finishes early', () => {
    const chase = [inn(1, 'HOME', 150, 8), { ...inn(2, 'AWAY', 151, 5), balls: 220 }]
    const check = checkMargin(draft({ winningSide: 'AWAY', marginType: 'WICKETS', marginValue: 5, scheduledBalls: 240 }, chase), names)
    expect(check.status).toBe('match')
    expect(check.reason).toContain('3.2 overs to spare')
  })
})
