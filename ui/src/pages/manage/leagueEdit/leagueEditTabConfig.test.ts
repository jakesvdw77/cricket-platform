import { describe, expect, it } from 'vitest'
import { editTabForView, resolveLeagueEditTab } from './leagueEditTabConfig'

describe('editTabForView', () => {
  it.each(['schedule', 'teams', 'conditions'])('maps the %s view to the tab of the same name', (view) => {
    expect(editTabForView(view)).toBe(view)
    expect(resolveLeagueEditTab(editTabForView(view))).toBe(view)
  })

  it('maps an unknown or missing view to no tab, which opens Details', () => {
    expect(editTabForView('contacts')).toBeNull()
    expect(editTabForView('nonsense')).toBeNull()
    expect(editTabForView(undefined)).toBeNull()
    expect(resolveLeagueEditTab(editTabForView('nonsense'))).toBe('details')
  })
})
