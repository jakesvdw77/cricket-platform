import type { LeaderboardBoardInfo, LeaderboardCell, LeaderboardFigure, LeaderboardFilters, LeaderboardRow, MinimumKind } from '../../../api/leaderboardApi'
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

// What the unranked group is called on a table ("Not ranked: no dismissals yet"): the sorted column decides.
export function unrankedReason(group: string, sortCode: string): string {
  if (group.toLowerCase() === 'batting' && sortCode === 'average') return 'no dismissals yet'
  if (group.toLowerCase() === 'bowling') return 'no wickets yet'
  return 'no figure yet'
}

export function minimumLabel(kind: MinimumKind): string {
  return kind === 'OVERS' ? 'Minimum overs' : 'Minimum innings'
}

// One line for a leader on the Awards view: the figure and what stands behind it ("412 runs · 14 innings").
export function awardLine(board: LeaderboardBoardInfo, row: LeaderboardRow): string {
  const figure = figureText(board.code, row.figure)
  const counting = board.minimumKind === 'NONE' && typeof row.figure === 'number'
  const head = counting && board.figureLabel ? `${figure} ${board.figureLabel.toLowerCase()}` : figure
  const tail = sampleLine(row) ?? matchLine(row) ?? (row.innings !== null && row.innings !== undefined ? plural(row.innings, 'innings', 'innings') : null)
  return tail ? `${head} · ${tail}` : head
}

// Decimals per standings column (spec 103, Derived figures): averages, economy and the batting strike rate show two; the bowling
// strike rate (balls per wicket) shows one. `strikeRate` exists in both groups, so the group decides.
const TWO_DECIMAL_COLUMNS = new Set(['average', 'strikeRate', 'economy'])
const ONE_DECIMAL_COLUMNS = new Set(['bowling:strikeRate'])

// One standings cell as text (decision 26): 94* for a highest score, 4/17 for best bowling, overs notation for overs, two
// decimals for averages and rates, a dash when the figure is not defined. Display only; nothing is computed here.
export function cellText(group: string, columnCode: string, cell: LeaderboardCell | undefined): string {
  if (!cell) return NOT_ON_FILE
  if (columnCode === 'highestScore') return cell.runs === null || cell.runs === undefined ? NOT_ON_FILE : `${cell.runs}${cell.notOut ? '*' : ''}`
  if (columnCode === 'best') return cell.wickets === null || cell.wickets === undefined ? NOT_ON_FILE : `${cell.wickets}/${cell.runs ?? 0}`
  if (cell.value === null || cell.value === undefined) return NOT_ON_FILE
  if (columnCode === 'overs') {
    // cricket notation when the balls are known and over lengths are uniform, else the server's decimal overs
    if (cell.balls !== null && cell.balls !== undefined && cell.ballsPerOver) return ballsToOvers(cell.balls, cell.ballsPerOver)
    return String(cell.value)
  }
  if (ONE_DECIMAL_COLUMNS.has(`${group.toLowerCase()}:${columnCode}`)) return cell.value.toFixed(1)
  if (TWO_DECIMAL_COLUMNS.has(columnCode)) return cell.value.toFixed(2)
  return String(cell.value)
}

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

