import { describe, expect, it } from 'vitest'
import { extrasLine, fieldingCredits, runsPerOver, strikeRate, targetLine, totalLine } from './scorecardView'

const innings = (patch = {}) => ({ battingSide: 'HOME' as const, runs: 133, wickets: 7, balls: 120, ...patch })

describe('strikeRate', () => {
  it('is runs per 100 balls to two places, and a dash without balls or runs', () => {
    expect(strikeRate(30, 20)).toBe('150.00')
    expect(strikeRate(0, 10)).toBe('0.00')
    expect(strikeRate(10, 0)).toBe('–')
    expect(strikeRate(null, 10)).toBe('–')
    expect(strikeRate(10, null)).toBe('–')
  })
})

describe('runsPerOver', () => {
  it('is economy / run rate using the match balls per over', () => {
    expect(runsPerOver(24, 24, 6)).toBe('6.00')
    expect(runsPerOver(30, 20, 5)).toBe('7.50')
    expect(runsPerOver(24, 0, 6)).toBe('–')
    expect(runsPerOver(null, 12, 6)).toBe('–')
  })
})

describe('extrasLine', () => {
  it('writes the breakdown and the total', () => {
    expect(extrasLine({ byes: 4, legByes: 1, wides: 3, noBalls: 0, penaltyRuns: 0, extras: 8 }, null)).toBe('Extras (b 4, lb 1, w 3, nb 0, pen 0) 8')
  })

  it('treats missing parts as zero and falls back to the given total', () => {
    expect(extrasLine({ byes: null, legByes: null, wides: 2, noBalls: null, penaltyRuns: null, extras: null }, 5)).toBe('Extras (b 0, lb 0, w 2, nb 0, pen 0) 5')
  })

  it('is null when nothing is known and shows only the total when there is no breakdown', () => {
    expect(extrasLine(undefined, null)).toBeNull()
    expect(extrasLine(undefined, 9)).toBe('Extras (b 0, lb 0, w 0, nb 0, pen 0) 9')
  })
})

describe('totalLine', () => {
  it('reads wickets, whole overs without the .0, and the run rate', () => {
    expect(totalLine(innings(), 6)).toEqual({ text: 'Total 7 wickets, 20 overs: 133', runRate: '6.65' })
  })

  it('keeps a part over, says all out, and uses singular for one wicket', () => {
    expect(totalLine(innings({ balls: 111, allOut: true }), 6).text).toBe('Total all out, 18.3 overs: 133')
    expect(totalLine(innings({ wickets: 1 }), 6).text).toBe('Total 1 wicket, 20 overs: 133')
  })

  it('drops what is not known', () => {
    expect(totalLine(innings({ wickets: null, balls: null }), 6)).toEqual({ text: 'Total: 133', runRate: null })
    expect(totalLine(innings({ runs: null }), 6).text).toBe('Total 7 wickets, 20 overs: –')
  })
})

describe('targetLine', () => {
  const result = { decidedBy: 'REGULAR' as const, outcomeType: 'WON' as const, scheduledBalls: 120, ballsPerOver: 6 }

  it('is runs + 1 from the scheduled overs for the side batting second', () => {
    expect(targetLine(result, innings({ runs: 133 }), true)).toBe('Target: 134 runs from 20 overs')
  })

  it('is null for the first innings, a super over, a non-win or without the figures', () => {
    expect(targetLine(result, innings(), false)).toBeNull()
    expect(targetLine({ ...result, decidedBy: 'SUPER_OVER' }, innings(), true)).toBeNull()
    expect(targetLine({ ...result, outcomeType: 'TIE' }, innings(), true)).toBeNull()
    expect(targetLine({ ...result, scheduledBalls: null }, innings(), true)).toBeNull()
    expect(targetLine(result, innings({ runs: null }), true)).toBeNull()
    expect(targetLine(result, undefined, true)).toBeNull()
  })
})

describe('fieldingCredits', () => {
  it('lists the credits with plurals and leaves out zeros', () => {
    expect(fieldingCredits({ catches: 2, stumpings: 1, runOuts: 1 })).toBe('2 catches, 1 stumping, 1 run-out')
    expect(fieldingCredits({ catches: 1, stumpings: 0, runOuts: 2 })).toBe('1 catch, 2 run-outs')
    expect(fieldingCredits({ catches: null, stumpings: null, runOuts: null })).toBe('')
  })
})
