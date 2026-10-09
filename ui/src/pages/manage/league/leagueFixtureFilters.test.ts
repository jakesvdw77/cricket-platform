import { describe, expect, it } from 'vitest'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import { filterFixtures, fixtureSideName, isOurMatch } from './leagueFixtureFilters'

const TODAY = new Date('2026-10-09T15:00:00')
const teamsById = new Map<string, Team>([['t1', { id: 't1', name: 'Villagers 1' } as Team]])

function match(overrides: Partial<Match>): Match {
  return {
    id: 'm',
    homeTeamId: null,
    homeTeamName: 'Home FC',
    awayTeamId: null,
    awayTeamName: 'Away FC',
    homeLeagueTeamId: null,
    awayLeagueTeamId: null,
    venue: null,
    matchDate: '2026-10-20T09:00:00',
    ...overrides,
  } as Match
}

const base = { teamId: null, search: '', onlyOurs: false, showPlayed: false, today: TODAY }

describe('filterFixtures', () => {
  const past = match({ id: 'past', matchDate: '2026-10-01T09:00:00' })
  const earlierToday = match({ id: 'today', matchDate: '2026-10-09T08:00:00' })
  const ours = match({ id: 'ours', homeTeamId: 't1', homeTeamName: null })
  const theirs = match({ id: 'theirs', homeLeagueTeamId: 'lt1', awayLeagueTeamId: 'lt2', venue: 'Riverside Oval' })
  const all = [past, earlierToday, ours, theirs]

  it('hides matches before today by default and keeps today\'s, and Show played brings the rest back', () => {
    expect(filterFixtures(all, base, teamsById).map((m) => m.id)).toEqual(['today', 'ours', 'theirs'])
    expect(filterFixtures(all, { ...base, showPlayed: true }, teamsById).map((m) => m.id)).toEqual(['past', 'today', 'ours', 'theirs'])
  })

  it('keeps only our matches', () => {
    expect(filterFixtures(all, { ...base, onlyOurs: true }, teamsById).map((m) => m.id)).toEqual(['ours'])
  })

  it('keeps matches that have the chosen club team or league team on either side', () => {
    expect(filterFixtures(all, { ...base, teamId: 't1' }, teamsById).map((m) => m.id)).toEqual(['ours'])
    expect(filterFixtures(all, { ...base, teamId: 'lt2' }, teamsById).map((m) => m.id)).toEqual(['theirs'])
  })

  it('searches both team names and the venue, case-insensitively', () => {
    expect(filterFixtures(all, { ...base, search: 'villagers' }, teamsById).map((m) => m.id)).toEqual(['ours'])
    expect(filterFixtures(all, { ...base, search: 'RIVERSIDE' }, teamsById).map((m) => m.id)).toEqual(['theirs'])
    expect(filterFixtures(all, { ...base, search: 'nothing' }, teamsById)).toEqual([])
  })

  it('combines the filters', () => {
    expect(filterFixtures(all, { ...base, onlyOurs: true, search: 'away' }, teamsById).map((m) => m.id)).toEqual(['ours'])
  })
})

describe('fixtureSideName and isOurMatch', () => {
  it('resolves a club team by id, falls back to the match name, TBC and Unknown team', () => {
    expect(fixtureSideName('t1', null, teamsById)).toBe('Villagers 1')
    expect(fixtureSideName('gone', null, teamsById)).toBe('Unknown team')
    expect(fixtureSideName(null, 'Away FC', teamsById)).toBe('Away FC')
    expect(fixtureSideName(null, null, teamsById)).toBe('TBC')
  })

  it('treats a match with either side being a club team as ours', () => {
    expect(isOurMatch({ homeTeamId: 't1', awayTeamId: null })).toBe(true)
    expect(isOurMatch({ homeTeamId: null, awayTeamId: 't1' })).toBe(true)
    expect(isOurMatch({ homeTeamId: null, awayTeamId: null })).toBe(false)
  })
})
