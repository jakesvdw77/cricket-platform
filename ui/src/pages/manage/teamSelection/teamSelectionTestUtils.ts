import type {
  TeamSelectionCell,
  TeamSelectionMatch,
  TeamSelectionOverview,
  TeamSelectionPlayer,
  TeamSelectionSide,
  TeamSelectionStatus,
} from '../../../api/teamSelectionApi'

// Shared fixtures for the Team selection hub tests and stories (not production code).
export function makeSide(overrides: Partial<TeamSelectionSide> = {}): TeamSelectionSide {
  return {
    sideId: 'side-1',
    teamId: 'team-1',
    teamName: 'Riverside Vets A',
    sectionId: 'sec-1',
    home: true,
    opponentName: 'Oakfield CC',
    announced: false,
    status: 'NOT_STARTED',
    limits: { battingPlaces: 11, twelfthManAllowed: true, maxSelected: 12 },
    pickedCount: 0,
    placesFilled: false,
    captainPlayerId: null,
    wicketKeeperPlayerId: null,
    twelfthManPlayerId: null,
    picks: [],
    ...overrides,
  }
}

export function makeMatch(overrides: Partial<TeamSelectionMatch> = {}, status?: TeamSelectionStatus): TeamSelectionMatch {
  const sideStatus = status ?? overrides.status ?? 'NOT_STARTED'
  return {
    matchId: 'match-1',
    matchDate: '2026-10-17T10:00:00',
    dayPart: 'MORNING',
    label: 'Riverside Vets A v Oakfield CC',
    venue: 'Riverside Oval',
    seasonId: 's-now',
    leagueId: 'lg-1',
    leagueName: 'Over 40 League',
    upcoming: true,
    status: sideStatus,
    sides: [makeSide({ status: sideStatus, announced: sideStatus === 'ANNOUNCED' })],
    ...overrides,
  }
}

export function makeOverview(matches: TeamSelectionMatch[]): TeamSelectionOverview {
  const count = (status: TeamSelectionStatus) => matches.filter((match) => match.status === status).length
  return {
    matches,
    players: [],
    counts: {
      upcoming: matches.filter((match) => match.upcoming).length,
      notStarted: count('NOT_STARTED'),
      inProgress: count('IN_PROGRESS'),
      readyToAnnounce: count('READY_TO_ANNOUNCE'),
      announced: count('ANNOUNCED'),
    },
    truncated: false,
  }
}

// One match per status, for the Matches view tests and the table story.
export function sampleMatches(): TeamSelectionMatch[] {
  return [
    makeMatch({ matchId: 'm-1', matchDate: '2026-10-17T10:00:00' }, 'NOT_STARTED'),
    makeMatch(
      {
        matchId: 'm-2',
        matchDate: '2026-10-18T10:00:00',
        sides: [makeSide({ sideId: 'side-2', teamId: 'team-2', teamName: 'Riverside Vets B', opponentName: 'Hillside CC', status: 'IN_PROGRESS', pickedCount: 7 })],
      },
      'IN_PROGRESS',
    ),
    makeMatch(
      {
        matchId: 'm-3',
        matchDate: '2026-10-24T10:00:00',
        sides: [makeSide({ sideId: 'side-3', opponentName: 'Lakeside CC', home: false, status: 'READY_TO_ANNOUNCE', pickedCount: 12, placesFilled: true })],
      },
      'READY_TO_ANNOUNCE',
    ),
    makeMatch(
      {
        matchId: 'm-4',
        matchDate: '2026-10-25T10:00:00',
        leagueId: null,
        leagueName: null,
        sides: [makeSide({ sideId: 'side-4', opponentName: 'Parkside CC', status: 'ANNOUNCED', announced: true, pickedCount: 12, placesFilled: true })],
      },
      'ANNOUNCED',
    ),
  ]
}

export function makeCell(overrides: Partial<TeamSelectionCell> = {}): TeamSelectionCell {
  return { matchId: 'match-1', teamId: 'team-1', sideId: 'side-1', picked: false, pickable: true, reasonCode: null, ...overrides }
}

export function makePlayer(playerId: string, firstName: string, lastName: string, cells: TeamSelectionCell[]): TeamSelectionPlayer {
  return { playerId, firstName, lastName, pickedCount: cells.filter((cell) => cell.picked).length, cells }
}
