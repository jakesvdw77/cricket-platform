import type { BattingEntry, BowlingEntry } from '../api/matchResultApi'
import { allowsBowler, allowsFielder, isBowlerCredited, isWicket } from './dismissal'

// docs/specs/101-match-results-our-side-scorecard.md: the soft, local checks behind the amber row highlight on the Batting and
// Bowling grids. Each returns the short reason a row looks wrong, or null. They never block: the server's validation
// is authoritative, these only point at the row while the manager is typing.

const figures = (entry: Pick<BattingEntry, 'runs' | 'balls' | 'fours' | 'sixes'>) => [entry.runs, entry.balls, entry.fours, entry.sixes].some((value) => value != null)

export type BattingCell = 'howOut' | 'runs' | 'balls' | 'fielder' | 'bowler'

export interface RowChecks {
  // Every reason the row looks wrong, in the order they are shown.
  reasons: string[]
  // The cells to tint amber.
  cells: ReadonlySet<BattingCell>
}

type CheckedBatter = Pick<BattingEntry, 'howOut' | 'runs' | 'balls' | 'fours' | 'sixes'> & Partial<Pick<BattingEntry, 'bowlerPlayerId' | 'fielderPlayerId'>>

// The warnings for one batting row, with the cells they point at. A dismissal that expects a fielder (caught, stumped, run out)
// or a bowler (bowled, caught, LBW, stumped, caught and bowled, hit wicket) warns as soon as the how out is chosen; a batted
// row without runs warns; balls are optional and never warn.
export function battingRowChecks(entry: CheckedBatter): RowChecks {
  const reasons: string[] = []
  const cells = new Set<BattingCell>()
  const flag = (cell: BattingCell, reason: string) => {
    cells.add(cell)
    reasons.push(reason)
  }
  if (entry.howOut === 'DID_NOT_BAT') return { reasons, cells }
  if (entry.howOut == null) {
    if (figures(entry)) flag('howOut', 'Choose how out')
  } else {
    if (allowsFielder(entry.howOut) && !entry.fielderPlayerId) flag('fielder', 'Choose the fielder')
    if (allowsBowler(entry.howOut) && !entry.bowlerPlayerId) flag('bowler', 'Choose the bowler')
    if ((isWicket(entry.howOut) || entry.howOut === 'NOT_OUT') && entry.runs == null) flag('runs', 'Enter the runs')
  }
  if (entry.runs != null && (entry.fours ?? 0) * 4 + (entry.sixes ?? 0) * 6 > entry.runs) flag('runs', 'The boundaries add up to more than the runs')
  if (entry.balls != null && entry.balls < (entry.fours ?? 0) + (entry.sixes ?? 0)) flag('runs', 'Fewer balls than boundaries')
  if ((entry.runs ?? 0) > 0 && entry.balls === 0) flag('balls', 'Enter the balls faced')
  return { reasons, cells }
}

// The first reason, or null.
export const battingRowProblem = (entry: CheckedBatter): string | null => battingRowChecks(entry).reasons[0] ?? null

// Keys of batters who share a batting position with another batter.
export function duplicatePositionKeys<T extends { position: number | null }>(entries: T[], keyOf: (entry: T) => string): Set<string> {
  const byPosition = new Map<number, string[]>()
  for (const entry of entries) if (entry.position != null) byPosition.set(entry.position, [...(byPosition.get(entry.position) ?? []), keyOf(entry)])
  return new Set([...byPosition.values()].filter((keys) => keys.length > 1).flat())
}

// True when every bowler-credited dismissal names its bowler, so the wickets the dismissals credit are complete.
export const wicketsFullyAttributed = (batters: Array<Pick<BattingEntry, 'howOut' | 'bowlerPlayerId'>>): boolean =>
  batters.filter((entry) => isBowlerCredited(entry.howOut) && allowsBowler(entry.howOut)).every((entry) => Boolean(entry.bowlerPlayerId))

export interface BowlingCheckContext {
  ballsPerOver: number
  // The wickets the dismissals credit this bowler, or null while the dismissals do not name every bowler (then nothing is said).
  dismissalWickets: number | null
}

export function bowlingRowProblem(entry: Pick<BowlingEntry, 'balls' | 'maidens' | 'runs' | 'wickets' | 'wides' | 'noBalls' | 'dots' | 'wicketsSource'>, context: BowlingCheckContext): string | null {
  if (entry.balls != null && entry.maidens != null && entry.maidens > Math.floor(entry.balls / context.ballsPerOver)) return 'More maidens than complete overs'
  if (entry.balls != null && entry.dots != null && entry.dots > entry.balls) return 'More dot balls than balls bowled'
  if (entry.wicketsSource !== 'DERIVED' && context.dismissalWickets !== null && entry.wickets != null && entry.wickets > context.dismissalWickets) {
    return 'More wickets than the dismissals credit'
  }
  if (entry.runs != null && (entry.wides ?? 0) + (entry.noBalls ?? 0) > entry.runs) return 'Wides and no-balls are more than the runs'
  if (entry.balls == null) return 'Enter the overs bowled'
  return null
}
