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
