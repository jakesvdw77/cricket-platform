import { describe, expect, it } from 'vitest'
import { formatRetryIn, initialsOf } from './publicAvailabilityFormat'

describe('publicAvailabilityFormat', () => {
  it('formats the retry hint', () => {
    expect(formatRetryIn(null)).toBeNull()
    expect(formatRetryIn(undefined)).toBeNull()
    expect(formatRetryIn(30)).toBe('in less than a minute')
    expect(formatRetryIn(61)).toBe('in 2 minutes')
    expect(formatRetryIn(900)).toBe('in 15 minutes')
    expect(formatRetryIn(3600)).toBe('in 1 hour')
    expect(formatRetryIn(7300)).toBe('in 3 hours')
  })

  it('derives up to two initials', () => {
    expect(initialsOf('Irene Villagers')).toBe('IV')
    expect(initialsOf('Over 40 fixtures extra')).toBe('O4')
    expect(initialsOf('')).toBe('A')
  })
})
