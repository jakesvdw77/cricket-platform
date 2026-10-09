import { describe, expect, it } from 'vitest'
import type { League } from '../../../api/leagueApi'
import { leagueBadges } from './leagueBadges'

function league(overrides: Partial<League> = {}): League {
  return { id: 'l1', name: 'TVL', active: true, format: null, ...overrides } as League
}

describe('leagueBadges', () => {
  it('orders the format, then Active', () => {
    expect(leagueBadges(league({ format: 'T20' }))).toEqual([
      { label: 'T20', tone: 'format' },
      { label: 'Active', tone: 'active' },
    ])
  })

  it('omits the format badge when the league has no format', () => {
    expect(leagueBadges(league()).map((b) => b.label)).toEqual(['Active'])
  })

  it('shows Inactive with the muted tone for an inactive league', () => {
    expect(leagueBadges(league({ active: false })).at(-1)).toEqual({ label: 'Inactive', tone: 'muted' })
  })
})
