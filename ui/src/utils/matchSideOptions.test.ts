import { describe, expect, it } from 'vitest'
import { buildLeagueSideOptions, excludeOtherSide, isSameTeam, normaliseTeamName } from './matchSideOptions'

const team = (id: string, name: string, active = true) => ({ id, name, active })

describe('matchSideOptions', () => {
  it('normalises names by trimming, collapsing spaces and ignoring case', () => {
    expect(normaliseTeamName('  Riverside   CC ')).toBe('riverside cc')
  })

  it('compares by own id, league team id or name', () => {
    expect(isSameTeam({ teamId: 'a' }, { teamId: 'a' })).toBe(true)
    expect(isSameTeam({ leagueTeamId: 'x' }, { leagueTeamId: 'x' })).toBe(true)
    expect(isSameTeam({ name: 'Riverside  CC' }, { name: ' riverside cc' })).toBe(true)
    expect(isSameTeam({ teamId: 'a', name: 'A' }, { leagueTeamId: 'x', name: 'a' })).toBe(true)
    expect(isSameTeam({ teamId: 'a', name: 'A' }, { teamId: 'b', name: 'B' })).toBe(false)
    expect(isSameTeam({ name: '' }, { name: '' })).toBe(false)
  })

  it('excludes the other side but keeps the current pick', () => {
    const options = [team('a', 'A'), team('b', 'B')]
    expect(excludeOtherSide(options, { teamId: 'a', name: 'A' }, 'team')).toEqual([team('b', 'B')])
    expect(excludeOtherSide(options, { teamId: 'a', name: 'A' }, 'team', 'a')).toEqual(options)
    expect(excludeOtherSide(options, null, 'team')).toEqual(options)
  })

  it('builds the league list: affiliated own teams, de-duplicated league teams, no other side', () => {
    const own = [team('t1', '1st XI'), team('t2', '2nd XI'), team('t3', 'Old', false)]
    const league = [team('l1', 'Brits'), team('l2', '1st xi'), team('l3', 'Gone', false), team('l4', 'Laudium')]
    const result = buildLeagueSideOptions(own, new Set(['t1']), league, { leagueTeamId: 'l4', name: 'Laudium' })
    expect(result.own.map((t) => t.id)).toEqual(['t1'])
    expect(result.league.map((t) => t.id)).toEqual(['l1'])
  })

  it('falls back to every active own team when none is affiliated', () => {
    const own = [team('t1', '1st XI'), team('t2', '2nd XI'), team('t3', 'Old', false)]
    expect(buildLeagueSideOptions(own, new Set(), [], null).own.map((t) => t.id)).toEqual(['t1', 't2'])
  })

  it('excludes a league team named like the other side\'s own team', () => {
    const result = buildLeagueSideOptions([], null, [team('l1', 'Brits'), team('l2', 'Laudium')], { teamId: 't9', name: 'brits' })
    expect(result.league.map((t) => t.id)).toEqual(['l2'])
  })
})
