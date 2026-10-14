import { describe, expect, it } from 'vitest'
import { ballsToOvers, parseOvers, validateOvers } from './oversFormat'

describe('ballsToOvers', () => {
  it('writes balls as overs.balls', () => {
    expect(ballsToOvers(220)).toBe('36.4')
    expect(ballsToOvers(240)).toBe('40.0')
    expect(ballsToOvers(0)).toBe('0.0')
  })

  it('follows balls per over', () => {
    expect(ballsToOvers(35, 5)).toBe('7.0')
    expect(ballsToOvers(38, 5)).toBe('7.3')
  })

  it('is empty for a missing figure', () => {
    expect(ballsToOvers(null)).toBe('')
    expect(ballsToOvers(undefined)).toBe('')
    expect(ballsToOvers(-1)).toBe('')
  })
})

describe('parseOvers', () => {
  it('reads whole overs and overs with balls', () => {
    expect(parseOvers('36.4')).toEqual({ ok: true, balls: 220 })
    expect(parseOvers('36')).toEqual({ ok: true, balls: 216 })
    expect(parseOvers(' 40.0 ')).toEqual({ ok: true, balls: 240 })
  })

  it('rejects a ball digit at or above balls per over', () => {
    expect(parseOvers('36.6').ok).toBe(false)
    expect(parseOvers('36.6', 8)).toEqual({ ok: true, balls: 294 })
  })

  it('rejects text that is not overs', () => {
    expect(parseOvers('').ok).toBe(false)
    expect(parseOvers('abc').ok).toBe(false)
    expect(parseOvers('36.45').ok).toBe(false)
    expect(parseOvers('-3').ok).toBe(false)
  })
})

describe('validateOvers', () => {
  it('returns null when valid and a message when not', () => {
    expect(validateOvers('12.5')).toBeNull()
    expect(validateOvers('12.7')).toMatch(/0 to 5/)
  })
})
