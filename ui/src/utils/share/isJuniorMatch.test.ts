import { describe, expect, it } from 'vitest'
import { isJuniorMatch, JUNIOR_MAX_AGE } from './isJuniorMatch'

const section = (id: string, name: string, parentSectionId: string | null, maxAge: number | null = null) => ({
  id,
  name,
  parentSectionId,
  maxAge,
})
const sections = [
  section('j', 'Juniors', null),
  section('u13', 'U13', 'j'),
  section('s', 'Seniors', null),
  section('u15', 'U15', 's', 15),
]

describe('isJuniorMatch', () => {
  it('uses the league maxAge first', () => {
    expect(JUNIOR_MAX_AGE).toBe(18)
    const teams = [{ sectionId: 's' }]
    expect(isJuniorMatch({ league: { maxAge: 18 }, sections, teams })).toEqual({ junior: true, reason: 'LEAGUE_MAX_AGE' })
    expect(isJuniorMatch({ league: { maxAge: 19 }, sections, teams }).junior).toBe(false)
    expect(isJuniorMatch({ league: { maxAge: 40 }, sections, teams: [{ sectionId: 'u13' }] }).junior).toBe(false)
  })

  it('falls back to the section maxAge for a friendly or an uncapped league', () => {
    expect(isJuniorMatch({ league: null, sections, teams: [{ sectionId: 'u15' }] })).toEqual({
      junior: true,
      reason: 'SECTION_MAX_AGE',
    })
    expect(isJuniorMatch({ league: { maxAge: null }, sections, teams: [{ sectionId: 's' }] }).junior).toBe(false)
  })

  it('uses the Juniors name only when there is no age data', () => {
    expect(isJuniorMatch({ league: null, sections, teams: [{ sectionId: 'u13' }] })).toEqual({
      junior: true,
      reason: 'SECTION_NAME',
    })
    const aged = [section('j', 'Juniors', null, 25), section('u13', 'U13', 'j')]
    expect(isJuniorMatch({ league: null, sections: aged, teams: [{ sectionId: 'u13' }] }).junior).toBe(false)
  })

  it('is junior in a derby when either side qualifies', () => {
    expect(isJuniorMatch({ league: null, sections, teams: [{ sectionId: 's' }, { sectionId: 'u15' }] }).junior).toBe(true)
  })

  it('fails safe when the data could not be loaded', () => {
    const teams = [{ sectionId: 's' }]
    expect(isJuniorMatch({ league: undefined, sections, teams })).toEqual({ junior: true, reason: 'UNAVAILABLE' })
    expect(isJuniorMatch({ league: null, sections: undefined, teams })).toEqual({ junior: true, reason: 'UNAVAILABLE' })
  })
})

describe('isJuniorMatch rules in detail', () => {
  const adultTeams = [{ sectionId: 's' }]
  const juniorTeams = [{ sectionId: 'u13' }]

  it('treats a league maxAge of 17 and 18 as junior and 19 as adult (the threshold is exact)', () => {
    expect(isJuniorMatch({ league: { maxAge: 17 }, sections, teams: adultTeams })).toEqual({ junior: true, reason: 'LEAGUE_MAX_AGE' })
    expect(isJuniorMatch({ league: { maxAge: 18 }, sections, teams: adultTeams })).toEqual({ junior: true, reason: 'LEAGUE_MAX_AGE' })
    expect(isJuniorMatch({ league: { maxAge: 19 }, sections, teams: adultTeams })).toEqual({ junior: false, reason: null })
  })

  it('lets rule 1 beat the others: an adult league wins over a Juniors section and over a young section maxAge', () => {
    const young = [section('j', 'Juniors', null, 12), section('u13', 'U13', 'j', 13)]
    expect(isJuniorMatch({ league: { maxAge: 40 }, sections: young, teams: juniorTeams })).toEqual({ junior: false, reason: null })
    expect(isJuniorMatch({ league: { maxAge: 19 }, sections, teams: juniorTeams }).junior).toBe(false)
  })

  it('lets a junior league decide even when the team sits under an adult section', () => {
    expect(isJuniorMatch({ league: { maxAge: 13 }, sections, teams: adultTeams }).reason).toBe('LEAGUE_MAX_AGE')
  })

  it('applies the section maxAge for a friendly (null league) at 18 but not 19', () => {
    const at18 = [section('a', 'Colts', null, 18)]
    const at19 = [section('a', 'Colts', null, 19)]
    expect(isJuniorMatch({ league: null, sections: at18, teams: [{ sectionId: 'a' }] })).toEqual({ junior: true, reason: 'SECTION_MAX_AGE' })
    expect(isJuniorMatch({ league: null, sections: at19, teams: [{ sectionId: 'a' }] })).toEqual({ junior: false, reason: null })
  })

  it('reads a maxAge from an ancestor of the team section', () => {
    const tree = [section('j', 'Boys', null, 15), section('u13', 'Group', 'j'), section('x', 'Squad', 'u13')]
    expect(isJuniorMatch({ league: null, sections: tree, teams: [{ sectionId: 'x' }] })).toEqual({ junior: true, reason: 'SECTION_MAX_AGE' })
  })

  it('applies the section rule to a league with no maxAge as well as to a friendly', () => {
    expect(isJuniorMatch({ league: { maxAge: undefined }, sections, teams: [{ sectionId: 'u15' }] }).reason).toBe('SECTION_MAX_AGE')
  })

  it('uses the Juniors name case-insensitively and exactly, and only without any age data', () => {
    const named = (name: string) => [section('j', name, null), section('u13', 'U13', 'j')]
    expect(isJuniorMatch({ league: null, sections: named('JUNIORS'), teams: juniorTeams }).reason).toBe('SECTION_NAME')
    expect(isJuniorMatch({ league: null, sections: named(' juniors '), teams: juniorTeams }).reason).toBe('SECTION_NAME')
    expect(isJuniorMatch({ league: null, sections: named('Junior'), teams: juniorTeams }).junior).toBe(false)
    expect(isJuniorMatch({ league: null, sections: named('Juniors Cricket'), teams: juniorTeams }).junior).toBe(false)
  })

  it('does not fall back to the Juniors name when an adult age is recorded on another section of the path', () => {
    const tree = [section('j', 'Juniors', null), section('u13', 'U13', 'j', 30)]
    expect(isJuniorMatch({ league: null, sections: tree, teams: [{ sectionId: 'u13' }] }).junior).toBe(false)
  })

  it('does not fall back to the Juniors name for a league that has a maxAge, even an adult one', () => {
    expect(isJuniorMatch({ league: { maxAge: 25 }, sections, teams: juniorTeams }).junior).toBe(false)
  })

  it('is junior in a derby when only one side qualifies, in either order, and adult when neither does', () => {
    expect(isJuniorMatch({ league: null, sections, teams: [{ sectionId: 'u15' }, { sectionId: 's' }] }).junior).toBe(true)
    expect(isJuniorMatch({ league: null, sections, teams: [{ sectionId: 's' }, { sectionId: 'u13' }] }).junior).toBe(true)
    expect(isJuniorMatch({ league: null, sections, teams: [{ sectionId: 's' }, { sectionId: 's' }] }).junior).toBe(false)
  })

  it('is adult when the team has no section or the section is unknown and nothing else says junior', () => {
    expect(isJuniorMatch({ league: null, sections, teams: [{ sectionId: null }] }).junior).toBe(false)
    expect(isJuniorMatch({ league: null, sections, teams: [{ sectionId: 'nope' }] }).junior).toBe(false)
    expect(isJuniorMatch({ league: null, sections, teams: [] }).junior).toBe(false)
  })

  it('cannot hang on a loop in the section tree', () => {
    const loop = [section('a', 'A', 'b'), section('b', 'B', 'a')]
    expect(isJuniorMatch({ league: null, sections: loop, teams: [{ sectionId: 'a' }] }).junior).toBe(false)
  })

  it('fails safe to junior when the league or the sections are unavailable, even with an adult league', () => {
    expect(isJuniorMatch({ league: undefined, sections: undefined, teams: [] })).toEqual({ junior: true, reason: 'UNAVAILABLE' })
    expect(isJuniorMatch({ league: { maxAge: 40 }, sections: undefined, teams: adultTeams }).reason).toBe('UNAVAILABLE')
    expect(isJuniorMatch({ league: undefined, sections, teams: adultTeams }).reason).toBe('UNAVAILABLE')
  })

  it('keeps null (a friendly) distinct from undefined (could not load)', () => {
    expect(isJuniorMatch({ league: null, sections, teams: adultTeams }).junior).toBe(false)
    expect(isJuniorMatch({ league: undefined, sections, teams: adultTeams }).junior).toBe(true)
  })
})
