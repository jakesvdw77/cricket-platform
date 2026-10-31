import type { Match } from '../../api/matchApi'
import type { MatchSide } from '../../api/matchSideApi'
import type { SquadMember } from '../../api/teamSquadApi'
import type { Team } from '../../api/teamApi'
import type { TeamSheetSide } from '../teamSheetSide'
import { buildMatchShareModel } from './shareMatchData'
import type { BuildMatchShareInput, MatchShareModel } from './shareMatchData'
import type { FunFact } from './matchFunFacts'

// Test fixture for docs/specs/131: a junior-looking match, Irene Villagers U15 (home, ours) v Pretoria A (away, ours too when
// `derby`), with full given names so a privacy test can tell a shortened name from a full one.
export const FULL_FIRST_NAMES = ['Andile', 'Thabo', 'Johan', 'Kagiso', 'Lerato', 'Mpho', 'Sipho', 'Ruan', 'Dumisani', 'Nandi', 'Bongani', 'Pieter']
const LAST_NAMES = ['Botha', 'Naidoo', 'Smit', 'Dlamini', 'Pretorius', 'Venter', 'Khumalo', 'Jacobs', 'Mokoena', 'van Wyk', 'Steyn', 'Meyer']

export const MATCH_DATE = '2026-11-06T09:15:00'

export const fixtureMatch = (overrides: Partial<Match> = {}): Match =>
  ({
    id: 'm1', clubId: 'c1', homeTeamId: 't-home', homeTeamName: null, awayTeamId: null, awayTeamName: 'Pretoria A', leagueId: 'l1',
    seasonId: 's1', matchDate: MATCH_DATE, venue: 'Hofmeyer Park', active: true, homeSideAnnounced: true, awaySideAnnounced: false,
    homeTeamLogoUrl: null, awayTeamLogoUrl: null, homePickedCount: 11, awayPickedCount: null, playingXiSize: 11, polls: [],
    createdAt: '', updatedAt: '', updatedBy: null, ...overrides,
  }) as Match

const team = (id: string, name: string): Team =>
  ({ id, clubId: 'c1', sectionId: 'sec', name, logoUrl: null, abbreviation: null, groundName: null, socialLinks: [], active: true, createdAt: '', updatedAt: '', updatedBy: null }) as Team

export function fixtureSide(teamId: string, teamName: string, offset = 0, selected = true): TeamSheetSide {
  const names = Array.from({ length: 11 }, (_, index) => ({ first: FULL_FIRST_NAMES[(index + offset) % 12], last: LAST_NAMES[(index + offset) % 12] }))
  const squad = names.map((name, index) => ({ id: `p${teamId}${index}`, playerProfileId: `${teamId}-p${index}`, firstName: name.first, lastName: name.last, squadJerseyNumber: index + 1, isCaptain: false })) as unknown as SquadMember[]
  const side = selected
    ? ({
        id: `side-${teamId}`, matchId: 'm1', teamId, captainPlayerId: `${teamId}-p0`, wicketKeeperPlayerId: `${teamId}-p4`, twelfthManPlayerId: null, announced: true,
        limits: { battingPlaces: 11, twelfthManAllowed: false, maxSelected: 11 },
        players: squad.map((member, index) => ({ playerProfileId: member.playerProfileId, battingOrder: index + 1, role: 'BATSMAN' as const })),
      } satisfies MatchSide)
    : undefined
  return { team: team(teamId, teamName), teamName, side, squad }
}

export const fixtureFacts: FunFact[] = [{ id: 'OUR_FORM', label: 'Our form', text: 'Irene Villagers U15 have won 4 of their last 5', basis: 'Form, last 5 published results' }]

export function fixtureModel(overrides: Partial<BuildMatchShareInput> = {}): MatchShareModel {
  const input: BuildMatchShareInput = {
    content: 'TEAM_SELECTION',
    match: fixtureMatch(),
    sides: [fixtureSide('t-home', 'Irene Villagers U15'), fixtureSide('t-away', 'Pretoria A', 5)],
    logos: { home: null, away: null },
    ownKeys: ['home'],
    side: 'BOTH',
    layout: 'SIDE_BY_SIDE',
    initialsOnly: true,
    leagueName: 'Diamond League U15 T20',
    seasonLabel: '2026/2027',
    clubName: 'Irene Villagers Cricket Club',
    weather: { label: 'Sunny', icon: 'sunny', tempMin: 14, tempMax: 27, rainChance: 20, text: 'Sunny, 14 to 27 degrees, 20% rain', short: '14 to 27 degrees, 20% rain' },
    facts: fixtureFacts,
    now: new Date(2026, 10, 3, 12, 0),
    ...overrides,
  }
  return buildMatchShareModel(input)
}
