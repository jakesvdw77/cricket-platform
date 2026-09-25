import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Match } from '../api/matchApi'
import type { Team } from '../api/teamApi'

// docs/specs/051-league-schedule-sharing.md — this codebase's first Canvas2D mock, directly
// analogous to teamSheetPdf.test.ts's own jsPDF-mocking precedent: spy each drawing primitive the
// real file actually calls (fillRect/fillText/drawImage/createLinearGradient), assert on the
// *inputs* to those calls rather than reading back rendered pixels.
const fillRectSpy = vi.fn()
const fillTextSpy = vi.fn()
const drawImageSpy = vi.fn()
const addColorStopSpy = vi.fn()
const createLinearGradientSpy = vi.fn(() => ({ addColorStop: addColorStopSpy }))

function makeMockContext(): Record<string, unknown> {
  return {
    fillRect: fillRectSpy,
    fillText: fillTextSpy,
    drawImage: drawImageSpy,
    createLinearGradient: createLinearGradientSpy,
    fillStyle: '',
    font: '',
    textAlign: 'left',
    textBaseline: 'alphabetic',
  }
}

import { generateLeagueSchedulePoster } from './leagueSchedulePoster'

const homeTeam: Team = {
  id: 'team-home',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Riverside 1st XI',
  logoUrl: 'https://example.com/riverside.png',
  abbreviation: null,
  groundName: null,
  socialLinks: [],
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
  abbreviation: null,
  groundName: null,
  socialLinks: [],
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
  abbreviation: null,
  groundName: null,
  socialLinks: [],
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

// Dates fixed well into the future so `generateLeagueSchedulePoster`'s own `>= Date.now()`
// "upcoming" filter always includes them, independent of when this suite happens to run.
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
    matchDate: '2035-03-14T14:00:00Z',
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

describe('generateLeagueSchedulePoster', () => {
  beforeEach(() => {
    fillRectSpy.mockClear()
    fillTextSpy.mockClear()
    drawImageSpy.mockClear()
    addColorStopSpy.mockClear()
    createLinearGradientSpy.mockClear()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      makeMockContext() as unknown as CanvasRenderingContext2D,
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback) {
      callback!(new Blob(['fake-png']))
    })
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url'), revokeObjectURL: vi.fn() })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('includes every match when teamFilter is null', async () => {
    const match1 = makeMatch({ id: 'match-1', homeTeamId: 'team-home', awayTeamId: 'team-away' })
    const match2 = makeMatch({ id: 'match-2', homeTeamId: 'team-third', awayTeamId: 'team-away', matchDate: '2035-03-21T13:00:00Z' })

    const url = await generateLeagueSchedulePoster([match1, match2], teamsById, 'Premier League', '2026', null, '#2f6e4f')

    expect(url).toBe('blob:mock-url')
    const texts = fillTextSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Premier League')
    expect(texts).toContain('2026 — Full Schedule')
    expect(texts.some((text) => typeof text === 'string' && text.includes('Riverside 1st XI'))).toBe(true)
    expect(texts.some((text) => typeof text === 'string' && text.includes('Hillside CC'))).toBe(true)
  })

  it('includes only the given team\'s matches, as home or away, when teamFilter is set', async () => {
    const asHome = makeMatch({ id: 'match-home', homeTeamId: 'team-home', awayTeamId: 'team-away' })
    const asAway = makeMatch({ id: 'match-away', homeTeamId: 'team-third', awayTeamId: 'team-home', matchDate: '2035-03-21T13:00:00Z' })
    const uninvolved = makeMatch({ id: 'match-other', homeTeamId: 'team-third', awayTeamId: 'team-away', matchDate: '2035-03-28T13:00:00Z' })

    const url = await generateLeagueSchedulePoster(
      [asHome, asAway, uninvolved],
      teamsById,
      'Premier League',
      '2026',
      { teamId: 'team-home', teamName: 'Riverside 1st XI' },
      '#2f6e4f',
    )

    expect(url).toBe('blob:mock-url')
    const texts = fillTextSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Riverside 1st XI — 2026')
    expect(texts.some((text) => typeof text === 'string' && text.includes('Coastal CC'))).toBe(true)
    // The uninvolved match (Hillside CC vs Coastal CC, neither side the filtered team) is excluded.
    expect(
      texts.some((text) => typeof text === 'string' && text.includes('Hillside CC') && text.includes('Coastal CC')),
    ).toBe(false)
  })

  it('falls back to the initials tile, without throwing, when a team logo fails to load', async () => {
    const match = makeMatch({ homeTeamId: 'team-home', awayTeamId: 'team-away' })

    const url = await generateLeagueSchedulePoster([match], teamsById, 'Premier League', '2026', null, '#2f6e4f')

    expect(url).toBe('blob:mock-url')
    expect(drawImageSpy).not.toHaveBeenCalled()
    // The initials-tile fallback fills a translucent square, then the side's own initial letter.
    expect(fillTextSpy.mock.calls.map((call) => call[0])).toContain('R')
  })

  it('derives the gradient colour stops from the passed-in primaryColorHex, not a hardcoded palette', async () => {
    const match = makeMatch({})

    await generateLeagueSchedulePoster([match], teamsById, 'Premier League', '2026', null, '#2f6e4f')
    // #2f6e4f -> rgb(47, 110, 79); darkened by 0.55/0.24 respectively.
    expect(addColorStopSpy).toHaveBeenCalledWith(0, 'rgb(26, 61, 43)')
    expect(addColorStopSpy).toHaveBeenCalledWith(1, 'rgb(11, 26, 19)')

    addColorStopSpy.mockClear()

    await generateLeagueSchedulePoster([match], teamsById, 'Premier League', '2026', null, '#b7791f')
    // A different input hex produces different stops — proving the colour is derived, not fixed.
    expect(addColorStopSpy).toHaveBeenCalledWith(0, 'rgb(101, 67, 17)')
    expect(addColorStopSpy).toHaveBeenCalledWith(1, 'rgb(44, 29, 7)')
  })
})
