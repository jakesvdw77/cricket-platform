import type { LeaderboardBoardInfo, LeaderboardFigure, LeaderboardFilters, LeaderboardRow } from '../../../api/leaderboardApi'
import { isBowlingSample } from '../../../api/leaderboardApi'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import { ballsToOvers } from '../../../utils/oversFormat'

// docs/specs/103-player-stats.md (Leaderboards): display helpers only. Ranks, figures and samples are decided by the server;
// these functions choose decimals, add a star or a slash, and turn null into a dash. Nothing here computes a statistic.

const TWO_DECIMALS = new Set(['BATTING_AVERAGE', 'STRIKE_RATE', 'BOWLING_AVERAGE', 'ECONOMY_RATE'])
const ONE_DECIMAL = new Set(['BOWLING_STRIKE_RATE'])

export function figureText(boardCode: string, figure: LeaderboardFigure): string {
  if (figure === null || figure === undefined) return NOT_ON_FILE
  if (typeof figure === 'number') {
    if (TWO_DECIMALS.has(boardCode)) return figure.toFixed(2)
    if (ONE_DECIMAL.has(boardCode)) return figure.toFixed(1)
    return String(figure)
  }
  if ('wickets' in figure) return `${figure.wickets}/${figure.runs}`
  return `${figure.runs}${figure.notOut ? '*' : ''}`
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

// "12 matches, 11 innings" (innings only on batting and bowling boards).
export function supportingLine(row: LeaderboardRow): string {
  const matches = plural(row.matches, 'match', 'matches')
  return row.innings === null || row.innings === undefined ? matches : `${matches}, ${row.innings} innings`
}

// The sample behind a rate figure: "3 innings, 41 balls" or "4.2 overs, 2 wickets". Mixed over lengths show balls.
export function sampleLine(row: LeaderboardRow): string | null {
  const sample = row.sample
  if (!sample) return null
  if (isBowlingSample(sample)) {
    const balls = sample.balls ?? 0
    const first = sample.overs === null || sample.overs === undefined ? plural(balls, 'ball') : `${ballsToOvers(balls, sample.ballsPerOver ?? undefined)} overs`
    return `${first}, ${plural(sample.wickets ?? 0, 'wicket')}`
  }
  return `${sample.innings ?? 0} innings, ${plural(sample.ballsFaced ?? 0, 'ball')}`
}

// "v Riverside, 14 Mar" for the single-innings boards.
export function matchLine(row: LeaderboardRow): string | null {
  const detail = row.detail
  if (!detail) return null
  const date = new Date(detail.matchDate)
  const dateText = Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const parts = [detail.opponent ? `v ${detail.opponent}` : null, dateText].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}

// The rank cell: the number, or a dash for the unranked group.
export function rankText(rank: number | null): string {
  return rank === null || rank === undefined ? NOT_ON_FILE : String(rank)
}

// What the unranked group is called on a board ("Not ranked: no dismissals yet").
export function unrankedReason(board: Pick<LeaderboardBoardInfo, 'code'>): string {
  return board.code === 'BATTING_AVERAGE' ? 'no dismissals yet' : 'no wickets yet'
}

export function minimumLabel(board: Pick<LeaderboardBoardInfo, 'minimumKind'>): string {
  return board.minimumKind === 'OVERS' ? 'Minimum overs' : 'Minimum innings'
}

// One line for a leader on the Awards view: the figure and what stands behind it ("412 runs · 14 innings").
export function awardLine(board: LeaderboardBoardInfo, row: LeaderboardRow): string {
  const figure = figureText(board.code, row.figure)
  const counting = board.minimumKind === 'NONE' && typeof row.figure === 'number'
  const head = counting && board.figureLabel ? `${figure} ${board.figureLabel.toLowerCase()}` : figure
  const tail = sampleLine(row) ?? matchLine(row) ?? (row.innings !== null && row.innings !== undefined ? plural(row.innings, 'innings', 'innings') : null)
  return tail ? `${head} · ${tail}` : head
}

// The grid of a board row and its header row (Rank, Player, figure, and from sm the sample).
export const BOARD_COLUMNS = { xs: '40px minmax(0, 1fr) auto', sm: '56px minmax(0, 1fr) 120px minmax(160px, 240px)' }

// Season, League, Team and Section ride along as query params. An empty value means "none" (so an All seasons board opens the
// stats page on All seasons instead of the saved season).
export function statsLink(playerId: string, filters: LeaderboardFilters): string {
  const params = new URLSearchParams()
  params.set('seasonId', filters.seasonId ?? '')
  params.set('leagueId', filters.leagueId ?? '')
  params.set('teamId', filters.teamId ?? '')
  params.set('sectionId', filters.sectionId ?? '')
  return `/manage/players/${playerId}/stats?${params.toString()}`
}

