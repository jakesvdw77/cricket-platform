import { describe, expect, it } from 'vitest'
import { parseCompetition } from './statsCompetition'

describe('parseCompetition', () => {
  it('accepts only the two known values', () => {
    expect(parseCompetition('LEAGUE')).toBe('LEAGUE')
    expect(parseCompetition('FRIENDLY')).toBe('FRIENDLY')
    expect(parseCompetition('league')).toBeNull()
    expect(parseCompetition('')).toBeNull()
    expect(parseCompetition(null)).toBeNull()
  })
})
