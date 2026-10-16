import { describe, expect, it } from 'vitest'
import { birthDateWindow, birthDateWindowText, isOutsideWindow } from './birthDateWindow'

const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

describe('birthDateWindow', () => {
  it('Under 15: earliest is the day after today minus 15 years, latest is today', () => {
    expect(birthDateWindow({ minAge: null, maxAge: 15 }, day('2026-11-13'))).toEqual({ earliest: '2011-11-14', latest: '2026-11-13' })
  })
  it('minimum age only: no lower bound, latest is today minus the age', () => {
    expect(birthDateWindow({ minAge: 40, maxAge: null }, day('2026-11-13'))).toEqual({ earliest: null, latest: '1986-11-13' })
  })
  it('both limits', () => {
    expect(birthDateWindow({ minAge: 12, maxAge: 15 }, day('2026-11-13'))).toEqual({ earliest: '2011-11-14', latest: '2014-11-13' })
  })
  it('null without any limit or section', () => {
    expect(birthDateWindow({ minAge: null, maxAge: null })).toBeNull()
    expect(birthDateWindow(null)).toBeNull()
  })
  it('handles 29 February', () => {
    expect(birthDateWindow({ minAge: null, maxAge: 15 }, day('2028-02-29'))).toEqual({ earliest: '2013-03-01', latest: '2028-02-29' })
    expect(birthDateWindow({ minAge: 4, maxAge: null }, day('2028-02-29'))?.latest).toBe('2024-02-29')
  })
})

describe('birthDateWindowText and isOutsideWindow', () => {
  const w = { earliest: '2011-11-14', latest: '2026-11-13' }
  it('words the window', () => {
    expect(birthDateWindowText({ minAge: null, maxAge: 15 }, w)).toBe('Under 15: born on or after 14 Nov 2011')
    expect(birthDateWindowText({ minAge: 40, maxAge: null }, { earliest: null, latest: '1986-11-13' })).toBe('40+: born on or before 13 Nov 1986')
    expect(birthDateWindowText({ minAge: 12, maxAge: 15 }, w)).toBe('12–15: born between 14 Nov 2011 and 13 Nov 2026')
  })
  it('flags a date outside it, never an empty one', () => {
    expect(isOutsideWindow(w, '2011-11-13')).toBe(true)
    expect(isOutsideWindow(w, '2011-11-14')).toBe(false)
    expect(isOutsideWindow(w, '')).toBe(false)
  })
})
