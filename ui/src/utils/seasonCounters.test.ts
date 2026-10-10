import { describe, expect, it } from 'vitest'
import { matchesSeasonFocus, seasonCounters } from './seasonCounters'

const TODAY = '2026-10-10'

function season(label: string, startDate: string, endDate: string, active = true) {
  return { label, startDate, endDate, active }
}

describe('seasonCounters', () => {
  it('counts each status and shows the current season label', () => {
    const result = seasonCounters(
      [
        season('2026/27', '2026-09-01', '2027-03-31'),
        season('2027/28', '2027-09-01', '2028-03-31'),
        season('2028/29', '2028-09-01', '2029-03-31'),
        season('2025/26', '2025-09-01', '2026-03-31'),
        season('2024/25', '2024-09-01', '2025-03-31'),
        season('2023/24', '2023-09-01', '2024-03-31'),
        season('Trial', '2026-01-01', '2026-12-31', false),
      ],
      TODAY,
    )

    expect(result).toEqual({ current: 1, currentLabel: '2026/27', upcoming: 2, past: 3, inactive: 1 })
  })

  it('shows None when no season is current', () => {
    expect(seasonCounters([season('2025/26', '2025-09-01', '2026-03-31')], TODAY)).toMatchObject({ current: 0, currentLabel: 'None', past: 1 })
    expect(seasonCounters([], TODAY)).toEqual({ current: 0, currentLabel: 'None', upcoming: 0, past: 0, inactive: 0 })
  })

  it('counts an inactive season as Inactive only, even when it contains today', () => {
    const result = seasonCounters([season('Trial', '2026-01-01', '2026-12-31', false)], TODAY)
    expect(result).toEqual({ current: 0, currentLabel: 'None', upcoming: 0, past: 0, inactive: 1 })
  })

  it('counts two seasons containing today as two current and names the first in list order with a +1', () => {
    const result = seasonCounters([season('2026', '2026-01-01', '2026-12-31'), season('2026/27', '2026-09-01', '2027-03-31')], TODAY)
    expect(result.current).toBe(2)
    expect(result.currentLabel).toBe('2026 +1')
  })

  it('counts a season ending or starting today as current', () => {
    expect(seasonCounters([season('a', '2026-04-01', TODAY)], TODAY).current).toBe(1)
    expect(seasonCounters([season('b', TODAY, '2027-03-31')], TODAY).current).toBe(1)
    expect(seasonCounters([season('c', '2026-10-11', '2027-03-31')], TODAY).upcoming).toBe(1)
    expect(seasonCounters([season('d', '2026-04-01', '2026-10-09')], TODAY).past).toBe(1)
  })
})

describe('matchesSeasonFocus', () => {
  const current = season('c', '2026-09-01', '2027-03-31')
  const upcoming = season('u', '2027-09-01', '2028-03-31')
  const past = season('p', '2025-09-01', '2026-03-31')
  const inactive = season('i', '2026-01-01', '2026-12-31', false)

  it('matches each season to exactly one focus', () => {
    const focuses = ['current', 'upcoming', 'past', 'inactive'] as const
    for (const item of [current, upcoming, past, inactive]) {
      expect(focuses.filter((focus) => matchesSeasonFocus(item, focus, TODAY))).toHaveLength(1)
    }
    expect(matchesSeasonFocus(current, 'current', TODAY)).toBe(true)
    expect(matchesSeasonFocus(upcoming, 'upcoming', TODAY)).toBe(true)
    expect(matchesSeasonFocus(past, 'past', TODAY)).toBe(true)
    expect(matchesSeasonFocus(inactive, 'inactive', TODAY)).toBe(true)
  })

  it('never matches an inactive season to Current', () => {
    expect(matchesSeasonFocus(inactive, 'current', TODAY)).toBe(false)
  })
})
