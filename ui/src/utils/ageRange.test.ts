import { describe, expect, it } from 'vitest'
import { ageRangeLabel, ageRangeWritten } from './ageRange'

describe('ageRangeLabel', () => {
  it('joins both ages with an en dash', () => {
    expect(ageRangeLabel({ minAge: 6, maxAge: 9 })).toBe('6–9')
  })
  it('shows min only as "N+"', () => {
    expect(ageRangeLabel({ minAge: 40, maxAge: null })).toBe('40+')
  })
  it('shows max only as "Under N"', () => {
    expect(ageRangeLabel({ minAge: null, maxAge: 12 })).toBe('Under 12')
  })
  it('returns null when neither is set', () => {
    expect(ageRangeLabel({ minAge: null, maxAge: null })).toBeNull()
  })
})

describe('ageRangeWritten', () => {
  it('writes both ages out', () => {
    expect(ageRangeWritten({ minAge: 6, maxAge: 9 })).toBe('6 to 9 years')
  })
  it('writes min only', () => {
    expect(ageRangeWritten({ minAge: 40, maxAge: null })).toBe('40 and over')
  })
  it('writes max only', () => {
    expect(ageRangeWritten({ minAge: null, maxAge: 12 })).toBe('Under 12')
  })
  it('says "Not set" when neither is set', () => {
    expect(ageRangeWritten({ minAge: null, maxAge: null })).toBe('Not set')
  })
})
