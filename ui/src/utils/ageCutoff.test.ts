import { describe, expect, it } from 'vitest'
import { cutoffError, DEFAULT_CUTOFF, formatReferenceDate, maxDayInMonth } from './ageCutoff'

describe('ageCutoff', () => {
  it('defaults to 31 December', () => {
    expect(DEFAULT_CUTOFF).toEqual({ month: 12, day: 31 })
  })

  it('knows the longest day of each month, allowing 29 February', () => {
    expect(maxDayInMonth(1)).toBe(31)
    expect(maxDayInMonth(2)).toBe(29)
    expect(maxDayInMonth(4)).toBe(30)
    expect(maxDayInMonth(12)).toBe(31)
  })

  it('accepts neither, both and 29 February', () => {
    expect(cutoffError(null, null)).toBeNull()
    expect(cutoffError(12, 31)).toBeNull()
    expect(cutoffError(2, 29)).toBeNull()
  })

  it('refuses one without the other', () => {
    expect(cutoffError(12, null)).toBe('pair')
    expect(cutoffError(null, 31)).toBe('pair')
  })

  it('refuses a day that does not exist in the month', () => {
    expect(cutoffError(4, 31)).toBe('day')
    expect(cutoffError(2, 30)).toBe('day')
    expect(cutoffError(1, 0)).toBe('day')
  })

  it('formats a reference date', () => {
    expect(formatReferenceDate('2026-12-31')).toBe('31 Dec 2026')
    expect(formatReferenceDate('2027-07-14')).toBe('14 Jul 2027')
    expect(formatReferenceDate('2027-09-01')).toBe('1 Sep 2027')
  })
})
