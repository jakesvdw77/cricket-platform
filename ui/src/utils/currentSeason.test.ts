import { describe, expect, it } from 'vitest'
import { currentSeasonId } from './currentSeason'

const season = (id: string, startDate: string, endDate: string, active = true) => ({ id, startDate, endDate, active })
const today = new Date(2026, 9, 16)

describe('currentSeasonId', () => {
  it('picks the active season containing today', () => {
    expect(currentSeasonId([season('old', '2025-09-01', '2026-07-31'), season('now', '2026-09-01', '2027-07-31')], today)).toBe('now')
  })

  it('includes the first and last day', () => {
    expect(currentSeasonId([season('a', '2026-10-16', '2026-12-01')], today)).toBe('a')
    expect(currentSeasonId([season('a', '2026-01-01', '2026-10-16')], today)).toBe('a')
  })

  it('picks the one that started latest when several contain today', () => {
    expect(currentSeasonId([season('wide', '2026-01-01', '2027-12-31'), season('late', '2026-10-01', '2027-03-31')], today)).toBe('late')
  })

  it('between seasons, picks the one starting soonest after today', () => {
    expect(
      currentSeasonId([season('past', '2025-09-01', '2026-07-31'), season('far', '2027-09-01', '2028-07-31'), season('next', '2026-11-01', '2027-03-31')], today),
    ).toBe('next')
  })

  it('with nothing current or upcoming, picks the most recently ended', () => {
    expect(currentSeasonId([season('older', '2023-09-01', '2024-07-31'), season('recent', '2024-09-01', '2025-07-31')], today)).toBe('recent')
  })

  it('ignores inactive seasons', () => {
    expect(currentSeasonId([season('off', '2026-09-01', '2027-07-31', false), season('on', '2025-09-01', '2026-07-31')], today)).toBe('on')
  })

  it('is null with no active seasons', () => {
    expect(currentSeasonId([], today)).toBeNull()
    expect(currentSeasonId([season('off', '2026-09-01', '2027-07-31', false)], today)).toBeNull()
  })
})
