import { describe, expect, it } from 'vitest'
import type { Match } from '../api/matchApi'
import type { MatchSide } from '../api/matchSideApi'
import type { Team } from '../api/teamApi'
import type { SquadMember } from '../api/teamSquadApi'
import type { TeamSheetSide } from './teamSheetPdf'
import { generateTeamSheetWhatsAppText, getRoleEmoji } from './teamSheetWhatsAppText'

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
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  updatedBy: null,
}

const homeTeam: Team = {
  id: 'team-home',
  clubId: 'club-1',
  sectionId: 'section-1',
  name: 'Riverside CC',
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
    createdAt: '',
    updatedAt: '',
    updatedBy: null,
  }
}

const p1 = makeSquadMember('p1', 'John', 'Smith', 7)
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
    { playerProfileId: 'p2', battingOrder: 2, role: 'BOWLER' },
    { playerProfileId: 'p1', battingOrder: 1, role: 'BATSMAN' },
  ],
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
  side: {
    id: 'side-away',
    matchId: 'match-1',
    teamId: 'team-away',
    captainPlayerId: null,
    wicketKeeperPlayerId: null,
    twelfthManPlayerId: null,
    players: [],
  },
  squad: [],
}

const subtitle = '1 March 2026 · Riverside Oval · Premier League — 2026'

describe('getRoleEmoji', () => {
  it('returns the correct emoji for every role/wicketkeeper combination', () => {
    expect(getRoleEmoji('BATSMAN', false)).toBe('🏏')
    expect(getRoleEmoji('BATSMAN', true)).toBe('🏏🧤')
    expect(getRoleEmoji('BOWLER', false)).toBe('🔴')
    expect(getRoleEmoji('BOWLER', true)).toBe('🔴🧤')
    expect(getRoleEmoji('ALL_ROUNDER', false)).toBe('🏏🔴')
    expect(getRoleEmoji('ALL_ROUNDER', true)).toBe('🏏🔴🧤')
  })
})

describe('generateTeamSheetWhatsAppText', () => {
  it('renders the header line, logistics line, and a trailing legend', () => {
    const text = generateTeamSheetWhatsAppText(match, [homeSheetSide, awaySheetSideEmpty], subtitle)

    expect(text).toContain('🏏 *Riverside CC vs Coastal CC*')
    expect(text).toContain(subtitle)
    expect(text).toContain('🏏 = Bat  |  🔴 = Bowl  |  🏏🔴 = All-Rounder  |  🧤 = WK')
  })

  it('renders one section per side, in batting order, with role emoji, jersey prefix, and captain/WK/twelfth-man callouts', () => {
    const text = generateTeamSheetWhatsAppText(match, [homeSheetSide, awaySheetSideEmpty], subtitle)

    expect(text).toContain('*Riverside CC — Playing XI*')
    expect(text).toContain('⭐ Captain: John Smith')
    expect(text).toContain('🏏 1. #7 John Smith *(C)*')
    expect(text).toContain('🔴🧤 2. Amit Patel')
    expect(text).toContain('_12th Man: Sipho Ndlovu_')

    const johnIndex = text.indexOf('John Smith')
    const amitIndex = text.indexOf('Amit Patel')
    expect(johnIndex).toBeGreaterThanOrEqual(0)
    expect(amitIndex).toBeGreaterThan(johnIndex)

    expect(text).toContain('*Coastal CC — Playing XI*')
    expect(text).toContain('_Team not yet announced_')
  })

  it('omits the "#" jersey prefix when squadJerseyNumber is unset', () => {
    const text = generateTeamSheetWhatsAppText(match, [homeSheetSide], subtitle)

    expect(text).toContain('🔴🧤 2. Amit Patel')
    expect(text).not.toContain('#null')
  })

  it('renders a single section for a home-only scope', () => {
    const text = generateTeamSheetWhatsAppText(match, [homeSheetSide], subtitle)

    expect(text).toContain('*Riverside CC — Playing XI*')
    expect(text).not.toContain('Coastal CC')
  })

  it('renders a single section for an away-only scope', () => {
    const text = generateTeamSheetWhatsAppText(match, [awaySheetSideEmpty], subtitle)

    expect(text).toContain('*Coastal CC — Playing XI*')
    expect(text).toContain('_Team not yet announced_')
    expect(text).not.toContain('Riverside CC')
  })

  it('falls back to "Unknown player" for a roster entry missing from the squad', () => {
    const sideWithMissingPlayer: TeamSheetSide = {
      team: homeTeam,
      teamName: homeTeam.name,
      side: {
        id: 'side-home',
        matchId: 'match-1',
        teamId: 'team-home',
        captainPlayerId: null,
        wicketKeeperPlayerId: null,
        twelfthManPlayerId: null,
        players: [{ playerProfileId: 'missing-player', battingOrder: 1, role: 'BATSMAN' }],
      },
      squad: [],
    }

    const text = generateTeamSheetWhatsAppText(match, [sideWithMissingPlayer], subtitle)

    expect(text).toContain('Unknown player')
    expect(text).not.toContain('missing-player')
  })
})
