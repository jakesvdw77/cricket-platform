import type {
  AwardsView,
  LeaderboardBoardInfo,
  LeaderboardCatalogue,
  LeaderboardColumn,
  LeaderboardFilterOptions,
  LeaderboardTable,
  LeaderboardTableRow,
} from '../api/leaderboardApi'

// docs/specs/103-player-stats.md: fixtures for the Leaderboards tests. The api modules talk to axiosConfig, so a test mocks that
// one module and routes by url with leaderboardGet; the real hooks, query keys and param building are then exercised.

const col = (code: string, label: string, over: Partial<LeaderboardColumn> = {}): LeaderboardColumn => ({
  code, label, sortable: true, direction: 'HIGHEST', minimumKind: 'NONE', ...over,
})

export const BATTING_COLUMNS: LeaderboardColumn[] = [
  col('matches', 'M', { longLabel: 'Matches', sortable: false }),
  col('runs', 'Runs', { longLabel: 'Runs scored' }),
  col('average', 'Avg', { longLabel: 'Batting average', minimumKind: 'INNINGS' }),
  col('strikeRate', 'SR', { longLabel: 'Batting strike rate', minimumKind: 'INNINGS' }),
  col('highestScore', 'HS', { longLabel: 'Highest score' }),
]
export const BOWLING_COLUMNS: LeaderboardColumn[] = [
  col('wickets', 'Wkts', { longLabel: 'Wickets taken' }),
  col('economy', 'Econ', { longLabel: 'Economy rate', direction: 'LOWEST', minimumKind: 'OVERS' }),
  col('overs', 'Ov', { longLabel: 'Overs bowled', sortable: false }),
  col('dots', 'Dots', { longLabel: 'Dot balls' }),
  col('best', 'Best', { longLabel: 'Best bowling' }),
]
export const FIELDING_COLUMNS: LeaderboardColumn[] = [col('total', 'Total', { longLabel: 'Total dismissals' }), col('catches', 'Ct', { longLabel: 'Catches' })]

const board = (code: string, label: string, over: Partial<LeaderboardBoardInfo> = {}): LeaderboardBoardInfo => ({
  code, group: 'BATTING', label, figureLabel: label, direction: 'HIGHEST', minimumKind: 'NONE', help: '', awardEligible: true, awardDefault: true, ...over,
})

export const AWARD_BOARDS: LeaderboardBoardInfo[] = [
  board('MOST_RUNS', 'Most runs', { figureLabel: 'Runs' }),
  board('BATTING_AVERAGE', 'Batting average', { minimumKind: 'INNINGS', figureLabel: 'Average' }),
  board('ECONOMY_RATE', 'Economy rate', { group: 'BOWLING', direction: 'LOWEST', minimumKind: 'OVERS', figureLabel: 'Economy' }),
  board('MOST_SIXES', 'Most sixes', { awardDefault: false, figureLabel: 'Sixes' }),
]

export const CATALOGUE: LeaderboardCatalogue = {
  groups: [
    { group: 'BATTING', label: 'Batting', code: 'batting', defaultSort: 'runs', boards: [], columns: BATTING_COLUMNS },
    { group: 'BOWLING', label: 'Bowling', code: 'bowling', defaultSort: 'wickets', boards: [], columns: BOWLING_COLUMNS },
    { group: 'FIELDING', label: 'Fielding', code: 'fielding', defaultSort: 'total', boards: [], columns: FIELDING_COLUMNS },
    { group: 'AWARDS', label: 'Awards', code: null, defaultSort: null, boards: AWARD_BOARDS, columns: [] },
  ],
}

export const FILTER_OPTIONS: LeaderboardFilterOptions = {
  seasonIds: ['season-1'], leagueIds: ['league-1'], teamIds: ['team-1'], sectionIds: ['u15a'], competitions: ['LEAGUE'],
}

export const num = (value: number | null) => ({ value, runs: null, wickets: null, notOut: null })

export function tableRow(over: Partial<LeaderboardTableRow> & { id?: string } = {}): LeaderboardTableRow {
  const { id = 'p1', ...rest } = over
  return {
    rank: 1, playerId: id, firstName: 'Sam', lastName: `Visser ${id}`, active: true, teamName: null, smallSample: false,
    values: { matches: num(10), runs: num(412), average: num(29.43), strikeRate: num(96.3), highestScore: { value: null, runs: 94, wickets: null, notOut: true } },
    ...rest,
  }
}

export function makeTable(over: Partial<LeaderboardTable> = {}, group: 'BATTING' | 'BOWLING' | 'FIELDING' = 'BATTING'): LeaderboardTable {
  const columns = group === 'BATTING' ? BATTING_COLUMNS : group === 'BOWLING' ? BOWLING_COLUMNS : FIELDING_COLUMNS
  const rows = over.rows ?? [tableRow({ id: 'p1', rank: 1 }), tableRow({ id: 'p2', rank: 2 })]
  return {
    group,
    columns,
    sort: { code: columns.find((c) => c.sortable)?.code ?? 'runs', direction: 'HIGHEST' },
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, teamId: null, sectionId: null },
    minimum: { applies: false, value: null, suggestedDefault: null, unit: 'NONE' },
    basis: { resultsCounted: 12, playersListed: rows.length, playersRanked: rows.length, belowMinimum: 0, coverage: null },
    page: { number: 0, size: 10, totalElements: rows.length, hasMore: false },
    rows,
    ...over,
  }
}

export function makeAwards(over: Partial<AwardsView> = {}): AwardsView {
  const leader = (id: string, first: string, last: string, figure: number) => ({
    rank: 1, playerId: id, firstName: first, lastName: last, active: true, figure, matches: 10, innings: 8, sample: null, smallSample: false, detail: null,
  })
  return {
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, teamId: null, sectionId: null },
    basis: { resultsCounted: 12, playersConsidered: 21 },
    minimums: { innings: 3, overs: 8, defaultInnings: 3, defaultOvers: 8 },
    categories: [{ board: AWARD_BOARDS[0], leaders: [leader('p1', 'Sam', 'Visser', 412)] }],
    omitted: [],
    ...over,
  }
}

export interface LeaderboardServer {
  catalogue: LeaderboardCatalogue
  options: LeaderboardFilterOptions | Error
  table: (group: string, params: Record<string, unknown>) => LeaderboardTable | Error
  awards: (params: Record<string, unknown>) => AwardsView | Error
  settings: { awardCategories: string[]; selectableCategories: string[] }
  puts: unknown[]
}

export function defaultServer(): LeaderboardServer {
  return {
    catalogue: CATALOGUE,
    options: FILTER_OPTIONS,
    // echoes the requested direction the way the server does: asc = LOWEST, desc = HIGHEST, else the column's natural one
    table: (group, params) => {
      const g = group.toUpperCase() as 'BATTING' | 'BOWLING' | 'FIELDING'
      const columns = g === 'BATTING' ? BATTING_COLUMNS : g === 'BOWLING' ? BOWLING_COLUMNS : FIELDING_COLUMNS
      const code = String(params.sort)
      const natural = columns.find((c) => c.code === code)?.direction ?? 'HIGHEST'
      const direction = params.direction === 'asc' ? 'LOWEST' : params.direction === 'desc' ? 'HIGHEST' : natural
      return makeTable({ sort: { code, direction } }, g)
    },
    awards: () => makeAwards(),
    settings: { awardCategories: ['MOST_RUNS', 'BATTING_AVERAGE', 'ECONOMY_RATE'], selectableCategories: ['MOST_RUNS', 'BATTING_AVERAGE', 'ECONOMY_RATE', 'MOST_SIXES'] },
    puts: [],
  }
}

// An axiosConfig.get / put pair routed over the leaderboard urls of one LeaderboardServer.
export function leaderboardApi(server: LeaderboardServer) {
  const respond = async (value: unknown) => {
    if (value instanceof Error) throw value
    return { data: value }
  }
  return {
    get: async (url: string, config?: { params?: Record<string, unknown> }) => {
      const params = config?.params ?? {}
      if (url.endsWith('/leaderboard-settings')) return respond(server.settings)
      if (url.endsWith('/leaderboards/filter-options')) return respond(server.options)
      if (url.endsWith('/leaderboards/awards')) return respond(server.awards(params))
      const board = /\/leaderboards\/(batting|bowling|fielding)$/.exec(url)
      if (board) return respond(server.table(board[1], params))
      if (url.endsWith('/leaderboards')) return respond(server.catalogue)
      throw new Error(`unrouted GET ${url}`)
    },
    put: async (_url: string, body: { awardCategories: string[] }) => {
      server.puts.push(body)
      server.settings = { ...server.settings, awardCategories: body.awardCategories }
      return { data: server.settings }
    },
  }
}
