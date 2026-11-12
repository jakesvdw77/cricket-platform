import { describe, expect, it } from 'vitest'
import { DASH, basedOn, clip, dayText, firstNameOf, formatCount, formatDecimal, formatPercent, formatSigned, need, nOfM, ordinal, oversOrBalls, plural, positionLabel, scoreText, whereText, wicketsForRuns } from './statsFormat'

// docs/specs/147: formatting only. A missing value is a dash, never a zero.
describe('dashes for missing values', () => {
  it('gives a dash for null, undefined and NaN, but a real figure for zero', () => {
    for (const missing of [null, undefined, Number.NaN]) {
      expect(formatCount(missing)).toBe(DASH)
      expect(formatDecimal(missing)).toBe(DASH)
      expect(formatSigned(missing)).toBe(DASH)
      expect(formatPercent(missing)).toBe(DASH)
      expect(ordinal(missing)).toBe(DASH)
      expect(scoreText(missing, false)).toBe(DASH)
    }
    expect(formatCount(0)).toBe('0')
    expect(formatDecimal(0)).toBe('0.0')
    expect(formatPercent(0)).toBe('0%')
  })
})

describe('numbers', () => {
  it('formats decimals and percentages to the requested places', () => {
    expect(formatDecimal(61.4286)).toBe('61.4')
    expect(formatDecimal(5, 2)).toBe('5.00')
    expect(formatPercent(54.2)).toBe('54%')
    expect(formatPercent(54.25, 1)).toBe('54.3%')
  })

  it('signs a difference: plus, minus, and no sign on zero or a value that rounds to zero', () => {
    expect(formatSigned(1.25)).toBe('+1.25')
    expect(formatSigned(-0.3)).toBe('-0.30')
    expect(formatSigned(0)).toBe('0.00')
    expect(formatSigned(-0.001)).toBe('0.00')
    expect(formatSigned(2, 0)).toBe('+2')
  })

  it('writes "N of M" only when both are known', () => {
    expect(nOfM(6, 7)).toBe('6 of 7')
    expect(nOfM(0, 7)).toBe('0 of 7')
    expect(nOfM(null, 7)).toBe(DASH)
    expect(nOfM(6, undefined)).toBe(DASH)
  })

  it('writes ordinals, including the teens', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111, 112].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st', '111th', '112th'])
  })
})

describe('words', () => {
  it('writes a score with the not out star and wickets for runs', () => {
    expect(scoreText(47, true)).toBe('47*')
    expect(scoreText(0, false)).toBe('0')
    expect(wicketsForRuns(2, 21)).toBe('2/21')
    expect(wicketsForRuns(null, 21)).toBe(DASH)
  })

  it('pluralises, with an irregular plural when given', () => {
    expect(plural(1, 'innings', 'innings')).toBe('1 innings')
    expect(plural(2, 'catch', 'catches')).toBe('2 catches')
    expect(plural(0, 'run-out')).toBe('0 run-outs')
  })

  it('uses the first name, with the fallback for a blank or missing one', () => {
    expect(firstNameOf(' Sam ')).toBe('Sam')
    expect(firstNameOf('  ')).toBe('This Player')
    expect(firstNameOf(null)).toBe('This Player')
  })

  it('shortens a long name and labels positions and venues', () => {
    expect(clip('Riverside Cricket Ground')).toBe('Riverside Cr…')
    expect(clip('Short')).toBe('Short')
    expect(positionLabel({ key: 'OPENER', label: 'Opener' })).toBe('Opener')
    expect(positionLabel({ key: '4', label: '4' })).toBe('No. 4')
    expect(whereText(true)).toBe('Home')
    expect(whereText(false)).toBe('Away')
    expect(whereText(null)).toBe(DASH)
  })

  it('gives a short date, the raw text for a non-date and a dash for none', () => {
    expect(dayText('2026-11-01T08:00:00Z')).toMatch(/1 Nov/)
    expect(dayText('not a date')).toBe('not a date')
    expect(dayText(null)).toBe(DASH)
  })

  it('writes the honesty line, or nothing without a basis', () => {
    expect(basedOn({ counted: 6, total: 7 })).toBe('Based on 6 of 7 results')
    expect(basedOn(null)).toBe('')
  })
})

describe('oversOrBalls', () => {
  it('shows overs when the over length is known and the balls when it is mixed or unknown', () => {
    expect(oversOrBalls(147, 6)).toBe('24.3')
    expect(oversOrBalls(147, null)).toBe('147 balls')
    expect(oversOrBalls(147, 0)).toBe('147 balls')
  })
})

describe('need', () => {
  it('returns a present block and throws for an absent one, so the grid guard can show the quiet missing text', () => {
    expect(need({ a: 1 })).toEqual({ a: 1 })
    expect(need(0)).toBe(0)
    expect(() => need(null)).toThrow()
    expect(() => need(undefined)).toThrow()
  })
})
