import { describe, expect, it } from 'vitest'
import type { ImportedResult } from '../../../../api/resultImportApi'
import { checksSentence, dateMismatch, fileDateTime, fileResultLine, fileSourceLine, fileTeamsLine, matchPrefill, resolvedSentence } from './importSummary'

const teams = [
  { key: 'a', name: 'Northgate Strollers' },
  { key: 'b', name: 'Riverside Occasionals' },
]

// A match's instant at local noon on a calendar day, so the test holds in any time zone the machine runs in.
const matchOn = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12, 0).toISOString()
const fileOn = (date?: string): ImportedResult => ({ match: date === undefined ? {} : { date }, teams })

describe('dateMismatch', () => {
  it('is null when the file carries no date, or one that cannot be read', () => {
    expect(dateMismatch(fileOn(), matchOn(2026, 10, 11))).toBeNull()
    expect(dateMismatch(fileOn('11/10/2026'), matchOn(2026, 10, 11))).toBeNull()
  })

  it('is null for the same day and for one day apart either way (a late finish, a timezone shift)', () => {
    expect(dateMismatch(fileOn('2026-10-11'), matchOn(2026, 10, 11))).toBeNull()
    expect(dateMismatch(fileOn('2026-10-11'), matchOn(2026, 10, 12))).toBeNull()
    expect(dateMismatch(fileOn('2026-10-12'), matchOn(2026, 10, 11))).toBeNull()
  })

  it('reports both days in words when more than a day apart', () => {
    expect(dateMismatch(fileOn('2026-10-11'), matchOn(2026, 10, 14))).toEqual({ fileDay: '11 Oct 2026', matchDay: '14 Oct 2026' })
  })

  it('counts calendar days across a month boundary', () => {
    expect(dateMismatch(fileOn('2026-10-31'), matchOn(2026, 11, 1))).toBeNull()
    expect(dateMismatch(fileOn('2026-10-31'), matchOn(2026, 11, 2))).not.toBeNull()
    expect(dateMismatch(fileOn('2027-01-01'), matchOn(2026, 12, 31))).toBeNull()
  })

  it('is not thrown by a daylight-saving change between the two days', () => {
    // Late March and late October contain a clock change in most zones; whole calendar days are compared, never hours.
    expect(dateMismatch(fileOn('2026-03-28'), matchOn(2026, 3, 29))).toBeNull()
    expect(dateMismatch(fileOn('2026-03-29'), matchOn(2026, 3, 30))).toBeNull()
    expect(dateMismatch(fileOn('2026-03-28'), matchOn(2026, 3, 30))).not.toBeNull()
    expect(dateMismatch(fileOn('2026-10-25'), matchOn(2026, 10, 26))).toBeNull()
    expect(dateMismatch(fileOn('2026-10-24'), matchOn(2026, 10, 26))).not.toBeNull()
  })

  it('is null for a match date that is not a date', () => {
    expect(dateMismatch(fileOn('2026-10-11'), 'not a date')).toBeNull()
  })
})

describe('file lines', () => {
  it('words the date and start time as written, with no date giving null', () => {
    expect(fileDateTime({ match: { date: '2026-10-11', startTime: '13:00' } })).toBe('11 Oct 2026, 13:00')
    expect(fileDateTime({ match: { date: '2026-10-05' } })).toBe('5 Oct 2026')
    expect(fileDateTime({ match: {} })).toBeNull()
  })

  it('words the teams and the source', () => {
    expect(fileTeamsLine({ teams })).toBe('Northgate Strollers v Riverside Occasionals')
    expect(fileTeamsLine({ teams: [teams[0]] })).toBeNull()
    expect(fileSourceLine({ source: { provider: 'ACMESCORE', externalMatchId: '1234' } })).toBe('ACMESCORE, 1234')
    expect(fileSourceLine({ source: { provider: 'ACMESCORE' } })).toBe('ACMESCORE')
    expect(fileSourceLine({})).toBeNull()
  })

  it('words the result, singular and plural', () => {
    const won = (value: number, type: 'RUNS' | 'WICKETS'): ImportedResult => ({ teams, result: { outcome: 'WON', winner: 'b', margin: { type, value } } })
    expect(fileResultLine(won(8, 'WICKETS'))).toBe('Riverside Occasionals won by 8 wickets')
    expect(fileResultLine(won(1, 'WICKETS'))).toBe('Riverside Occasionals won by 1 wicket')
    expect(fileResultLine(won(1, 'RUNS'))).toBe('Riverside Occasionals won by 1 run')
    expect(fileResultLine({ teams, result: { outcome: 'WON', winner: 'a' } })).toBe('Northgate Strollers won')
    expect(fileResultLine({ teams, result: { outcome: 'TIE' } })).toBe('Match tied')
    expect(fileResultLine({ teams })).toBeNull()
  })
})

describe('matchPrefill', () => {
  it('prefills only what the file says: date and time as written, venue and both team names as text', () => {
    const values = matchPrefill({ match: { date: '2026-10-11', startTime: '13:00', venue: ' Main Oval ' }, teams })
    expect(values.homeTeamName).toBe('Northgate Strollers')
    expect(values.awayTeamName).toBe('Riverside Occasionals')
    expect(values.venue).toBe('Main Oval')
    expect(new Date(values.matchDate as string).getHours()).toBe(13)
  })

  it('reads a missing start time as midnight and sets nothing for a missing date, venue or team pair', () => {
    expect(new Date(matchPrefill({ match: { date: '2026-10-11' } }).matchDate as string).getHours()).toBe(0)
    expect(matchPrefill({ teams: [teams[0]] })).toEqual({})
  })
})

describe('sentences', () => {
  it('words what resolve did, singular and plural', () => {
    expect(resolvedSentence({ exact: 9, normalised: 2, aiSuggested: 0, unresolved: 1 })).toBe('Draft created. 9 names matched exactly, 2 are guesses to check, 1 is a guest.')
    expect(resolvedSentence({ exact: 1, normalised: 1, aiSuggested: 0, unresolved: 2 })).toBe('Draft created. 1 name matched exactly, 1 is a guess to check, 2 are guests.')
    expect(resolvedSentence({ exact: 0, normalised: 0, aiSuggested: 0, unresolved: 0 })).toBe('Draft created. There were no names to match.')
  })

  it('counts a reserved AI suggestion as a guess', () => {
    expect(resolvedSentence({ exact: 0, normalised: 1, aiSuggested: 1, unresolved: 0 })).toBe('Draft created. 2 are guesses to check.')
  })

  it('words the checks, with none as zero', () => {
    expect(checksSentence({ errors: [], warnings: [] })).toBe('Checks: 0 errors, 0 warnings.')
    expect(checksSentence(null)).toBe('Checks: 0 errors, 0 warnings.')
    expect(checksSentence({ errors: ['x'], warnings: ['y', 'z'] })).toBe('Checks: 1 error, 2 warnings.')
  })
})
