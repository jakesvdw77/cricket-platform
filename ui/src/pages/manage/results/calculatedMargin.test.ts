import { describe, expect, it } from 'vitest'
import type { Innings, ResultDraft } from '../../../api/matchResultApi'
import { calculatedMargin, marginCorrected, withCalculatedMargin } from './calculatedMargin'
import { emptyDraft } from './resultDraftHelpers'

const names = { home: '1st XI', away: 'Riverside' }
const inn = (sequence: number, battingSide: 'HOME' | 'AWAY', runs: number | null, wickets: number | null = 5): Innings => ({ sequence, kind: 'REGULAR', battingSide, runs, wickets, balls: 120 })
const won = (patch: Partial<ResultDraft> = {}): ResultDraft => ({
  ...emptyDraft(),
  outcomeType: 'WON',
  winningSide: 'HOME',
  innings: [inn(1, 'HOME', 200), inn(2, 'AWAY', 176, 9)],
  ...patch,
})

describe('calculatedMargin', () => {
  it('is the runs by which the side that batted first won', () => {
    expect(calculatedMargin(won(), names)).toEqual({ type: 'RUNS', value: 24 })
  })

  it('is the wickets in hand when the chasing side won', () => {
    const chased = won({ winningSide: 'AWAY', innings: [inn(1, 'HOME', 150), inn(2, 'AWAY', 151, 4)] })
    expect(calculatedMargin(chased, names)).toEqual({ type: 'WICKETS', value: 6 })
  })

  it('is null when it is not a regular win, an innings is missing, or the winner is not the one the scores support', () => {
    expect(calculatedMargin(won({ outcomeType: 'TIE', winningSide: null }), names)).toBeNull()
    expect(calculatedMargin(won({ decidedBy: 'SUPER_OVER' }), names)).toBeNull()
    expect(calculatedMargin(won({ innings: [inn(1, 'HOME', 200), inn(2, 'AWAY', null)] }), names)).toBeNull()
    expect(calculatedMargin(won({ winningSide: 'AWAY' }), names)).toBeNull()
    expect(calculatedMargin(won({ winningSide: null }), names)).toBeNull()
  })
})

describe('withCalculatedMargin', () => {
  it('writes the calculated margin and marks it as not edited', () => {
    expect(withCalculatedMargin(won(), names)).toMatchObject({ marginType: 'RUNS', marginValue: 24, marginCorrected: false })
  })

  it('follows later score changes while it is still calculated', () => {
    const first = withCalculatedMargin(won(), names)
    const changed = withCalculatedMargin({ ...first, innings: [inn(1, 'HOME', 210), inn(2, 'AWAY', 176, 9)] }, names)
    expect(changed.marginValue).toBe(34)
  })

  it('keeps the manager\'s own margin and flags it as edited', () => {
    const typed = won({ marginType: 'RUNS', marginValue: 20 })
    expect(marginCorrected(typed, names)).toBe(true)
    expect(withCalculatedMargin(typed, names)).toBe(typed)
  })

  it('returns the same draft when nothing changes, and when there is nothing to calculate', () => {
    const synced = withCalculatedMargin(won(), names)
    expect(withCalculatedMargin(synced, names)).toBe(synced)
    const tie = won({ outcomeType: 'TIE', winningSide: null })
    expect(withCalculatedMargin(tie, names)).toBe(tie)
  })

  it('treats a margin equal to the calculation as not edited', () => {
    expect(marginCorrected(won({ marginType: 'RUNS', marginValue: 24 }), names)).toBe(false)
    expect(marginCorrected(won({ marginType: 'RUNS', marginValue: null }), names)).toBe(false)
  })
})
