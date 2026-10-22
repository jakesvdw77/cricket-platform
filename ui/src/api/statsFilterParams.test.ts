import { describe, expect, it } from 'vitest'
import { statsFilterParams } from './statsFilterParams'

describe('statsFilterParams', () => {
  it('sends only the filters that are set', () => {
    expect(statsFilterParams({ seasonId: 's1', leagueId: null, teamId: undefined, competition: 'LEAGUE' })).toEqual({ seasonId: 's1', competition: 'LEAGUE' })
  })

  it('sends nothing for no filters, and drops empty strings', () => {
    expect(statsFilterParams({})).toEqual({})
    expect(statsFilterParams({ seasonId: '' })).toEqual({})
  })
})
