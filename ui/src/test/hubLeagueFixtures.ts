import type { FieldDto, MyLeagueDto, MyLeagueSummaryDto, MyLeaguesDto, MyPlayingConditionsDto } from '../api/myPlayersApi'

// docs/specs/123 and 124: typed fixtures for the Player Hub league screens' tests.
export const conditions = (overrides: Partial<MyPlayingConditionsDto> = {}): MyPlayingConditionsDto => ({
  documentUrl: null,
  maxOversPerInnings: 20,
  powerplayOvers: 6,
  maxOversPerBowler: 4,
  maxBallsPerOver: null,
  freeHitOnNoBall: true,
  fieldingRestrictionsNotes: null,
  allowSubstitutions: true,
  pointsForWin: 4,
  pointsForLoss: 0,
  pointsForDraw: 2,
  pointsForNoResult: 2,
  pointsForForfeitWin: 4,
  bonusPointsEnabled: false,
  bonusBattingOversThreshold: null,
  bonusBowlingRestrictionPercentage: null,
  additionalNotes: null,
  ...overrides,
})

export const hubField = (overrides: Partial<FieldDto> = {}): FieldDto => ({
  id: 'f1', name: 'Riverside Oval', owner: null, addressLine1: '1 Main Rd', city: 'Paarl', provinceState: 'Western Cape',
  postalCode: '7646', country: 'ZA', mapUrl: null, verified: true, home: true, ...overrides,
})

export const leagueDto = (overrides: Partial<MyLeagueDto> = {}): MyLeagueDto => ({
  league: {
    id: 'l1', name: 'Boland Under 15', description: 'Weekend cricket for juniors.', logoUrl: null, minAge: null, maxAge: 15,
    ageCutoffDay: null, ageCutoffMonth: null, format: 'T20', website: null, socialLinks: [],
  },
  season: { id: 's1', name: '2026/27', startDate: '2026-10-01', endDate: '2027-03-31' },
  playingConditions: conditions(),
  teams: [
    { id: 't1', name: 'Paarl U15', abbreviation: 'PAA', logoUrl: null, mine: true },
    { id: 't2', name: 'Wellington U15', abbreviation: null, logoUrl: null, mine: false },
  ],
  schedule: [
    { matchId: 'm1', date: '2099-11-07', time: '09:30:00', homeName: 'Paarl U15', homeLogoUrl: null, awayName: 'Wellington U15', awayLogoUrl: null, venue: 'Riverside Oval', mine: true },
    { matchId: 'm2', date: '2099-11-14', time: null, homeName: 'Wellington U15', homeLogoUrl: null, awayName: 'Hermanus U15', awayLogoUrl: null, venue: null, mine: false },
  ],
  results: [
    { matchId: 'm0', date: '2026-10-10', homeName: 'Paarl U15', awayName: 'Hermanus U15', homeScore: '150/6', awayScore: '120 all out', resultLine: 'Paarl U15 won by 30 runs', mine: true },
    { matchId: 'm00', date: '2026-10-17', homeName: 'Wellington U15', awayName: 'Hermanus U15', homeScore: '90/9', awayScore: '91/3', resultLine: 'Hermanus U15 won by 7 wickets', mine: false },
  ],
  keyDates: { seasonStart: '2026-10-01', seasonEnd: '2027-03-31', firstMatchDate: '2026-10-10', lastMatchDate: '2027-03-20', nextMatchDate: '2099-11-07' },
  shareDisabledFormats: [],
  fields: [hubField()],
  ...overrides,
})

export const leagueSummary = (overrides: Partial<MyLeagueSummaryDto> = {}): MyLeagueSummaryDto => ({
  id: 'l1', name: 'Boland Under 15', logoUrl: null, minAge: null, maxAge: 15, teamCount: 8,
  myTeams: [{ id: 't1', name: 'Paarl U15' }], nextMatchDate: '2026-11-07', matchCount: 14, ...overrides,
})

export const leaguesDto = (overrides: Partial<MyLeaguesDto> = {}): MyLeaguesDto => ({
  seasons: [{ id: 's1', name: '2026/27', current: true }, { id: 's0', name: '2025/26', current: false }],
  seasonId: 's1',
  leagues: [leagueSummary(), leagueSummary({ id: 'l2', name: 'Cape Premier', minAge: null, maxAge: null, teamCount: 1, myTeams: [], nextMatchDate: null })],
  ...overrides,
})
