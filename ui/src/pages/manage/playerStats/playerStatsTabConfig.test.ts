import { describe, expect, it } from 'vitest'
import { PLAYER_STATS_TABS, resolvePlayerStatsTab } from './playerStatsTabConfig'

// docs/specs/115-player-match-list.md, "Where it lives": Matches is the last tab. docs/specs/117-stats-dashboard.md (decisions 11 and 13):
// Dashboard is the first tab and the landing tab.
describe('playerStatsTabConfig', () => {
  it('lists Dashboard first and Matches last, bound to "dashboard" and "matches"', () => {
    expect(PLAYER_STATS_TABS).toHaveLength(6)
    expect(PLAYER_STATS_TABS[0]).toEqual({ value: 'dashboard', label: 'Overview' })
    expect(PLAYER_STATS_TABS[5]).toEqual({ value: 'matches', label: 'Matches' })
  })

  it('resolves ?tab=dashboard and ?tab=matches and falls back to Dashboard for a missing or unknown value', () => {
    expect(resolvePlayerStatsTab('dashboard')).toBe('dashboard')
    expect(resolvePlayerStatsTab('matches')).toBe('matches')
    expect(resolvePlayerStatsTab('awards')).toBe('awards')
    expect(resolvePlayerStatsTab('batting')).toBe('batting')
    expect(resolvePlayerStatsTab('nonsense')).toBe('dashboard')
    expect(resolvePlayerStatsTab('Matches')).toBe('dashboard')
    expect(resolvePlayerStatsTab(null)).toBe('dashboard')
  })
})
