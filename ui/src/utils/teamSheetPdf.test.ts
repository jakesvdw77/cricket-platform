import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Match } from '../api/matchApi'
import type { MatchSide } from '../api/matchSideApi'
import type { Team } from '../api/teamApi'
import type { SquadMember } from '../api/teamSquadApi'

// jsPDF produces binary PDF output, so — per docs/standards/testing.md's guidance for a
// third-party drawing library with no existing mocking precedent in this repo — this test asserts
// on the *inputs* to jsPDF's own drawing calls (text/addImage/rect/roundedRect) rather than trying
// to parse the generated PDF bytes.
const textSpy = vi.fn()
const addImageSpy = vi.fn()
const rectSpy = vi.fn()
const roundedRectSpy = vi.fn()
const addPageSpy = vi.fn()

vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } }
    setFillColor = vi.fn()
    setDrawColor = vi.fn()
    setLineWidth = vi.fn()
    setTextColor = vi.fn()
    setFont = vi.fn()
    setFontSize = vi.fn()
    rect = rectSpy
    roundedRect = roundedRectSpy
    text = textSpy
    addImage = addImageSpy
    addPage = addPageSpy
    splitTextToSize = vi.fn((value: string) => [value])
    output = vi.fn(() => new Blob(['fake-pdf']))
  }
  return { jsPDF: MockJsPDF }
})

import { generateTeamSheetPdf } from './teamSheetPdf'
import type { TeamSheetSide } from './teamSheetPdf'

const match: Match = {
  id: 'match-1',
  clubId: 'club-1',
  homeTeamId: 'team-home',
  homeTeamName: null,
  awayTeamId: 'team-away',
  awayTeamName: null,
  leagueId: null,
  seasonId: 'season-1',
  matchDate: '2026-03-01T10:00:00Z',
  venue: 'Riverside Oval',
  active: true,
  homeSideAnnounced: false,
  awaySideAnnounced: false,
  homeTeamLogoUrl: null,
  awayTeamLogoUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const homeTeam: Team = {
  id: 'team-home',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Riverside CC',
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

// `id` (the TeamSquadMember row's own id) is deliberately distinct from `playerProfileId`
// (docs/specs/031-jersey-numbers.md) — resolveRoster/resolveTwelfthMan must join on
// playerProfileId, not `id`; a fixture reusing the same value for both would hide that bug.
function makeSquadMember(
  playerProfileId: string,
  firstName: string,
  lastName: string,
  squadJerseyNumber: number | null = null,
): SquadMember {
  return {
    id: `squad-row-${playerProfileId}`,
    playerProfileId,
    personId: playerProfileId,
    clubId: 'club-1',
    firstName,
    lastName,
    dateOfBirth: null,
    gender: null,
    photoUrl: null,
    clubMembershipNumber: null,
    medicalAidProvider: null,
    medicalAidMemberNumber: null,
    phone: null,
    email: null,
    altContactName: null,
    altContactPhone: null,
    battingStance: null,
    bowlingArm: null,
    bowlingType: null,
    isWicketKeeper: false,
    active: true,
    sectionIds: [],
    jerseyNumber: null,
    squadJerseyNumber,
    isCaptain: false,
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
  }
}

const p1 = makeSquadMember('p1', 'John', 'Smith')
const p2 = makeSquadMember('p2', 'Amit', 'Patel')
const p3 = makeSquadMember('p3', 'Sipho', 'Ndlovu')

const homeSide: MatchSide = {
  id: 'side-home',
  matchId: 'match-1',
  teamId: 'team-home',
  captainPlayerId: 'p1',
  wicketKeeperPlayerId: 'p2',
  twelfthManPlayerId: 'p3',
  players: [
    { playerProfileId: 'p2', battingOrder: 2, role: 'BATSMAN' },
    { playerProfileId: 'p1', battingOrder: 1, role: 'BATSMAN' },
  ],
  announced: false,
}

const homeSheetSide: TeamSheetSide = {
  team: homeTeam,
  teamName: homeTeam.name,
  side: homeSide,
  squad: [p1, p2, p3],
}

const awaySheetSideEmpty: TeamSheetSide = {
  team: awayTeam,
  teamName: awayTeam.name,
  side: { id: 'side-away', matchId: 'match-1', teamId: 'team-away', captainPlayerId: null, wicketKeeperPlayerId: null, twelfthManPlayerId: null, players: [], announced: false },
  squad: [],
}

const subtitle = '1 March 2026 · Riverside Oval · Premier League — 2026'

describe('generateTeamSheetPdf', () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    textSpy.mockClear()
    addImageSpy.mockClear()
    rectSpy.mockClear()
    roundedRectSpy.mockClear()
    addPageSpy.mockClear()
    createObjectURLSpy = vi.fn(() => 'blob:mock-url')
    vi.stubGlobal('URL', { ...URL, createObjectURL: createObjectURLSpy })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the header title and the pre-built subtitle line', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['logo']) }),
    )
    // FileReader isn't invoked in this test's assertions directly, but jsdom's real
    // implementation is used since `fetch` above resolves — stub it to resolve synchronously.
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

    const url = await generateTeamSheetPdf(match, [homeSheetSide, awaySheetSideEmpty], subtitle)

    expect(url).toBe('blob:mock-url')
    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Riverside CC vs Coastal CC')
    expect(texts).toContain(subtitle)
    expect(texts).toContain('TEAM SHEET')

    // homeTeam has a real logoUrl and the fetch/FileReader stubs above succeed, so the real-logo
    // addImage path (not the initial-letter fallback tile) must be the one that actually runs.
    expect(addImageSpy).toHaveBeenCalledTimes(1)
    expect(addImageSpy).toHaveBeenCalledWith('data:image/png;base64,abc', 'PNG', expect.any(Number), expect.any(Number), expect.any(Number), expect.any(Number))
  })

  it('renders one section per side for the both scope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await generateTeamSheetPdf(match, [homeSheetSide, awaySheetSideEmpty], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Playing XI (2)')
    expect(texts).toContain('Playing XI (0)')
  })

  it('renders a single section for a home-only scope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await generateTeamSheetPdf(match, [homeSheetSide], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts.filter((text) => typeof text === 'string' && text.startsWith('Playing XI'))).toHaveLength(1)
    expect(texts).toContain('Playing XI (2)')
  })

  it('renders a single section for an away-only scope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await generateTeamSheetPdf(match, [awaySheetSideEmpty], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts.filter((text) => typeof text === 'string' && text.startsWith('Playing XI'))).toHaveLength(1)
    expect(texts).toContain('Playing XI (0)')
  })

  it('orders batting rows by battingOrder ascending, not squad/side.players order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await generateTeamSheetPdf(match, [homeSheetSide], subtitle)

    const nameTexts = textSpy.mock.calls
      .map((call) => call[0])
      .filter((text): text is string => typeof text === 'string' && (text.includes('John Smith') || text.includes('Amit Patel')))

    const johnIndex = nameTexts.findIndex((text) => text.includes('John Smith'))
    const amitIndex = nameTexts.findIndex((text) => text.includes('Amit Patel'))
    expect(johnIndex).toBeGreaterThanOrEqual(0)
    expect(amitIndex).toBeGreaterThan(johnIndex)
  })

  it('appends (C) to the captain and (WK) to the wicketkeeper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await generateTeamSheetPdf(match, [homeSheetSide], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('John Smith (C)')
    expect(texts).toContain('Amit Patel (WK)')
  })

  it('prefixes a roster entry with "#N " when its squadJerseyNumber is set (docs/specs/031-jersey-numbers.md)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const numberedSide: TeamSheetSide = {
      team: homeTeam,
      teamName: homeTeam.name,
      side: homeSide,
      squad: [makeSquadMember('p1', 'John', 'Smith', 7), p2, p3],
    }

    await generateTeamSheetPdf(match, [numberedSide], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('#7 John Smith (C)')
  })

  it('prints the plain name, with no stray "#", when squadJerseyNumber is unset', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await generateTeamSheetPdf(match, [homeSheetSide], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('John Smith (C)')
    expect(texts.some((text) => typeof text === 'string' && text.includes('#'))).toBe(false)
  })

  it('renders a twelfth-man callout when one is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await generateTeamSheetPdf(match, [homeSheetSide], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('12th Man:')
    expect(texts).toContain('Sipho Ndlovu')
  })

  it('omits the twelfth-man callout when none is set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await generateTeamSheetPdf(match, [awaySheetSideEmpty], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).not.toContain('12th Man:')
  })

  it('renders a "Team not yet announced" placeholder for a side with zero players', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    await generateTeamSheetPdf(match, [awaySheetSideEmpty], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Team not yet announced')
  })

  it('renders the placeholder when a side has no MatchSide at all', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const noSide: TeamSheetSide = { team: awayTeam, teamName: awayTeam.name, side: undefined, squad: [] }

    await generateTeamSheetPdf(match, [noSide], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Team not yet announced')
  })

  it('falls back to a readable label, not the raw id, for a player missing from the squad', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const sideWithMissingPlayer: TeamSheetSide = {
      team: homeTeam,
      teamName: homeTeam.name,
      side: {
        id: 'side-home',
        matchId: 'match-1',
        teamId: 'team-home',
        captainPlayerId: null,
        wicketKeeperPlayerId: null,
        twelfthManPlayerId: 'missing-player',
        players: [{ playerProfileId: 'missing-player', battingOrder: 1, role: 'BATSMAN' }],
        announced: false,
      },
      squad: [], // deliberately empty — the roster references a player id not present here
    }

    await generateTeamSheetPdf(match, [sideWithMissingPlayer], subtitle)

    const texts = textSpy.mock.calls.map((call) => call[0])
    expect(texts).toContain('Unknown player')
    expect(texts).not.toContain('missing-player')
  })

  it('still produces a valid PDF blob URL when the logo fails to load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))

    const url = await generateTeamSheetPdf(match, [homeSheetSide, awaySheetSideEmpty], subtitle)

    expect(url).toBe('blob:mock-url')
    expect(addImageSpy).not.toHaveBeenCalled()
  })
})
