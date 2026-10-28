import { describe, expect, it } from 'vitest'
import { ageBand, groupByDate, hubLeaguePath, isHttps, isPast, longDate, parseLeagueTab, shortDate, timeLabel } from './leagueFormat'

// docs/specs/123: the pure helpers the Hub league screens share.
describe('leagueFormat', () => {
  it('words the age band, and nothing when no age is set', () => {
    expect(ageBand({ minAge: null, maxAge: 15 })).toBe('Under 15')
    expect(ageBand({ minAge: 12, maxAge: 15 })).toBe('12 to 15 years')
    expect(ageBand({ minAge: 40, maxAge: null })).toBe('40 and over')
    expect(ageBand({ minAge: null, maxAge: null })).toBeNull()
  })

  it('reads a bare date as the same calendar day and leaves other text alone', () => {
    expect(longDate('2026-10-17')).toMatch(/^Saturday,? 17 October 2026$/)
    expect(shortDate('2026-10-17')).toBe('17 Oct 2026')
    expect(longDate('2026-10-17T23:30:00Z')).toContain('17 October 2026')
    expect(shortDate('soon')).toBe('soon')
  })

  it('decides past from the local day, and today is not past', () => {
    const now = new Date(2026, 9, 17, 12)
    expect(isPast('2026-10-16', now)).toBe(true)
    expect(isPast('2026-10-17', now)).toBe(false)
  })

  it('cuts the time to hours and minutes', () => {
    expect(timeLabel('09:30:00')).toBe('09:30')
    expect(timeLabel(null)).toBe('')
  })

  it('accepts only https links', () => {
    expect(isHttps('https://example.com')).toBe(true)
    expect(isHttps('http://example.com')).toBe(false)
    expect(isHttps('javascript:alert(1)')).toBe(false)
    expect(isHttps(null)).toBe(false)
  })

  it('groups adjacent rows by date in the given order', () => {
    const groups = groupByDate([{ date: '2026-10-01', n: 1 }, { date: '2026-10-01T10:00', n: 2 }, { date: '2026-10-02', n: 3 }])
    expect(groups.map((g) => [g.date, g.rows.map((r) => r.n)])).toEqual([['2026-10-01', [1, 2]], ['2026-10-02', [3]]])
  })

  it('falls back to Details for an unknown tab', () => {
    expect(parseLeagueTab('fields')).toBe('fields')
    expect(parseLeagueTab('keydates')).toBe('details')
    expect(parseLeagueTab(null)).toBe('details')
  })

  it('builds the list and league URLs, keeping the season and a non-default tab only', () => {
    expect(hubLeaguePath('k1')).toBe('/account/players/k1/schedule/leagues')
    expect(hubLeaguePath('k1', undefined, { season: 's0' })).toBe('/account/players/k1/schedule/leagues?season=s0')
    expect(hubLeaguePath('k1', 'l1', { tab: 'details' })).toBe('/account/players/k1/schedule/leagues/l1')
    expect(hubLeaguePath('k1', 'l1', { season: 's0', tab: 'teams' })).toBe('/account/players/k1/schedule/leagues/l1?season=s0&tab=teams')
  })
})
