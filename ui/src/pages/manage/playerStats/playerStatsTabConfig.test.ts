import { describe, expect, it } from 'vitest'
import { PLAYER_STATS_TABS, resolvePlayerStatsTab } from './playerStatsTabConfig'

// docs/specs/115-player-match-list.md, "Where it lives": Matches is the fifth and last tab.
describe('playerStatsTabConfig', () => {
  it('lists Matches as the fifth and last tab, bound to "matches"', () => {
    expect(PLAYER_STATS_TABS).toHaveLength(5)
    expect(PLAYER_STATS_TABS[4]).toEqual({ value: 'matches', label: 'Matches' })
  })

  it('resolves ?tab=matches and falls back to Batting for a missing or unknown value', () => {
    expect(resolvePlayerStatsTab('matches')).toBe('matches')
    expect(resolvePlayerStatsTab('awards')).toBe('awards')
    expect(resolvePlayerStatsTab('nonsense')).toBe('batting')
    expect(resolvePlayerStatsTab('Matches')).toBe('batting')
    expect(resolvePlayerStatsTab(null)).toBe('batting')
  })
})
