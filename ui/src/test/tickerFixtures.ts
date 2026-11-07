import type { MyResultRow } from '../api/meResultsApi'
import type { MyPoll } from '../api/myPlayersApi'
import { TICKER_KIND_RULES } from '../pages/view/myPlayers/tickerKindRules'
import type { TickerContext, TickerItem, TickerKind, TickerKindRules } from '../pages/view/myPlayers/tickerTypes'

// docs/specs/146: fixtures for the ticker tests (sources, shuffle, strip, footer).
export const NOW = new Date(2026, 10, 7, 12, 0, 0) // Saturday 7 November 2026, 12:00 local

export const resultRow = (overrides: Partial<MyResultRow> = {}): MyResultRow => ({
  matchId: 'r1',
  matchDate: '2026-11-05',
  ourTeams: [{ side: 'HOME', teamId: 't1', teamName: 'Villagers' }],
  opponentName: 'Rovers',
  derby: false,
  leagueId: 'l1',
  leagueName: 'Over 40',
  competition: 'LEAGUE',
  result: 'WON',
  homeName: 'Villagers',
  awayName: 'Rovers',
  homeScore: '180/4',
  awayScore: '156/9',
  resultLine: 'Villagers beat Rovers by 24 runs',
  ballsPerOver: 6,
  hasBattingCard: true,
  hasBowlingCard: true,
  batting: { status: 'BATTED', innings: [], inningsCount: 1, runs: 46, ballsFaced: 40, fours: 4, sixes: 1 },
  bowling: { status: 'DID_NOT_BOWL', balls: 0, maidens: 0, runs: 0, wickets: 0, dots: 0 },
  fielding: { status: 'RECORDED', catches: 0, stumpings: 0, runOuts: 0 },
  awards: { playerOfTheMatch: 0, teamPlayerOfTheMatch: 0 },
  ...overrides,
})

export const pollRow = (overrides: Partial<MyPoll> = {}): MyPoll => ({
  pollId: 'p1',
  kind: 'SQUAD',
  title: 'Saturday squad',
  teamName: 'Villagers',
  sectionName: null,
  homeName: 'Villagers',
  awayName: 'Eagles',
  matchDate: '2026-11-14',
  venue: 'Main Oval',
  scheduledCloseAt: new Date(2026, 10, 7, 19, 0, 0).toISOString(),
  windows: [],
  answers: [],
  ...overrides,
})

export const ctx = (overrides: Partial<TickerContext> = {}): TickerContext => ({ playerKey: 'k1', firstName: null, now: NOW, routeKey: 'availability', ...overrides })

export const item = (kind: TickerKind, id: string, overrides: Partial<TickerItem> = {}): TickerItem => ({
  kind,
  id,
  parts: [{ type: 'strong', text: `${kind} ${id}` }],
  to: `/account/players/k1/${kind}/${id}`,
  weight: 1,
  ...overrides,
})

// The built kinds plus a synthetic sponsor (1 in 5) and message, as a later kind would register itself.
export const SYNTHETIC_KINDS: Partial<Record<TickerKind, TickerKindRules>> = {
  ...TICKER_KIND_RULES,
  sponsor: { label: 'Sponsor', tone: 'sponsor', defaultWeight: 1, maxPerCycle: 4, maxShare: { inN: 5 } },
  message: { label: 'Message', tone: 'message', defaultWeight: 2, maxPerCycle: 3 },
  funFact: { label: 'Did You Know', tone: 'info', defaultWeight: 1, maxPerCycle: 3 },
}
