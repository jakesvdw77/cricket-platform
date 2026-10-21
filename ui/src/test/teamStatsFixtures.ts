import { AxiosError } from 'axios'
import type {
  TeamFormItem,
  TeamNetRunRateStatus,
  TeamStatsCell,
  TeamStatsColumn,
  TeamStatsFilterOptions,
  TeamStatsPageData,
  TeamStatsTable,
  TeamStatsTableBasis,
  TeamStatsTableRow,
} from '../api/teamStatsApi'

// docs/specs/116-team-stats.md: fixtures for the Teams tab and the team page tests. The api modules talk to axiosConfig, so a test
// mocks that one module and routes by url with teamStatsApi; the real hooks, query keys, paging and param building are then
// exercised. The "server" here only echoes what a real one would decide (rank, direction, applies); it computes no statistic.

const col = (code: string, label: string, over: Partial<TeamStatsColumn> = {}): TeamStatsColumn => ({
  code, label, sortable: true, direction: 'HIGHEST', minimumKind: 'NONE', ...over,
})
const RATE = { minimumKind: 'MATCHES' as const }

export const NRR_HELP = 'Shown for one league in one season; an all-out innings counts at the full overs.'

// The 15 columns in display order, as the server sends them.
export const TEAM_COLUMNS: TeamStatsColumn[] = [
  col('played', 'P', { longLabel: 'Matches played' }),
  col('won', 'W', { longLabel: 'Wins' }),
  col('lost', 'L', { longLabel: 'Losses', direction: 'LOWEST' }),
  col('tied', 'T', { longLabel: 'Ties' }),
  col('drawn', 'D', { longLabel: 'Draws' }),
  col('noResult', 'NR', { longLabel: 'No results' }),
  col('winPercent', 'Win %', { longLabel: 'Win percentage', ...RATE }),
  col('runs', 'Runs', { longLabel: 'Runs scored' }),
  col('battingAverage', 'Avg', { longLabel: 'Team batting average', ...RATE }),
  col('runRate', 'RR', { longLabel: 'Run rate', ...RATE }),
  col('highTotal', 'High', { longLabel: 'Highest total' }),
  col('wicketsTaken', 'Wkts', { longLabel: 'Wickets taken' }),
  col('bowlingAverage', 'Bowl avg', { longLabel: 'Team bowling average', direction: 'LOWEST', ...RATE }),
  col('economy', 'Econ', { longLabel: 'Team economy rate', direction: 'LOWEST', ...RATE }),
  col('netRunRate', 'NRR', { longLabel: 'Net run rate', help: NRR_HELP, ...RATE }),
]

export const TEAM_FILTER_OPTIONS: TeamStatsFilterOptions = {
  seasonIds: ['season-1', 'season-2'], leagueIds: ['league-1'], sectionIds: ['u15a'], competitions: ['LEAGUE', 'FRIENDLY'],
}

export const num = (value: number | null, over: Partial<TeamStatsCell> = {}): TeamStatsCell => ({ value, ...over })
export const nrrShown = (value: number): TeamStatsCell => ({ value, status: 'SHOWN', rule: 'FULL_QUOTA', matchesUsed: 8, matchesCounted: 11 })
export const nrrHidden = (status: Exclude<TeamNetRunRateStatus, 'SHOWN'>): TeamStatsCell => ({
  value: null, status, rule: 'FULL_QUOTA', matchesUsed: 0, matchesCounted: 3,
})
export const highTotal = (runs: number | null, wickets: number | null): TeamStatsCell => ({ value: runs, runs, wickets })

// One table row: 10 played, 7 won, 2 lost, with figures for every column (override any `values` entry).
export function makeTeamRow(over: Partial<TeamStatsTableRow> & { id?: string } = {}): TeamStatsTableRow {
  const { id = 't1', ...rest } = over
  return {
    rank: 1,
    teamId: id,
    teamName: `Villagers ${id}`,
    sectionName: 'Seniors',
    active: true,
    values: {
      played: num(10), won: num(7), lost: num(2), tied: num(1), drawn: num(0), noResult: num(0),
      winPercent: num(77.8), runs: num(1842), battingAverage: num(24.56), runRate: num(5.12), highTotal: highTotal(212, 6),
      wicketsTaken: num(61), bowlingAverage: num(21.3), economy: num(4.87), netRunRate: nrrShown(0.84),
      ...rest.values,
    },
    ...rest,
  }
}

export function makeTeamBasis(over: Partial<TeamStatsTableBasis> = {}): TeamStatsTableBasis {
  return { resultsCounted: 12, internalResults: 0, resultsNoBallBowled: 0, forfeits: 0, teamsListed: 2, teamsRanked: 2, belowMinimum: 0, ...over }
}

export function makeTeamTable(over: Partial<TeamStatsTable> = {}): TeamStatsTable {
  const rows = over.rows ?? [makeTeamRow({ id: 't1', rank: 1 }), makeTeamRow({ id: 't2', rank: 2 })]
  return {
    columns: TEAM_COLUMNS,
    sort: { code: 'won', direction: 'HIGHEST' },
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, sectionId: null, competition: null },
    minimum: { applies: false, value: null, unit: 'MATCHES' },
    basis: makeTeamBasis({ teamsListed: rows.length, teamsRanked: rows.length }),
    page: { number: 0, size: 25, totalElements: rows.length, hasMore: false },
    rows,
    ...over,
  }
}

// ---- The team page ----

export function makeForm(n: number, over: Partial<TeamFormItem> = {}): TeamFormItem {
  return {
    matchId: `match-${n}`, resultId: `result-${n}`, matchDate: '2026-03-14T12:00:00Z', opponentName: `Opponent ${n}`,
    derby: false, result: 'WON', forfeit: false, ...over,
  }
}

const ref = (n: number, opponentName: string | null = `Opponent ${n}`) => ({ matchId: `match-${n}`, matchDate: '2026-03-14T12:00:00Z', opponentName })
const coverage = (recorded: number, counted: number) => ({ inningsRecorded: recorded, inningsCounted: counted })

// A team with full data: 14 played (9 won, 4 lost, 1 tied), every figure present, NRR shown.
export function makeTeamStats(over: Partial<TeamStatsPageData> = {}): TeamStatsPageData {
  return {
    teamId: 'team-1',
    teamName: 'Villagers 1',
    sectionId: 'section-1',
    active: true,
    scope: { kind: 'CLUB_VERIFIED', seasonId: null, leagueId: null, competition: null },
    basis: { resultsCounted: 14, internalResults: 0, resultsNoBallBowled: 0, forfeits: { received: 0, conceded: 0 }, resultsWithBothInnings: 14 },
    record: { played: 14, won: 9, lost: 4, tied: 1, drawn: 0, noResult: 0, decisive: 13, winPercent: 69.2 },
    form: [makeForm(1), makeForm(2, { result: 'LOST' }), makeForm(3, { result: 'TIED' }), makeForm(4, { result: 'DRAWN' }), makeForm(5, { result: 'NO_RESULT' })],
    batting: {
      runs: 1842, wicketsLost: 75, innings: 14, runsPerInnings: 131.57, battingAverage: 24.56, runRate: 5.12, ballsFaced: 2160,
      highestTotal: { ...ref(1, 'Riverside'), runs: 212, wickets: 6, allOut: false },
      lowestTotal: { ...ref(2, 'Hilltop'), runs: 88, wickets: 10, allOut: true },
      coverage: { inningsUsable: 14, inningsCounted: 14, inningsClassifiable: 14 },
    },
    chasing: {
      highestSuccessfulChase: { ...ref(3, 'Lakeside'), runs: 187, target: 186, wickets: 4 },
      largestVictoryByRuns: { ...ref(4, 'Northside'), margin: 96 },
      largestVictoryByWickets: { ...ref(5, 'Southside'), margin: 9, ballsRemaining: 30 },
    },
    bowling: {
      wicketsTaken: 120, runsConceded: 1900, ballsBowled: 2100, bowlingAverage: 15.83, economy: 5.43,
      coverage: { inningsUsable: 14, inningsCounted: 14 },
    },
    extras: {
      conceded: 210, averagePerMatch: 15, wides: 90, noBalls: 20, byes: 40, legByes: 50, penaltyRuns: 10,
      coverage: { inningsWithExtras: 14, inningsCounted: 14 },
      componentCoverage: { wides: coverage(14, 14), noBalls: coverage(14, 14), byes: coverage(14, 14), legByes: coverage(14, 14), penaltyRuns: coverage(14, 14) },
    },
    netRunRate: { status: 'SHOWN', value: 0.84, rule: 'FULL_QUOTA', matchesUsed: 8, matchesCounted: 11, leagueId: 'league-1', seasonId: 'season-1' },
    notCaptured: [{ code: 'PARTNERSHIPS', label: 'Partnerships (runs by wicket)', reason: 'The scorecard does not record the fall of wickets.' }],
    ...over,
  }
}

// ---- The routed fake server ----

export interface TeamStatsServer {
  options: TeamStatsFilterOptions | Error
  // Per request; default echoes the sort (400 for a code that is not a team column), direction and minimum like the real server.
  table: (params: Record<string, unknown>) => TeamStatsTable | Error
  // Per team page request; default is makeTeamStats() for the requested id.
  page: (teamId: string, params: Record<string, unknown>) => TeamStatsPageData | Error
  // the params of every request so far
  tableCalls: Record<string, unknown>[]
  pageCalls: { teamId: string; params: Record<string, unknown> }[]
  optionCalls: number
}

export const badRequest = () =>
  new AxiosError('Request failed with status code 400', 'ERR_BAD_REQUEST', undefined, undefined, { status: 400, data: {}, statusText: 'Bad Request', headers: {}, config: {} } as never)

export function defaultTeamStatsServer(): TeamStatsServer {
  return {
    options: TEAM_FILTER_OPTIONS,
    table: (params) => {
      const code = String(params.sort)
      const column = TEAM_COLUMNS.find((entry) => entry.code === code)
      if (!column) return badRequest()
      const direction = params.direction === 'asc' ? 'LOWEST' : params.direction === 'desc' ? 'HIGHEST' : column.direction
      return makeTeamTable({
        sort: { code, direction },
        minimum: { applies: column.minimumKind !== 'NONE', value: (params.minimum as number | undefined) ?? null, unit: 'MATCHES' },
      })
    },
    page: (teamId) => makeTeamStats({ teamId }),
    tableCalls: [],
    pageCalls: [],
    optionCalls: 0,
  }
}

// An axiosConfig.get routed over the team-stats urls of one TeamStatsServer. `fallback` answers every other url (for example the
// player leaderboard server when a test switches tab).
export function teamStatsApi(server: TeamStatsServer, fallback?: (url: string, config?: unknown) => Promise<unknown>) {
  const respond = async (value: unknown) => {
    if (value instanceof Error) throw value
    return { data: value }
  }
  return {
    get: async (url: string, config?: { params?: Record<string, unknown> }) => {
      const params = config?.params ?? {}
      if (url.endsWith('/team-stats/filter-options')) {
        server.optionCalls += 1
        return respond(server.options)
      }
      if (url.endsWith('/team-stats')) {
        server.tableCalls.push(params)
        return respond(server.table(params))
      }
      const page = /\/teams\/([^/]+)\/stats$/.exec(url)
      if (page) {
        server.pageCalls.push({ teamId: page[1], params })
        return respond(server.page(page[1], params))
      }
      if (fallback) return fallback(url, config)
      throw new Error(`unrouted GET ${url}`)
    },
  }
}
