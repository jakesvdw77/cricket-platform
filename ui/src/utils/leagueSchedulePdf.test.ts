import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Match } from '../api/matchApi'
import type { Team } from '../api/teamApi'

// jsPDF produces binary PDF output, so — mirroring teamSheetPdf.test.ts's own precedent exactly —
// this test asserts on the *inputs* to jsPDF's own drawing calls rather than parsing the generated
// PDF bytes.
const textSpy = vi.fn()
const addImageSpy = vi.fn()
const rectSpy = vi.fn()
const roundedRectSpy = vi.fn()
const addPageSpy = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }
    setFillColor = vi.fn()
    setTextColor = vi.fn()
    setFont = vi.fn()
    setFontSize = vi.fn()
    rect = rectSpy
    roundedRect = roundedRectSpy
    text = textSpy
    addImage = addImageSpy
    addPage = addPageSpy
    output = vi.fn(() => new Blob(['fake-pdf']))
  }
  return { jsPDF: MockJsPDF }
})

import { generateLeagueSchedulePdf } from './leagueSchedulePdf'

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
    // Matches LeagueFixtures.test.tsx's own precedent values, which this repo's test env has
    // already confirmed render as "Sat, 14 Mar 2026"/"Sat, 21 Mar 2026" without timezone drift.
    matchDate: '2026-03-14T14:00:00Z',
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

describe('generateLeagueSchedulePdf', () => {
  beforeEach(() => {
    textSpy.mockClear()
    addImageSpy.mockClear()
    rectSpy.mockClear()
    roundedRectSpy.mockClear()
    addPageSpy.mockClear()
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock-url') })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('includes every match, date-grouped, with the header/footer text for the unfiltered ("All Teams") schedule', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['logo']) }),
    )
    class StubFileReader {
      result: string | null = null
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      readAsDataURL() {
        this.result = 'data:image/png;base64,abc'
        this.onload?.()
      }
    }
    vi.stubGlobal('FileReader', StubFileReader)

    const match1 = makeMatch({ id: 'match-1', homeTeamId: 'team-home', awayTeamId: 'team-away', matchDate: '2026-03-14T14:00:00Z' })
    const match2 = makeMatch({ id: 'match-2', homeTeamId: 'team-third', awayTeamId: 'team-away', matchDate: '2026-03-21T13:00:00Z' })

    const url = await generateLeagueSchedulePdf([match1, match2], teamsById, 'Premier League', '2026', null)

    expect(url).toBe('blob:mock-url')
    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Premier League')
    // Unscoped subtitle is just the season label, not a team-scope subtitle.
    expect(texts).toContain('2026')
    expect(texts).toContain('SCHEDULE')
    expect(texts).toContain('Page 1')
    expect(texts).toContain('Riverside 1st XI')
    expect(texts).toContain('Coastal CC')
    expect(texts).toContain('Hillside CC')
    expect(texts).toContain('Sat, 14 Mar 2026')
    expect(texts).toContain('Sat, 21 Mar 2026')

    // The real-logo path (homeTeam has a real logoUrl, fetch/FileReader stubs above succeed).
    expect(addImageSpy).toHaveBeenCalledWith('data:image/png;base64,abc', 'PNG', expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
  })

  it('includes only the given team\'s matches, as home or away, when teamFilter is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const asHome = makeMatch({ id: 'match-home', homeTeamId: 'team-home', awayTeamId: 'team-away', matchDate: '2026-03-14T14:00:00Z' })
    const asAway = makeMatch({ id: 'match-away', homeTeamId: 'team-third', awayTeamId: 'team-home', matchDate: '2026-03-21T13:00:00Z' })
    const uninvolved = makeMatch({ id: 'match-other', homeTeamId: 'team-third', awayTeamId: 'team-away', matchDate: '2026-03-28T13:00:00Z' })

    const url = await generateLeagueSchedulePdf(
      [asHome, asAway, uninvolved],
      teamsById,
      'Premier League',
      '2026',
      { teamId: 'team-home', teamName: 'Riverside 1st XI' },
    )

    expect(url).toBe('blob:mock-url')
    const texts = textSpy.mock.calls.map((call) => call[0])
    // Scoped subtitle reads "<team> — <season>", not just the season label.
    expect(texts).toContain('Riverside 1st XI — 2026')
    expect(texts).toContain('Coastal CC')
    expect(texts).toContain('Hillside CC')
    // The third, uninvolved match's own date heading never appears — it was filtered out entirely.
    expect(texts).not.toContain('Sat, 28 Mar 2026')
  })

  it('falls back to the initials tile, without throwing, when a team logo fails to load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    const match = makeMatch({ homeTeamId: 'team-home', awayTeamId: 'team-away' })

    const url = await generateLeagueSchedulePdf([match], teamsById, 'Premier League', '2026', null)

    expect(url).toBe('blob:mock-url')
    expect(addImageSpy).not.toHaveBeenCalled()
    // The initials-tile fallback draws a rounded square avatar in place of the missing logo.
    expect(roundedRectSpy).toHaveBeenCalled()
  })
})
