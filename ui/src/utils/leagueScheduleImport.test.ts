import { describe, expect, it } from 'vitest'
import {
  buildLeagueScheduleScope,
  clampWindowDays,
  importScheduleDisabledReason,
  leagueAddMatchPath,
  leagueSchedulePath,
  leagueScheduleBackPath,
  leagueScheduleImportPath,
  leagueScheduleInvalidateKeys,
  leagueScheduleScopeKey,
  tidyTeamName,
} from './leagueScheduleImport'

describe('leagueScheduleImport', () => {
  it('builds the scope without the duplicate window (a decisions option)', () => {
    expect(buildLeagueScheduleScope({ leagueId: 'l1', seasonId: 's1', scopeMode: 'OURS_ONLY', templateScope: 'OURS_ONLY' })).toEqual({
      scopeMode: 'OURS_ONLY',
      templateScope: 'OURS_ONLY',
      params: { leagueId: 'l1', seasonId: 's1' },
    })
    expect(buildLeagueScheduleScope({ leagueId: 'l1', seasonId: 's1' }).params).toEqual({ leagueId: 'l1', seasonId: 's1' })
    expect(clampWindowDays(0)).toBe(1)
    expect(clampWindowDays(Number.NaN)).toBe(14)
  })

  it('names the scope key, routes and keys', () => {
    expect(leagueScheduleScopeKey('l1', 's1')).toBe('league:l1|season:s1')
    expect(leagueScheduleImportPath('l1', 's1')).toBe('/manage/fixtures/leagues/l1/schedule/import?seasonId=s1')
    expect(leagueScheduleImportPath('l1', 's1', 'view')).toContain('from=view')
    expect(leagueScheduleBackPath('l1', 's1')).toBe('/manage/fixtures/leagues/l1/schedule?seasonId=s1')
    expect(leagueScheduleBackPath('l1', 's1', 'view')).toBe('/manage/fixtures/leagues/l1/schedule?seasonId=s1')
    expect(leagueScheduleInvalidateKeys('c1', 'l1', 's1')).toEqual([
      ['managed-club', 'c1', 'leagues', 'l1', 'seasons', 's1', 'league-teams'],
      ['managed-club', 'c1', 'leagues', 'l1', 'matches', 's1'],
      ['managed-club', 'c1', 'matches'],
      ['managed-club', 'c1', 'leagues'],
    ])
  })

  it('gives the disabled reasons', () => {
    expect(importScheduleDisabledReason({ hasSeason: false, leagueActive: true })).toBe('Create a season first')
    expect(importScheduleDisabledReason({ hasSeason: true, leagueActive: false })).toBe('League is inactive')
    expect(importScheduleDisabledReason({ hasSeason: true, leagueActive: true })).toBeNull()
  })

  it('tidies a team name but keeps short capitals and numerals', () => {
    expect(tidyTeamName('PHSOB')).toBe('PHSOB')
    expect(tidyTeamName('PRETORIA HIGH SCHOOL')).toBe('Pretoria High School')
    expect(tidyTeamName('CBC U13')).toBe('CBC U13')
    expect(tidyTeamName('brits vets 1')).toBe('Brits Vets 1')
    expect(tidyTeamName('  HILTON   COLLEGE ')).toBe('Hilton College')
  })
})

describe('league page paths', () => {
  it('builds the league Schedule path, keeping the season when there is one', () => {
    expect(leagueSchedulePath('l1', 's1')).toBe('/manage/fixtures/leagues/l1/schedule?seasonId=s1')
    expect(leagueSchedulePath('l1', null)).toBe('/manage/fixtures/leagues/l1/schedule')
  })

  it('builds the Add match path with the league and the season', () => {
    expect(leagueAddMatchPath('l1', 's1')).toBe('/manage/fixtures/matches/new?leagueId=l1&seasonId=s1')
    expect(leagueAddMatchPath('l1', '')).toBe('/manage/fixtures/matches/new?leagueId=l1')
  })
})
