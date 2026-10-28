import { describe, expect, it } from 'vitest'
import { escapeIcsText } from '../leagueScheduleIcs'
import { foldIcsLine, generateLeagueIcsFile, generateLeagueIcsText, leagueIcsEvents } from './leagueIcs'
import { generateLeagueFacebookText } from './leagueTextFacebook'
import { leagueTextSections } from './leagueTextShared'
import { generateLeagueWhatsAppText, SHORT_LIST_LIMIT } from './leagueTextWhatsApp'
import { buildLeagueShareModel } from './shareLeagueData'
import type { Match } from '../../api/matchApi'
import { leagueInput } from './sharePrivacyFixture'

const model = (contents: string[], overrides = {}) => buildLeagueShareModel(leagueInput(false, { contents, ...overrides }))
const ALL = ['DETAILS', 'CONDITIONS', 'TEAMS', 'SCHEDULE', 'RESULTS', 'KEY_DATES']

const manyMatches = (count: number): Match[] =>
  Array.from({ length: count }, (_, index) => ({
    ...leagueInput(false).matches[0],
    id: `m${index}`,
    active: true,
    matchDate: `2026-11-${String(index + 1).padStart(2, '0')}T10:00:00`,
  })) as Match[]

describe('WhatsApp league text', () => {
  const options = { template: 'FULL' as const, emoji: true, resultLine: true }

  it('writes a header and one bold section per ticked content in the standard order', () => {
    const text = generateLeagueWhatsAppText(model(ALL), options)
    expect(text.startsWith('🏏 *Premier League*\n2026/27')).toBe(true)
    const headings = [...text.matchAll(/^\*(.+)\*$/gm)].map((m) => m[1]).filter((h) => h !== 'Premier League')
    expect(headings).toEqual(['League details', 'Playing conditions', 'Teams', 'Schedule', 'Results', 'Key dates'])
    expect(text).toContain('Match format: Overs per innings 20')
    expect(text).toContain('Riverside 1 v Pretoria CC: ')
  })

  it('writes only the ticked contents and never an empty section', () => {
    const text = generateLeagueWhatsAppText(model(['TEAMS', 'RESULTS'], { results: [] }), options)
    expect(text).toContain('*Teams*')
    expect(text).not.toContain('*Results*')
    expect(text).not.toContain('*Schedule*')
  })

  it('caps a Short list and counts the remainder, while Full lists everything', () => {
    const m = model(['SCHEDULE'], { matches: manyMatches(8) })
    const short = generateLeagueWhatsAppText(m, { ...options, template: 'SHORT' })
    expect(short).toContain(`and ${8 - SHORT_LIST_LIMIT} more`)
    expect(generateLeagueWhatsAppText(m, options)).not.toContain('more')
  })

  it('removes emoji when switched off and shows scores only when the result line is off', () => {
    const text = generateLeagueWhatsAppText(model(['RESULTS']), { template: 'FULL', emoji: false, resultLine: false })
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(text).toContain('Riverside 1 150/6 (40.0) v Pretoria CC')
    const line = generateLeagueWhatsAppText(model(['RESULTS']), options)
    expect(line).toMatch(/Riverside 1 v Pretoria CC: .+/)
  })

  it('leaves contact phone and email out unless included', () => {
    expect(generateLeagueWhatsAppText(model(['DETAILS']), options)).not.toContain('011 555 0100')
    const on = generateLeagueWhatsAppText(model(['DETAILS'], { includeContact: true }), options)
    expect(on).toContain('Phone: 011 555 0100')
    expect(on).toContain('Convenor: Thabo Mokoena (082 555 0199, k1@example.org)')
  })
})

describe('Facebook league text', () => {
  const options = { template: 'FULL_POST' as const, hashtags: true, resultLine: true }

  it('writes a titled post with a plain section per content, no emoji and no bold', () => {
    const text = generateLeagueFacebookText(model(ALL), options)
    expect(text.split('\n')[0]).toBe('Premier League, 2026/27')
    expect(text).toContain('\n\nTeams\nRiverside 1\nPretoria CC')
    expect(text).not.toMatch(/\p{Extended_Pictographic}|\*/u)
  })

  it('writes the Brief as one paragraph with a capped list', () => {
    const text = generateLeagueFacebookText(model(['TEAMS', 'SCHEDULE'], { matches: manyMatches(6) }), { ...options, template: 'BRIEF' })
    expect(text).toContain('Teams: Riverside 1; Pretoria CC.')
    expect(text).toContain('and 3 more')
  })

  it('ends with the league and club hashtags only, and none when off', () => {
    const text = generateLeagueFacebookText(model(['DETAILS']), options)
    expect(text.trim().split('\n').pop()).toBe('#PremierLeague #RiversideCC')
    expect(generateLeagueFacebookText(model(['DETAILS']), { ...options, hashtags: false })).not.toContain('#')
  })
})

describe('leagueTextSections', () => {
  it('shows only the first conditions section in a capped text', () => {
    const sections = leagueTextSections(model(['CONDITIONS']), { resultLine: true, limit: 3 })
    expect(sections[0].lines).toHaveLength(1)
  })
})

describe('league ics', () => {
  const unfold = (text: string) => text.replace(/\r\n /g, '')

  it('makes timed events for fixtures and all-day events for key dates', () => {
    const text = generateLeagueIcsText(model(['SCHEDULE', 'KEY_DATES']), new Date('2026-10-18T08:00:00Z'))
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(text.endsWith('END:VCALENDAR')).toBe(true)
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2 + 5)
    expect(text).toContain('DTSTAMP:20261018T080000Z')
    expect(text).toMatch(/DTSTART:\d{8}T\d{6}Z\r\nDTEND:\d{8}T\d{6}Z/)
    expect(text).toContain('SUMMARY:Riverside 1 vs Pretoria CC')
    expect(text).toContain('DTSTART;VALUE=DATE:20261001\r\nDTEND;VALUE=DATE:20261002')
    expect(text).toContain('SUMMARY:Premier League: League starts')
    expect(text).not.toContain('\n\n')
  })

  it('carries only the ticked schedule and key dates, not other contents', () => {
    expect(leagueIcsEvents(model(['DETAILS', 'TEAMS']))).toEqual([])
    const events = leagueIcsEvents(model(['KEY_DATES']))
    expect(events.every((e) => e.allDayIso !== null && e.start === null)).toBe(true)
  })

  it('moves an all-day end across a month and year boundary', () => {
    const text = generateLeagueIcsText(model(['KEY_DATES'], { seasonDates: { startDate: '2026-12-31', endDate: '2027-02-28' } }))
    expect(text).toContain('DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101')
    expect(text).toContain('DTSTART;VALUE=DATE:20270228\r\nDTEND;VALUE=DATE:20270301')
  })

  it('escapes commas, semicolons, backslashes and newlines in text values', () => {
    expect(escapeIcsText('a, b; c\\d\ne')).toBe('a\\, b\\; c\\\\d\\ne')
    const text = generateLeagueIcsText(model(['SCHEDULE'], { matches: [{ ...leagueInput(false).matches[0], venue: 'Oval, North; Gate' }] }))
    expect(text).toContain('LOCATION:Oval\\, North\\; Gate')
  })

  it('folds lines over 75 octets with CRLF and a space, never splitting a multi-byte character', () => {
    const long = `SUMMARY:${'é'.repeat(80)}`
    const folded = foldIcsLine(long)
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(folded.replace(/\r\n /g, '')).toBe(long)
    expect(foldIcsLine('short')).toBe('short')
    const text = generateLeagueIcsText(model(['SCHEDULE'], { matches: [{ ...leagueInput(false).matches[0], venue: 'Ж'.repeat(60) }] }))
    expect(unfold(text)).toContain(`LOCATION:${'Ж'.repeat(60)}`)
  })

  it('names the file after the league and season and gives it the calendar type', () => {
    const file = generateLeagueIcsFile(model(['SCHEDULE']))
    expect(file.name).toBe('Premier League 202627.ics')
    expect(file.type).toBe('text/calendar;charset=utf-8')
  })
})
