import { describe, expect, it } from 'vitest'
import { battingTotals, extrasTotal, hasExtras } from './battingTotals'

describe('battingTotals', () => {
  it('adds the batters and the extras and compares with the innings total', () => {
    const totals = battingTotals(
      [{ runs: 60 }, { runs: 75 }, { runs: null }],
      { wides: 6, noBalls: 2, byes: 3, legByes: 2, penaltyRuns: 0 },
      148,
    )
    expect(totals).toMatchObject({ offBat: 135, extras: 13, total: 148, status: 'match', difference: 0 })
  })

  it('reports a mismatch with the difference', () => {
    expect(battingTotals([{ runs: 100 }], { wides: 5 }, 108)).toMatchObject({ status: 'mismatch', difference: -3 })
  })

  it('cannot compare without an innings total', () => {
    expect(battingTotals([{ runs: 10 }], null, null)).toMatchObject({ status: 'unknown', total: 10, difference: 0 })
  })

  it('sums an extras breakdown with empty parts', () => {
    expect(extrasTotal({ wides: 4, byes: null })).toBe(4)
    expect(extrasTotal(null)).toBe(0)
    expect(hasExtras({ wides: null })).toBe(false)
    expect(hasExtras({ wides: 0 })).toBe(true)
  })
})
