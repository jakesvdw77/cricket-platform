import type { TeamStatsCell, TeamStatsTableBasis } from '../../../api/teamStatsApi'
import { NOT_ON_FILE } from '../../../utils/playerFormat'

// docs/specs/116-team-stats.md (Teams tab): display helpers only. Figures, ranks and statuses are decided by the server
// (TeamStatsCalculator); these functions choose decimals, add a sign or a slash, and turn null into a dash. Nothing here computes
// a statistic.

const hasValue = (value: number | null | undefined): value is number => value !== null && value !== undefined

// Counts: plain integers with thousands separators (1,842).
export function countText(value: number | null | undefined): string {
  return hasValue(value) ? value.toLocaleString('en-US') : NOT_ON_FILE
}

// Win percentage: one decimal.
export function winPercentText(value: number | null | undefined): string {
  return hasValue(value) ? value.toFixed(1) : NOT_ON_FILE
}

// Averages, run rate and economy: two decimals.
export function rateText(value: number | null | undefined): string {
  return hasValue(value) ? value.toFixed(2) : NOT_ON_FILE
}

// Net run rate: signed, two decimals (+0.84, -1.12); exactly zero has no sign.
export function netRunRateText(value: number | null | undefined): string {
  if (!hasValue(value)) return NOT_ON_FILE
  const text = value.toFixed(2)
  return value > 0 ? `+${text}` : text
}

// Highest total: "212/6", or "212" when the wickets were not recorded.
export function highTotalText(cell: TeamStatsCell | undefined): string {
  if (!cell || !hasValue(cell.runs)) return NOT_ON_FILE
  return hasValue(cell.wickets) ? `${cell.runs}/${cell.wickets}` : String(cell.runs)
}

const COUNT_COLUMNS = new Set(['played', 'won', 'lost', 'tied', 'drawn', 'noResult', 'runs', 'wicketsTaken'])
const RATE_COLUMNS = new Set(['battingAverage', 'runRate', 'bowlingAverage', 'economy'])

// One table cell as text, by column code.
export function teamCellText(code: string, cell: TeamStatsCell | undefined): string {
  if (!cell) return NOT_ON_FILE
  if (code === 'highTotal') return highTotalText(cell)
  if (code === 'netRunRate') return netRunRateText(cell.status && cell.status !== 'SHOWN' ? null : cell.value)
  if (code === 'winPercent') return winPercentText(cell.value)
  if (COUNT_COLUMNS.has(code)) return countText(cell.value)
  if (RATE_COLUMNS.has(code)) return rateText(cell.value)
  return hasValue(cell.value) ? String(cell.value) : NOT_ON_FILE
}

// Why a net run rate cell is a dash (read by assistive technology); null when it is shown or the status is unknown.
export function netRunRateReason(cell: TeamStatsCell | undefined): string | null {
  if (cell?.status === 'NOT_ONE_COMPETITION') return 'Net run rate is not shown across more than one league or season'
  if (cell?.status === 'NO_USABLE_RESULTS') return 'Net run rate needs won or tied results with both innings recorded'
  return null
}

// What the unranked group is called on a table ("Not ranked: no decisive result yet"): the sorted column decides.
export function teamUnrankedReason(sortCode: string): string {
  switch (sortCode) {
    case 'winPercent':
      return 'no decisive result yet'
    case 'battingAverage':
      return 'no wickets lost yet'
    case 'bowlingAverage':
      return 'no wickets taken yet'
    case 'runRate':
    case 'economy':
      return 'no balls recorded yet'
    case 'netRunRate':
      return 'no net run rate to show'
    case 'runs':
    case 'highTotal':
      return 'no innings yet'
    default:
      return 'no figure yet'
  }
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

// The basis line: the results counted, then only the parts that are not zero (what was counted once per team, what was left
// out, and what a forfeit is).
export function teamBasisLines(basis: TeamStatsTableBasis): string[] {
  const lines = [`Based on ${plural(basis.resultsCounted, 'published result')}.`]
  if (basis.internalResults > 0) {
    lines.push(`${plural(basis.internalResults, 'internal match', 'internal matches')} ${basis.internalResults === 1 ? 'is' : 'are'} counted once for each team.`)
  }
  if (basis.resultsNoBallBowled > 0) {
    lines.push(`${plural(basis.resultsNoBallBowled, 'result')} with no ball bowled ${basis.resultsNoBallBowled === 1 ? 'is' : 'are'} not counted.`)
  }
  if (basis.forfeits > 0) {
    lines.push(
      `${plural(basis.forfeits, 'forfeit')} ${basis.forfeits === 1 ? 'is' : 'are'} counted in P: a forfeit is a loss for the team that conceded and a win for the one that received it, with no runs or wickets.`,
    )
  }
  return lines
}

// The row link: Season, League and Competition ride along (the Section filter only chose the teams). An empty season or league
// means "none" (All); the competition is added only when one is chosen.
export function teamStatsLink(teamId: string, filters: { seasonId?: string | null; leagueId?: string | null }, competition: string | null): string {
  const params = new URLSearchParams()
  params.set('seasonId', filters.seasonId ?? '')
  params.set('leagueId', filters.leagueId ?? '')
  if (competition) params.set('competition', competition)
  return `/manage/teams/${teamId}/stats?${params.toString()}`
}
