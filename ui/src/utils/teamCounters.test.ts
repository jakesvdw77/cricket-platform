import { describe, expect, it } from 'vitest'
import { matchesTeamFocus, teamCounters } from './teamCounters'
import type { Team } from '../api/teamApi'
import type { TeamCardData } from '../hooks/useTeamCardData'

function team(id: string, active = true): Team {
  return {
    id,
    clubId: 'c',
    sectionId: 's',
    name: id,
    logoUrl: null,
    abbreviation: null,
    groundName: null,
    socialLinks: [],
    active,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
  }
}

function data(overrides: Partial<TeamCardData> = {}): TeamCardData {
  return {
    captainName: 'Jane Smith',
    managerName: null,
    coachName: null,
    playerCount: 12,
    matchCount: 5,
    matchesThisWeek: 1,
    loaded: true,
    sponsors: [],
    ...overrides,
  }
}

describe('teamCounters', () => {
  it('sums players and this-week matches and counts active, no-captain and empty-squad teams', () => {
    const teams = [team('a'), team('b'), team('c'), team('d', false)]
    const result = teamCounters(teams, {
      a: data(),
      b: data({ captainName: null, playerCount: 9, matchesThisWeek: 0 }),
      c: data({ captainName: null, playerCount: 0, matchesThisWeek: 2 }),
      d: data({ captainName: null, playerCount: 0 }),
    })

    expect(result).toEqual({ active: 3, players: 21, matchesThisWeek: 4, noCaptain: 2, emptySquads: 1, loaded: true })
  })

  it('is not loaded while any shown team has no data yet, and counts nothing from it', () => {
    const result = teamCounters([team('a'), team('b')], { a: data(), b: data({ loaded: false, playerCount: 0 }) })

    expect(result.loaded).toBe(false)
    expect(result.players).toBe(12)
    expect(result.emptySquads).toBe(0)
  })

  it('is all zeros and loaded for no teams', () => {
    expect(teamCounters([], {})).toEqual({ active: 0, players: 0, matchesThisWeek: 0, noCaptain: 0, emptySquads: 0, loaded: true })
  })
})

describe('matchesTeamFocus', () => {
  it('active matches active teams only', () => {
    expect(matchesTeamFocus(team('a'), data(), 'active')).toBe(true)
    expect(matchesTeamFocus(team('a', false), data(), 'active')).toBe(false)
  })

  it('no-captain and empty match active, loaded teams with the condition only', () => {
    expect(matchesTeamFocus(team('a'), data({ captainName: null }), 'no-captain')).toBe(true)
    expect(matchesTeamFocus(team('a'), data(), 'no-captain')).toBe(false)
    expect(matchesTeamFocus(team('a', false), data({ captainName: null }), 'no-captain')).toBe(false)
    expect(matchesTeamFocus(team('a'), data({ loaded: false, captainName: null }), 'no-captain')).toBe(false)
    expect(matchesTeamFocus(team('a'), data({ playerCount: 0 }), 'empty')).toBe(true)
    expect(matchesTeamFocus(team('a'), data(), 'empty')).toBe(false)
    expect(matchesTeamFocus(team('a'), undefined, 'empty')).toBe(false)
  })
})
