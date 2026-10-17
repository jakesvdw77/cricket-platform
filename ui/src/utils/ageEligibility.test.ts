import { describe, expect, it } from 'vitest'
import { ageOn, ageProblemOf, ageWords, effectiveAgeLimits, writtenDate } from './ageEligibility'

describe('ageEligibility', () => {
  it('counts whole years, the birthday itself included', () => {
    expect(ageOn('2011-12-31', '2026-12-30')).toBe(14)
    expect(ageOn('2011-12-31', '2026-12-31')).toBe(15)
    expect(ageOn('2012-02-29', '2025-02-28')).toBe(12)
  })

  it('judges both limits inclusively', () => {
    const limits = { minAge: 13, maxAge: 15 }
    expect(ageProblemOf('2013-12-31', limits, '2026-12-31')).toBeNull()
    expect(ageProblemOf('2014-01-01', limits, '2026-12-31')).toBe('TOO_YOUNG')
    expect(ageProblemOf('2011-01-01', limits, '2026-12-31')).toBeNull()
    expect(ageProblemOf('2010-12-31', limits, '2026-12-31')).toBe('TOO_OLD')
    expect(ageProblemOf(null, limits, '2026-12-31')).toBe('NO_DATE_OF_BIRTH')
  })

  it('takes the league limits when it sets either, otherwise the section', () => {
    expect(effectiveAgeLimits({ minAge: 1, maxAge: 2 }, { minAge: null, maxAge: 15 })).toEqual({ minAge: null, maxAge: 15 })
    expect(effectiveAgeLimits({ minAge: null, maxAge: 13 }, { minAge: null, maxAge: null })).toEqual({ minAge: null, maxAge: 13 })
    expect(effectiveAgeLimits(null, null)).toBeNull()
  })

  it('words the range and the date', () => {
    expect(ageWords({ minAge: 13, maxAge: 15 })).toBe('aged 13 to 15')
    expect(ageWords({ minAge: 40, maxAge: null })).toBe('aged 40 or over')
    expect(ageWords({ minAge: null, maxAge: 15 })).toBe('aged 15 or under')
    expect(writtenDate('2026-12-31')).toBe('31 Dec 2026')
  })
})
