import { describe, expect, it } from 'vitest'
import type { League } from '../../../api/leagueApi'
import { leagueBadges } from './leagueBadges'

function league(overrides: Partial<League> = {}): League {
  return { id: 'l1', name: 'TVL', active: true, format: null, ...overrides } as League
}

describe('leagueBadges', () => {
  it('orders format, team count, season, then Active', () => {
    expect(leagueBadges(league({ format: 'T20' }), { teamCount: 8, seasonLabel: '2026/27' })).toEqual([
      { label: 'T20', tone: 'format' },
      { label: '8 teams', tone: 'side' },
      { label: '2026/27', tone: 'season' },
      { label: 'Active', tone: 'active' },
    ])
  })

  it('omits the format badge when the league has no format', () => {
    expect(leagueBadges(league(), { teamCount: 2 }).map((b) => b.label)).toEqual(['2 teams', 'Active'])
  })

  it('omits the season badge when no season label is passed', () => {
    expect(leagueBadges(league({ format: 'ONE_DAY' }), { teamCount: 3 }).map((b) => b.label)).toEqual([
      '1 Day',
      '3 teams',
      'Active',
    ])
  })

  it('uses the singular for one team and zero teams plural', () => {
    expect(leagueBadges(league(), { teamCount: 1 })[0].label).toBe('1 team')
    expect(leagueBadges(league(), { teamCount: 0 })[0].label).toBe('0 teams')
  })

  it('shows Inactive with the muted tone for an inactive league', () => {
    expect(leagueBadges(league({ active: false }), { teamCount: 1 }).at(-1)).toEqual({ label: 'Inactive', tone: 'muted' })
  })
})
