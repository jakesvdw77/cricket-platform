import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Match } from '../api/matchApi'
import type { Team } from '../api/teamApi'
import { generateLeagueScheduleIcs } from './leagueScheduleIcs'

const homeTeam: Team = {
  id: 'team-home',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Riverside 1st XI',
  logoUrl: null,
  active: true,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

const awayTeam: Team = {
  id: 'team-away',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Coastal CC',
  logoUrl: null,
  active: true,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

const thirdTeam: Team = {
  id: 'team-third',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Hillside CC',
  logoUrl: null,
  active: true,
  createdAt: '',
  updatedAt: '',
  updatedBy: null,
}

const teamsById = new Map<string, Team>([
  [homeTeam.id, homeTeam],
  [awayTeam.id, awayTeam],
  [thirdTeam.id, thirdTeam],
])

function makeMatch(overrides: Partial<Match>): Match {
  return {
    id: 'match-1',
    clubId: 'club-1',
    homeTeamId: 'team-home',
    homeTeamName: null,
    awayTeamId: 'team-away',
    awayTeamName: null,
    leagueId: 'league-1',
    seasonId: 'season-1',
    matchDate: '2026-03-14T10:00:00Z',
    venue: 'Riverside Oval',
    active: true,
    homeSideAnnounced: false,
    awaySideAnnounced: false,
    homeTeamLogoUrl: null,
    awayTeamLogoUrl: null,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
    ...overrides,
  }
}

const team = { teamId: 'team-home', teamName: 'Riverside 1st XI' }

describe('generateLeagueScheduleIcs', () => {
  // jsdom's own Blob polyfill (unlike Node's global Blob) doesn't implement `.text()`, so — rather
  // than reading the Blob back — this test stubs the Blob constructor itself to capture the raw
  // ics text it was built from, and asserts against that directly.
  let capturedText: string | null = null

  beforeEach(() => {
    capturedText = null
    vi.stubGlobal(
      'Blob',
      vi.fn((parts: string[]) => {
        capturedText = parts.join('')
        return {}
      }),
    )
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url') })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function icsTextFrom(url: string): string {
    expect(url).toBe('blob:mock-url')
    expect(capturedText).not.toBeNull()
    return capturedText as string
  }

  it('produces a VEVENT with the correct SUMMARY/LOCATION/DESCRIPTION/UID/DTSTART/DTEND at the fixed 3-hour duration', async () => {
    const match = makeMatch({
      id: 'match-1',
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      matchDate: '2026-03-14T10:00:00Z',
      venue: 'Riverside Oval',
    })

    const url = generateLeagueScheduleIcs([match], teamsById, 'Premier League', '2026', team)
    const text = icsTextFrom(url)
    const lines = text.split('\r\n')

    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('BEGIN:VEVENT')
    expect(lines).toContain('UID:match-1@cricketlegend')
    expect(lines).toContain('DTSTART:20260314T100000Z')
    // Fixed 3-hour event duration — this spec's own explicit decision.
    expect(lines).toContain('DTEND:20260314T130000Z')
    expect(lines).toContain('SUMMARY:Riverside 1st XI vs Coastal CC')
    expect(lines).toContain('DESCRIPTION:Premier League — 2026')
    expect(lines).toContain('LOCATION:Riverside Oval')
    expect(lines).toContain('END:VEVENT')
    expect(lines).toContain('END:VCALENDAR')
    expect(lines.some((line) => /^DTSTAMP:\d{8}T\d{6}Z$/.test(line))).toBe(true)
  })

  it('escapes commas, semicolons, backslashes, and newlines in a free-text opponent name and venue, per RFC 5545', async () => {
    // Raw contains one of each escape-worthy character: a comma, a semicolon, a backslash, and an
    // actual newline.
    const raw = 'A,B;C\\D\nE'
    const expected = 'A\\,B\\;C\\\\D\\nE'

    const match = makeMatch({
      id: 'match-1',
      homeTeamId: 'team-home',
      awayTeamId: null,
      awayTeamName: raw,
      venue: raw,
    })

    const url = generateLeagueScheduleIcs([match], teamsById, 'Premier League', '2026', team)
    const text = icsTextFrom(url)
    const lines = text.split('\r\n')

    expect(lines).toContain(`SUMMARY:Riverside 1st XI vs ${expected}`)
    expect(lines).toContain(`LOCATION:${expected}`)
  })

  it('filters to only the given team\'s matches, as home or away', async () => {
    const asHome = makeMatch({ id: 'match-home', homeTeamId: 'team-home', awayTeamId: 'team-away' })
    const asAway = makeMatch({ id: 'match-away', homeTeamId: 'team-third', awayTeamId: 'team-home' })
    const uninvolved = makeMatch({ id: 'match-other', homeTeamId: 'team-third', awayTeamId: 'team-away' })

    const url = generateLeagueScheduleIcs([asHome, asAway, uninvolved], teamsById, 'Premier League', '2026', team)
    const text = icsTextFrom(url)

    expect(text).toContain('UID:match-home@cricketlegend')
    expect(text).toContain('UID:match-away@cricketlegend')
    expect(text).not.toContain('UID:match-other@cricketlegend')
    expect((text.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2)
  })

  it('produces a valid, zero-VEVENT calendar rather than throwing when the team has no fixtures', async () => {
    const url = generateLeagueScheduleIcs([], teamsById, 'Premier League', '2026', team)
    const text = icsTextFrom(url)

    expect(text).toContain('BEGIN:VCALENDAR')
    expect(text).toContain('END:VCALENDAR')
    expect(text).not.toContain('BEGIN:VEVENT')
  })
})
