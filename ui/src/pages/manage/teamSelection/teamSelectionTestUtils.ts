import type {
  TeamSelectionCell,
  TeamSelectionMatch,
  TeamSelectionOverview,
  TeamSelectionPick,
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

export function makePick(
  id: string,
  battingOrder: number | null,
  overrides: Partial<TeamSelectionPick> = {},
): TeamSelectionPick {
  return { playerId: id, firstName: id.charAt(0).toUpperCase() + id.slice(1), lastName: 'Smith', battingOrder, role: 'BATSMAN', captain: false, wicketKeeper: false, twelfthMan: false, ...overrides }
}

// Two matches in one Saturday morning slot plus one on Sunday: m-1 (Ann 1 captain, Bob 2 keeper, Cy 12th man, Dee no
// position), m-2 (nobody picked, no side yet), m-3 (a derby on Sunday afternoon, ready to announce).
export function sampleBoard(): TeamSelectionOverview {
  const m1 = makeMatch(
    {
      matchId: 'm-1',
      label: 'Vets A v Oakfield',
      sides: [
        makeSide({
          pickedCount: 4,
          picks: [
            makePick('bob', 2, { wicketKeeper: true }),
            makePick('ann', 1, { captain: true }),
            makePick('dee', null),
            makePick('cy', null, { twelfthMan: true }),
          ],
        }),
      ],
    },
    'IN_PROGRESS',
  )
  const m2 = makeMatch({ matchId: 'm-2', matchDate: '2026-10-17T11:00:00', label: 'Vets B v Hillside', sides: [makeSide({ sideId: null, teamId: 'team-2', teamName: 'Vets B' })] })
  const m3 = makeMatch(
    {
      matchId: 'm-3',
      matchDate: '2026-10-18T14:00:00',
      dayPart: 'AFTERNOON',
      label: 'Vets A v Vets B',
      sides: [
        makeSide({ sideId: 's-a', teamId: 'team-a', teamName: 'Vets A', status: 'READY_TO_ANNOUNCE', pickedCount: 12, placesFilled: true }),
        makeSide({ sideId: 's-b', teamId: 'team-b', teamName: 'Vets B', home: false, announced: true, status: 'ANNOUNCED', picks: [makePick('eve', 1)], pickedCount: 1 }),
      ],
    },
    'READY_TO_ANNOUNCE',
  )
  return {
    ...makeOverview([m1, m2, m3]),
    players: [
      makePlayer('ann', 'Ann', 'Smith', [makeCell({ matchId: 'm-1', picked: true }), makeCell({ matchId: 'm-2', teamId: 'team-2', sideId: null })]),
      makePlayer('fay', 'Fay', 'Jones', [
        makeCell({ matchId: 'm-1' }),
        makeCell({ matchId: 'm-2', teamId: 'team-2', sideId: null }),
      ]),
      makePlayer('gus', 'Gus', 'Brown', [
        makeCell({ matchId: 'm-1', pickable: false, reasonCode: 'SAID_UNAVAILABLE' }),
        makeCell({ matchId: 'm-2', teamId: 'team-2', sideId: null }),
      ]),
    ],
  }
}
