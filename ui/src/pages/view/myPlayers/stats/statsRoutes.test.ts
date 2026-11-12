import { describe, expect, it } from 'vitest'
import { STATS_ORIGIN, TEAM_STATS_ORIGIN, myStatsPath, scopeFromSearch, statsDrillPath, statsResultPath, statsScopeQuery, teamStatsPath, teamStatsResultPath } from './statsRoutes'

const BASE = '/account/players/k1'

describe('statsScopeQuery', () => {
  it('writes the season even when it is All, as `all`, and only the filters that are set', () => {
    expect(statsScopeQuery({ seasonId: null, teamId: null, leagueId: null, competition: null })).toBe('season=all')
    expect(statsScopeQuery({ seasonId: 's1', teamId: 't1', leagueId: 'l1', competition: 'LEAGUE' })).toBe('season=s1&team=t1&league=l1&competition=LEAGUE')
  })
})

describe('scopeFromSearch', () => {
  it('reads the scope back, treating an absent or `all` season as All Seasons', () => {
    expect(scopeFromSearch(new URLSearchParams('season=all'))).toEqual({ seasonId: null, teamId: null, leagueId: null, competition: null })
    expect(scopeFromSearch(new URLSearchParams(''))).toEqual({ seasonId: null, teamId: null, leagueId: null, competition: null })
    expect(scopeFromSearch(new URLSearchParams('season=s1&team=t1&league=l1&competition=FRIENDLY'))).toEqual({ seasonId: 's1', teamId: 't1', leagueId: 'l1', competition: 'FRIENDLY' })
  })

  it('ignores an unknown competition value', () => {
    expect(scopeFromSearch(new URLSearchParams('competition=NONSENSE')).competition).toBeNull()
  })
})

describe('paths', () => {
  it('builds the My stats and Team stats pages with and without a scope', () => {
    expect(myStatsPath('k1')).toBe(`${BASE}/stats/mine`)
    expect(myStatsPath('k1', 'season=s1')).toBe(`${BASE}/stats/mine?season=s1`)
    expect(teamStatsPath('k1', 'season=s1&team=t1')).toBe(`${BASE}/stats/teams?season=s1&team=t1`)
  })

  it('carries the origin on a result page so the footer Back returns to the same stats page', () => {
    expect(statsResultPath('k1', 'm1', 'season=s1')).toBe(`${BASE}/results/m1?season=s1&origin=${STATS_ORIGIN}`)
    expect(teamStatsResultPath('k1', 'm1', 'season=s1&team=t1')).toBe(`${BASE}/results/m1?season=s1&team=t1&origin=${TEAM_STATS_ORIGIN}`)
  })

  it('builds the drill address from the server tokens plus the scope', () => {
    const path = statsDrillPath('k1', { kind: 'BATTING', filter: '50+', label: 'Scores of 50 or more' }, 'season=s1')
    expect(path.startsWith(`${BASE}/stats/mine/innings?`)).toBe(true)
    const query = new URLSearchParams(path.split('?')[1])
    expect(query.get('kind')).toBe('BATTING')
    expect(query.get('filter')).toBe('50+')
    expect(query.get('season')).toBe('s1')
    expect(new URLSearchParams(statsDrillPath('k1', { kind: 'MATCHES', label: 'Matches' }, 'season=all').split('?')[1]).has('filter')).toBe(false)
  })
})
