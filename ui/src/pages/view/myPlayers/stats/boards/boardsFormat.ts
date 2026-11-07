import type { LeaderboardBoardInfo, LeaderboardCell, LeaderboardFigure, LeaderboardSample, MinimumKind } from '../../../../../api/leaderboardApi'
import type { MyAwardsLeader, MyLeaderboardColumn, MyStandingSample } from '../../../../../api/meStatsApi'
import { ballsToOvers } from '../../../../../utils/oversFormat'
import { DASH, plural } from '../statsFormat'

// docs/specs/147 section 6: formatting for the Hub leaderboards only. Ranks, figures, samples and orders are the server's; this picks decimals,
// adds a star or a slash and turns null into a dash. Nothing here computes a statistic. (The manager page has its own copy of these rules
// under pages/manage; a Hub page does not import a manager page.)

const TWO_DECIMAL_COLUMNS = new Set(['average', 'strikeRate', 'economy'])
const ONE_DECIMAL_COLUMNS = new Set(['bowling:strikeRate'])

// One standings cell: 94* for a highest score, 4/17 for best bowling, overs notation for overs, two decimals for averages and rates.
export function cellText(group: string, columnCode: string, cell: LeaderboardCell | null | undefined): string {
  if (!cell) return DASH
  if (columnCode === 'highestScore') return cell.runs === null || cell.runs === undefined ? DASH : `${cell.runs}${cell.notOut ? '*' : ''}`
  if (columnCode === 'best') return cell.wickets === null || cell.wickets === undefined ? DASH : `${cell.wickets}/${cell.runs ?? 0}`
  if (cell.value === null || cell.value === undefined) return DASH
  if (columnCode === 'overs') {
    if (cell.balls !== null && cell.balls !== undefined && cell.ballsPerOver) return ballsToOvers(cell.balls, cell.ballsPerOver)
    return String(cell.value)
  }
  if (ONE_DECIMAL_COLUMNS.has(`${group.toLowerCase()}:${columnCode}`)) return cell.value.toFixed(1)
  if (TWO_DECIMAL_COLUMNS.has(columnCode)) return cell.value.toFixed(2)
  return String(cell.value)
}

// The heading's accessible name: the long label where the server sent one.
export const columnName = (column: MyLeaderboardColumn): string => column.longLabel || column.label

export const minimumUnitWord = (kind: MinimumKind): string => (kind === 'OVERS' ? 'overs' : 'innings')
export const minimumLabel = (kind: MinimumKind): string => (kind === 'OVERS' ? 'Minimum overs' : 'Minimum innings')

// The sample behind a standing line: "7 innings · 212 balls" (batting) or "11.3 overs · 8 matches" (economy).
export function standingSampleText(sample: MyStandingSample | null | undefined, key: string): string {
  if (!sample) return ''
  if (key === 'economy') {
    const unit = sample.overs === null || sample.overs === undefined ? (sample.balls === null ? '' : plural(sample.balls, 'ball')) : `${ballsToOvers(sample.balls, sample.ballsPerOver ?? undefined) || sample.overs} overs`
    return [unit, plural(sample.matches, 'match', 'matches')].filter(Boolean).join(' · ')
  }
  if (key === 'catches') return plural(sample.matches, 'match', 'matches')
  const parts = [sample.innings === null ? '' : plural(sample.innings, 'innings', 'innings')]
  if (key === 'runs' || key === 'average') parts.push(sample.ballsFaced === null ? '' : plural(sample.ballsFaced, 'ball'))
  if (parts.every((part) => !part)) parts.push(plural(sample.matches, 'match', 'matches'))
  return parts.filter(Boolean).join(' · ')
}

const AWARD_TWO_DECIMALS = new Set(['BATTING_AVERAGE', 'STRIKE_RATE', 'BOWLING_AVERAGE', 'ECONOMY_RATE'])
const AWARD_ONE_DECIMAL = new Set(['BOWLING_STRIKE_RATE'])

// An awards figure as text.
export function awardFigureText(boardCode: string, figure: LeaderboardFigure): string {
  if (figure === null || figure === undefined) return DASH
  if (typeof figure === 'number') {
    if (AWARD_TWO_DECIMALS.has(boardCode)) return figure.toFixed(2)
    if (AWARD_ONE_DECIMAL.has(boardCode)) return figure.toFixed(1)
    return String(figure)
  }
  if ('wickets' in figure) return `${figure.wickets}/${figure.runs}`
  return `${figure.runs}${figure.notOut ? '*' : ''}`
}

const sampleText = (sample: LeaderboardSample | null): string | null => {
  if (!sample) return null
  if (sample.balls !== null && sample.balls !== undefined) {
    const first = sample.overs === null || sample.overs === undefined ? plural(sample.balls, 'ball') : `${ballsToOvers(sample.balls, sample.ballsPerOver ?? undefined)} overs`
    return `${first}, ${plural(sample.wickets ?? 0, 'wicket')}`
  }
  return `${sample.innings ?? 0} innings, ${plural(sample.ballsFaced ?? 0, 'ball')}`
}

// "412 runs · 14 innings, 310 balls": the figure and what stands behind it.
export function awardLine(board: LeaderboardBoardInfo, leader: MyAwardsLeader): string {
  const figure = awardFigureText(board.code, leader.figure)
  const head = board.minimumKind === 'NONE' && typeof leader.figure === 'number' && board.figureLabel ? `${figure} ${board.figureLabel.toLowerCase()}` : figure
  const tail = sampleText(leader.sample) ?? (leader.innings !== null && leader.innings !== undefined ? plural(leader.innings, 'innings', 'innings') : null)
  return tail ? `${head} · ${tail}` : head
}
