import { keepPreviousData, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query'
import api from './axiosConfig'
import { myPlayersKey } from './myPlayersApi'

// docs/specs/145 (Player Hub Results): the held player's results that a manager has shown in the Player Hub.
// Backend: GET /api/v1/me/players/{playerKey}/results[/summary|/filters|/{matchId}], authorised by the caller's own active link.

export type MyResultCompetition = 'LEAGUE' | 'FRIENDLY'
export type MyResultOutcome = 'WON' | 'LOST' | 'TIED' | 'DRAWN' | 'NO_RESULT' | 'ABANDONED' | 'INTERNAL'
export type MyResultDismissal =
  | 'NOT_OUT'
  | 'BOWLED'
  | 'CAUGHT'
  | 'CAUGHT_AND_BOWLED'
  | 'LBW'
  | 'STUMPED'
  | 'RUN_OUT'
  | 'HIT_WICKET'
  | 'HANDLED_BALL'
  | 'OBSTRUCTING_FIELD'
  | 'HIT_BALL_TWICE'
  | 'TIMED_OUT'
  | 'RETIRED_NOT_OUT'
  | 'RETIRED_OUT'

export interface MyResultScope {
  seasonId?: string | null
  teamId?: string | null
  leagueId?: string | null
  // A "Friendly" chip sends FRIENDLY and no leagueId.
  competition?: MyResultCompetition | null
}

export interface MyResultOurTeam {
  side: 'HOME' | 'AWAY'
  teamId?: string | null
  teamName: string
}

export interface MyResultBattingInnings {
  runs: number
  balls: number
  notOut: boolean
  howOut?: MyResultDismissal | null
  fours: number
  sixes: number
}

export interface MyResultBowlingSpell {
  balls: number
  maidens: number
  runs: number
  wickets: number
  dots?: number | null
  wides?: number | null
  noBalls?: number | null
}

export interface MyResultRow {
  matchId: string
  matchDate: string
  ourTeams: MyResultOurTeam[]
  opponentName?: string | null
  derby: boolean
  leagueId?: string | null
  leagueName?: string | null
  competition: MyResultCompetition
  result: MyResultOutcome
  homeName: string
  awayName: string
  homeScore: string
  awayScore: string
  resultLine?: string | null
  ballsPerOver: number
  hasBattingCard: boolean
  hasBowlingCard: boolean
  batting: {
    status: 'NO_CARD' | 'DID_NOT_BAT' | 'BATTED'
    innings?: MyResultBattingInnings[] | null
    inningsCount: number
    runs: number
    ballsFaced: number
    fours: number
    sixes: number
  }
  bowling: {
    status: 'NO_CARD' | 'DID_NOT_BOWL' | 'BOWLED'
    spells?: MyResultBowlingSpell[] | null
    balls: number
    maidens: number
    runs: number
    wickets: number
    dots: number
  }
  fielding: { status: 'NO_CARD' | 'RECORDED'; catches: number; stumpings: number; runOuts: number }
  awards: { playerOfTheMatch: number; teamPlayerOfTheMatch: number }
}

export interface MyResultList {
  scope: MyResultScope
  page: { number: number; size: number; totalElements: number; hasMore: boolean }
  rows: MyResultRow[]
}

export interface MyResultSummary {
  scope: MyResultScope
  matches: number
  won: number
  lost: number
  tied: number
  drawn: number
  internal: number
  runs: number
  wickets: number
  catches: number
  playerOfTheMatch: number
  highestScore?: { runs: number; notOut: boolean } | null
  bestBowling?: { wickets: number; runs: number } | null
  lastFive: MyResultRow[]
}

export interface MyResultFilters {
  currentSeasonId?: string | null
  seasons: { id: string; name: string }[]
  teams: { id: string; name: string }[]
  leagues: { id: string; name: string }[]
  // The distinct season, league and team combinations of the shown results (leagueId null is a friendly), so the League then Team
  // cascade needs no extra request.
  combos: { seasonId: string; leagueId: string | null; teamId: string }[]
}

export interface MyResultBatter {
  name: string
  mine: boolean
  position: number
  howOut?: MyResultDismissal | null
  bowler?: string | null
  fielder?: string | null
  runs: number
  balls: number
  fours: number
  sixes: number
}

export interface MyResultBowler {
  name: string
  mine: boolean
  overs: string
  maidens: number
  runs: number
  wickets: number
  wides: number
  noBalls: number
  dots: number
}

export interface MyResultInnings {
  sequence: number
  battingSide: 'HOME' | 'AWAY'
  battingTeamName: string
  runs: number
  wickets: number
  overs: string
  extras: number
  wides: number
  noBalls: number
  byes: number
  legByes: number
  penaltyRuns: number
  batting: MyResultBatter[]
  didNotBat: string[]
  bowling: MyResultBowler[]
}

export interface MyResultDetail {
  mine: MyResultRow
  venue?: string | null
  innings: MyResultInnings[]
  awards: { type: 'PLAYER_OF_MATCH' | 'TEAM_PLAYER_OF_MATCH'; side?: 'HOME' | 'AWAY' | null; playerName: string }[]
}

export const RESULTS_PAGE_SIZE = 20

const params = (scope: MyResultScope) => ({
  ...(scope.seasonId ? { seasonId: scope.seasonId } : {}),
  ...(scope.teamId ? { teamId: scope.teamId } : {}),
  ...(scope.leagueId ? { leagueId: scope.leagueId } : {}),
  ...(scope.competition ? { competition: scope.competition } : {}),
})

export const myResultsKey = (key: string | undefined) => [...myPlayersKey, key, 'results'] as const

export async function getMyPlayerResults(key: string, scope: MyResultScope, page: number): Promise<MyResultList> {
  const { data } = await api.get<MyResultList>(`/me/players/${key}/results`, { params: { ...params(scope), page, size: RESULTS_PAGE_SIZE } })
  return data
}

export async function getMyPlayerResultsSummary(key: string, scope: MyResultScope): Promise<MyResultSummary> {
  const { data } = await api.get<MyResultSummary>(`/me/players/${key}/results/summary`, { params: params(scope) })
  return data
}

export async function getMyPlayerResultsFilters(key: string): Promise<MyResultFilters> {
  const { data } = await api.get<MyResultFilters>(`/me/players/${key}/results/filters`)
  return data
}

export async function getMyPlayerResult(key: string, matchId: string): Promise<MyResultDetail> {
  const { data } = await api.get<MyResultDetail>(`/me/players/${key}/results/${matchId}`)
  return data
}

// The list, page by page: more rows are asked of the server (never sliced in the browser) and flattened by the caller.
export function useMyPlayerResults(key: string | undefined, scope: MyResultScope, enabled = true) {
  return useInfiniteQuery({
    queryKey: [...myResultsKey(key), 'list', params(scope)],
    queryFn: ({ pageParam }) => getMyPlayerResults(key as string, scope, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page.hasMore ? last.page.number + 1 : undefined),
    placeholderData: keepPreviousData,
    retry: false,
    enabled: Boolean(key) && enabled,
  })
}

export function useMyPlayerResultsSummary(key: string | undefined, scope: MyResultScope, enabled = true) {
  return useQuery({
    queryKey: [...myResultsKey(key), 'summary', params(scope)],
    queryFn: () => getMyPlayerResultsSummary(key as string, scope),
    placeholderData: keepPreviousData,
    retry: false,
    enabled: Boolean(key) && enabled,
  })
}

// One summary per scope (the record under each filter chip). The same keys as useMyPlayerResultsSummary, so a scope that is also the
// page's own scope is fetched once.
export function useMyPlayerResultsSummaries(key: string | undefined, scopes: MyResultScope[], enabled = true) {
  return useQueries({
    queries: scopes.map((scope) => ({
      queryKey: [...myResultsKey(key), 'summary', params(scope)],
      queryFn: () => getMyPlayerResultsSummary(key as string, scope),
      retry: false,
      enabled: Boolean(key) && enabled,
    })),
  })
}

export function useMyPlayerResultsFilters(key: string | undefined) {
  return useQuery({
    queryKey: [...myResultsKey(key), 'filters'],
    queryFn: () => getMyPlayerResultsFilters(key as string),
    retry: false,
    enabled: Boolean(key),
  })
}

export function useMyPlayerResult(key: string | undefined, matchId: string | undefined) {
  return useQuery({
    queryKey: [...myResultsKey(key), 'detail', matchId],
    queryFn: () => getMyPlayerResult(key as string, matchId as string),
    retry: false,
    enabled: Boolean(key) && Boolean(matchId),
  })
}
