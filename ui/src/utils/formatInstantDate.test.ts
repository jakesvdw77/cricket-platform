import { describe, expect, it } from 'vitest'
import { formatInstantDate } from './formatInstantDate'

// docs/specs/115-player-match-list.md: an ISO instant written as a date. Noon UTC keeps the day the same in every real time zone.
describe('formatInstantDate', () => {
  it('writes a short date by default', () => {
    expect(formatInstantDate('2026-03-14T12:00:00Z')).toBe('14 Mar 2026')
  })

  it('spells the month when long, for an accessible name', () => {
    expect(formatInstantDate('2026-03-14T12:00:00Z', true)).toBe('14 March 2026')
  })

  it('returns an empty string for a missing value and the raw text for an unparseable one', () => {
    expect(formatInstantDate(null)).toBe('')
    expect(formatInstantDate(undefined)).toBe('')
    expect(formatInstantDate('')).toBe('')
    expect(formatInstantDate('not a date')).toBe('not a date')
  })
})
