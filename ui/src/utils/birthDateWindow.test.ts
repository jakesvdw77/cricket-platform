import { describe, expect, it } from 'vitest'
import { birthDateWindow, birthDateWindowText, isOutsideWindow } from './birthDateWindow'

const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const TODAY = day('2026-11-13')
const under15 = { minAge: null, maxAge: 15 }

describe('birthDateWindow without a league', () => {
  it('Under 15: earliest is the day after today minus 15 years, latest is today', () => {
    expect(birthDateWindow({ section: under15, today: TODAY })).toMatchObject({ earliest: '2011-11-14', latest: '2026-11-13', cutoff: null })
  })
  it('minimum age only: no lower bound, latest is today minus the age', () => {
    expect(birthDateWindow({ section: { minAge: 40, maxAge: null }, today: TODAY })).toMatchObject({ earliest: null, latest: '1986-11-13' })
  })
  it('both limits', () => {
    expect(birthDateWindow({ section: { minAge: 12, maxAge: 15 }, today: TODAY })).toMatchObject({ earliest: '2011-11-14', latest: '2014-11-13' })
  })
  it('null without any limit, league or section', () => {
    expect(birthDateWindow({ section: { minAge: null, maxAge: null } })).toBeNull()
    expect(birthDateWindow({ section: null, league: null })).toBeNull()
    expect(birthDateWindow({ section: null, league: { minAge: null, maxAge: null, ageCutoffDate: '2026-09-01' } })).toBeNull()
  })
  it('handles 29 February', () => {
    expect(birthDateWindow({ section: under15, today: day('2028-02-29') })).toMatchObject({ earliest: '2013-03-01', latest: '2028-02-29' })
    expect(birthDateWindow({ section: { minAge: 4, maxAge: null }, today: day('2028-02-29') })?.latest).toBe('2024-02-29')
  })
})

describe('birthDateWindow with a league', () => {
  it('uses a cut-off in the past as the reference date', () => {
    const w = birthDateWindow({ section: under15, league: { minAge: null, maxAge: null, ageCutoffDate: '2026-09-01' }, today: TODAY })
    expect(w).toMatchObject({ earliest: '2011-09-02', latest: '2026-09-01', cutoff: '2026-09-01' })
  })
  it('clamps latest to today when the cut-off is in the future', () => {
    const w = birthDateWindow({ section: under15, league: { minAge: null, maxAge: null, ageCutoffDate: '2027-09-01' }, today: TODAY })
    expect(w).toMatchObject({ earliest: '2012-09-02', latest: '2026-11-13' })
  })
  it("the league's limits override the section's", () => {
    const w = birthDateWindow({ section: under15, league: { minAge: null, maxAge: 13, ageCutoffDate: '2026-09-01' }, today: TODAY })
    expect(w).toMatchObject({ earliest: '2013-09-02', maxAge: 13 })
  })
  it('a league with no limits falls back to the section limits', () => {
    const w = birthDateWindow({ section: under15, league: { minAge: null, maxAge: null, ageCutoffDate: null }, today: TODAY })
    expect(w).toMatchObject({ earliest: '2011-11-14', cutoff: null, maxAge: 15 })
  })
  it('a league minimum age is measured on the cut-off', () => {
    const w = birthDateWindow({ section: null, league: { minAge: 10, maxAge: null, ageCutoffDate: '2026-09-01' }, today: TODAY })
    expect(w).toMatchObject({ earliest: null, latest: '2016-09-01' })
  })
})

describe('birthDateWindowText and isOutsideWindow', () => {
  it('words the window, naming the cut-off only when it came from the league', () => {
    expect(birthDateWindowText(birthDateWindow({ section: under15, today: TODAY }) as never)).toBe('Under 15: born on or after 14 Nov 2011')
    expect(
      birthDateWindowText(birthDateWindow({ section: under15, league: { ageCutoffDate: '2026-09-01' }, today: TODAY }) as never),
    ).toBe('Under 15 on 1 Sep 2026: born on or after 2 Sep 2011')
    expect(birthDateWindowText(birthDateWindow({ section: { minAge: 40, maxAge: null }, today: TODAY }) as never)).toBe('40+: born on or before 13 Nov 1986')
    expect(birthDateWindowText(birthDateWindow({ section: { minAge: 12, maxAge: 15 }, today: TODAY }) as never)).toBe('12–15: born between 14 Nov 2011 and 13 Nov 2014')
  })
  it('flags a date outside it, never an empty one', () => {
    const w = birthDateWindow({ section: under15, today: TODAY }) as never
    expect(isOutsideWindow(w, '2011-11-13')).toBe(true)
    expect(isOutsideWindow(w, '2011-11-14')).toBe(false)
    expect(isOutsideWindow(w, '')).toBe(false)
  })
})
