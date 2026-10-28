import { describe, expect, it } from 'vitest'
import { buildMyLeagueShareModel, leagueShareFileName } from './shareLeagueData'
import { conditions, leagueDto } from '../../test/hubLeagueFixtures'

// docs/specs/123 (Share) and 124: the Player Hub read becomes the same LeagueShareModel, with no contacts.
const build = (dto = leagueDto(), initialsOnly = false) => buildMyLeagueShareModel({ contents: ['SCHEDULE'], league: dto, clubName: 'Paarl CC', initialsOnly })

describe('buildMyLeagueShareModel', () => {
  it('flags own teams in the schedule and the team list, and puts them first in the teams', () => {
    const model = build()

    expect(model.schedule[0].home.own).toBe(true)
    expect(model.schedule[0].away.own).toBe(false)
    expect(model.teams.map((t) => [t.name, t.own])).toEqual([['Paarl U15', true], ['Wellington U15', false]])
  })

  it('never carries contacts, phone or email', () => {
    const model = build()

    expect(model.league.contacts).toEqual([])
    expect(model.league.phone).toBeNull()
    expect(model.league.email).toBeNull()
    expect(model.includeContact).toBe(false)
  })

  it('forces initials for a junior league (maxAge 18 or below) and respects the choice otherwise', () => {
    expect(build().initialsOnly).toBe(true)
    const adult = leagueDto()
    adult.league.maxAge = 40
    expect(build(adult, false).junior.junior).toBe(false)
    expect(build(adult, false).initialsOnly).toBe(false)
    expect(build(adult, true).initialsOnly).toBe(true)
  })

  it('fails safe to initials for a league with no age cap', () => {
    const open = leagueDto()
    open.league.maxAge = null
    expect(build(open, false).initialsOnly).toBe(true)
  })

  it('titles the share with the league and season, and the file name drops forbidden characters', () => {
    const model = build()
    expect(model.title).toBe('Boland Under 15 2026/27')
    expect(model.season.label).toBe('2026/27')
    expect(leagueShareFileName(model, 'png')).toBe('Boland Under 15 202627.png')
  })

  it('includes balls per over and the free hit in the conditions rows (spec 124)', () => {
    const rows = (dto = leagueDto()) => build(dto).conditions.flatMap((section) => section.rows ?? []).map((row) => [row.label, row.value])

    expect(rows()).toEqual(expect.arrayContaining([['Balls per over', 'No limit'], ['Free hit after a no ball', 'Yes']]))
    expect(rows(leagueDto({ playingConditions: conditions({ maxBallsPerOver: 8, freeHitOnNoBall: false }) }))).toEqual(
      expect.arrayContaining([['Balls per over', 'At most 8, wides and no balls included'], ['Free hit after a no ball', 'No']]),
    )
  })
})
