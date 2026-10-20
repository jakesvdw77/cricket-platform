import type {
  PlayerMatchList,
  PlayerMatchRow,
  PlayerStats,
  PlayerStatsFilterOptions,
} from '../api/playerStatsApi'

// docs/specs/115-player-match-list.md: fixtures for the Matches tab tests. The api modules talk to axiosConfig, so a test mocks that
// one module and routes by url with playerMatchesApi; the real hooks, query keys, paging and param building are then exercised.

const innings = (over: Partial<NonNullable<PlayerMatchRow['batting']['innings']>[number]> = {}) => ({
  runs: 56, balls: 41, notOut: false, howOut: 'CAUGHT' as const, fours: 6, sixes: 1, ...over,
})

export const NO_FIGURES = {
  batting: { status: 'NO_CARD' as const },
  bowling: { status: 'NO_CARD' as const },
  fielding: { status: 'NO_CARD' as const },
}

// A full-scorecard match: 56 off 41 (caught), 2/21 off 4.0 overs, one catch.
export function makeMatchRow(over: Partial<PlayerMatchRow> & { n?: number } = {}): PlayerMatchRow {
  const { n = 1, ...rest } = over
  return {
    matchId: `match-${n}`,
    resultId: `result-${n}`,
    matchDate: '2026-03-14T12:00:00Z',
    ourTeams: [{ side: 'HOME', teamId: 'team-1', teamName: 'Villagers 1' }],
    opponentName: 'Riverside',
    derby: false,
    leagueId: 'league-1',
    leagueName: 'Premier League',
    competition: 'LEAGUE',
    result: 'WON',
    ballsPerOver: 6,
    hasBattingCard: true,
    hasBowlingCard: true,
    batting: { status: 'BATTED', innings: [innings()], inningsCount: 1, runs: 56, ballsFaced: 41, fours: 6, sixes: 1 },
    bowling: {
      status: 'BOWLED',
      spells: [{ balls: 24, maidens: 1, runs: 21, wickets: 2, dots: 8, wides: null, noBalls: null }],
      balls: 24, maidens: 1, runs: 21, wickets: 2, dots: 8,
    },
    fielding: { status: 'RECORDED', catches: 1, stumpings: 0, runOuts: 0 },
    awards: { playerOfTheMatch: 0, teamPlayerOfTheMatch: 0 },
    ...rest,
  }
}

export const noScorecardRow = (n = 1, over: Partial<PlayerMatchRow> = {}) =>
  makeMatchRow({ n, hasBattingCard: false, hasBowlingCard: false, ...NO_FIGURES, ...over })

// n distinct matches, newest first (the server's default order), each on its own day.
export function makeRows(count: number): PlayerMatchRow[] {
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1
    const day = String(28 - Math.min(index, 27)).padStart(2, '0')
    return makeMatchRow({ n, opponentName: `Opponent ${n}`, matchDate: `2026-03-${day}T12:00:00Z` })
  })
}

export function makeStats(over: Partial<PlayerStats['basis']> = {}, extra: Record<string, unknown> = {}): PlayerStats {
  return {
    playerId: 'player-1',
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, teamId: null, competition: null },
    basis: { matchesCounted: 18, resultsWithBattingCard: 14, resultsWithBowlingCard: 12, ...over },
    batting: { matches: 18, innings: 14, runs: 412, ballsFaced: 428, fours: 38, sixes: 6, highestScore: { runs: 94, notOut: true }, dismissalModes: {}, positions: [], average: 29.43, strikeRate: 96.3 },
    bowling: { inningsBowled: 12, ballsBowled: 368, ballsPerOver: [6], mixedOverLengths: false, runsConceded: 298, wickets: 21, maidens: 4, dots: 0, best: { wickets: 4, runs: 17 }, dismissalModes: {} },
    fielding: { catches: 9, stumpings: 0, runOuts: 2, dismissals: 11, dismissalsPerMatch: 0.61 },
    awards: { playerOfTheMatch: 4, teamPlayerOfTheMatch: 2 },
    record: { won: 11, lost: 6, tied: 1, drawn: 0, internal: 0 },
    form: { batting: [], bowling: [] },
    notCaptured: [],
    ...extra,
  } as unknown as PlayerStats
}

export const FILTER_OPTIONS: PlayerStatsFilterOptions = {
  seasonIds: ['season-1', 'season-2'], leagueIds: ['league-1'], teamIds: ['team-1'], sectionIds: ['u15a'], competitions: ['LEAGUE', 'FRIENDLY'],
}

export interface MatchesServer {
  // the whole list under the current (ignored) filters, newest first
  rows: PlayerMatchRow[]
  stats: PlayerStats | Error
  // Override to answer differently per request (for example to change rows with the seasonId param); default pages `rows`.
  matches: (params: Record<string, unknown>) => PlayerMatchList | Error
  // the params of every matches request so far
  calls: Record<string, unknown>[]
}

export function pageOf(rows: PlayerMatchRow[], params: Record<string, unknown>): PlayerMatchList {
  const size = Number(params.size ?? 20)
  const page = Number(params.page ?? 0)
  const ordered = params.direction === 'asc' ? [...rows].reverse() : rows
  const slice = ordered.slice(page * size, page * size + size)
  return {
    playerId: 'player-1',
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, teamId: null, competition: null },
    page: { number: page, size, totalElements: rows.length, hasMore: (page + 1) * size < rows.length },
    rows: slice,
  }
}

export function defaultMatchesServer(rows: PlayerMatchRow[] = makeRows(3)): MatchesServer {
  const server: MatchesServer = {
    rows,
    stats: makeStats({ matchesCounted: rows.length }),
    matches: (params) => pageOf(server.rows, params),
    calls: [],
  }
  return server
}

// An axiosConfig.get routed over the player stats urls of one MatchesServer.
export function playerMatchesApi(server: MatchesServer) {
  const respond = async (value: unknown) => {
    if (value instanceof Error) throw value
    return { data: value }
  }
  return {
    get: async (url: string, config?: { params?: Record<string, unknown> }) => {
      const params = config?.params ?? {}
      if (url.endsWith('/stats/matches')) {
        server.calls.push(params)
        return respond(server.matches(params))
      }
      if (url.endsWith('/stats/filter-options')) return respond(FILTER_OPTIONS)
      if (url.endsWith('/stats')) return respond(server.stats)
      throw new Error(`unrouted GET ${url}`)
    },
  }
}
