import { describe, expect, it } from 'vitest'
import { ageFromDateOfBirth, formatDateOfBirth } from './playerFormat'

describe('formatDateOfBirth', () => {
  it('formats an ISO date as day short-month year', () => {
    expect(formatDateOfBirth('1991-03-04')).toBe('4 Mar 1991')
  })
  it('shows a dash when there is none', () => {
    expect(formatDateOfBirth(null)).toBe('–')
  })
  it('returns the raw text when it is not a date', () => {
    expect(formatDateOfBirth('nonsense')).toBe('nonsense')
  })
})

describe('ageFromDateOfBirth', () => {
  const now = new Date('2026-10-09T12:00:00')
  it('counts completed years on the birthday', () => {
    expect(ageFromDateOfBirth('1980-10-09', now)).toBe(46)
  })
  it('is a year less the day before the birthday', () => {
    expect(ageFromDateOfBirth('1980-10-10', now)).toBe(45)
  })
  it('is null for none, invalid or future dates', () => {
    expect(ageFromDateOfBirth(null, now)).toBeNull()
    expect(ageFromDateOfBirth('nonsense', now)).toBeNull()
    expect(ageFromDateOfBirth('2030-01-01', now)).toBeNull()
  })
})
