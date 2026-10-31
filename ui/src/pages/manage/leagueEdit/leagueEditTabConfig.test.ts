import { describe, expect, it } from 'vitest'
import { LEAGUE_EDIT_TABS, editTabForView, resolveLeagueEditTab } from './leagueEditTabConfig'

describe('leagueEditTabConfig (docs/specs/128)', () => {
  it('has the four tabs in order', () => {
    expect(LEAGUE_EDIT_TABS.map((tab) => tab.label)).toEqual(['Details', 'Branding', 'Playing Conditions', 'Contacts'])
  })

  it.each(['teams', 'schedule', 'nonsense', null])('opens Details for the stale or unknown tab %s', (value) => {
    expect(resolveLeagueEditTab(value)).toBe('details')
  })

  it('maps the conditions view to the Playing Conditions tab', () => {
    expect(editTabForView('conditions')).toBe('conditions')
    expect(resolveLeagueEditTab(editTabForView('conditions'))).toBe('conditions')
  })

  it('maps the schedule and teams views and any unknown view to no tab, which opens Details', () => {
    expect(editTabForView('schedule')).toBeNull()
    expect(editTabForView('teams')).toBeNull()
    expect(editTabForView('contacts')).toBeNull()
    expect(editTabForView('nonsense')).toBeNull()
    expect(editTabForView(undefined)).toBeNull()
  })
})
