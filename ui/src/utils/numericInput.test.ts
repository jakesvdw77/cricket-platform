import { describe, expect, it } from 'vitest'
import { sanitizeInteger, sanitizeOvers } from './numericInput'

describe('sanitizeInteger', () => {
  it('keeps digits only, with no leading zeros', () => {
    expect(sanitizeInteger('-8.9jj')).toBe('89')
    expect(sanitizeInteger('1e5')).toBe('15')
    expect(sanitizeInteger('1,234 runs')).toBe('1234')
    expect(sanitizeInteger('007')).toBe('7')
    expect(sanitizeInteger('0')).toBe('0')
    expect(sanitizeInteger('abc')).toBe('')
  })

  it('ignores a keystroke that would pass the maximum', () => {
    expect(sanitizeInteger('11', { max: 10 }, '1')).toBe('1')
    expect(sanitizeInteger('10', { max: 10 }, '1')).toBe('10')
  })
})

describe('sanitizeOvers', () => {
  it('keeps digits and one point', () => {
    expect(sanitizeOvers('36.4', 6)).toBe('36.4')
    expect(sanitizeOvers('3a6', 6)).toBe('36')
    expect(sanitizeOvers('3.6.1', 6, {}, '3.')).toBe('3.')
    expect(sanitizeOvers('.', 6)).toBe('0.')
  })

  it('ignores a ball digit that is not below the balls per over', () => {
    expect(sanitizeOvers('9.7', 6, {}, '9.')).toBe('9.')
    expect(sanitizeOvers('9.5', 6, {}, '9.')).toBe('9.5')
    expect(sanitizeOvers('9.7', 8, {}, '9.')).toBe('9.7')
  })

  it('takes one digit after the point and limits the overs', () => {
    expect(sanitizeOvers('9.45', 6)).toBe('9.4')
    expect(sanitizeOvers('1234', 6)).toBe('123')
    expect(sanitizeOvers('51', 6, { maxOvers: 50 }, '5')).toBe('5')
  })

  it('sanitises a paste', () => {
    expect(sanitizeOvers('-8.9jj', 6, {}, '')).toBe('')
    expect(sanitizeOvers(' 12.3 overs', 6)).toBe('12.3')
  })
})
