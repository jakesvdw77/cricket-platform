import type { BattingEntry, BowlingEntry } from '../api/matchResultApi'
import { allowsBowler, isBowlerCredited } from './dismissal'

// docs/specs/101-match-results-our-side-scorecard.md: the soft, local checks behind the amber row highlight on the Batting and
// Bowling grids. Each returns the short reason a row looks wrong, or null. They never block: the server's validation
// is authoritative, these only point at the row while the manager is typing.

const figures = (entry: Pick<BattingEntry, 'runs' | 'balls' | 'fours' | 'sixes'>) => [entry.runs, entry.balls, entry.fours, entry.sixes].some((value) => value != null)

export function battingRowProblem(entry: Pick<BattingEntry, 'howOut' | 'runs' | 'balls' | 'fours' | 'sixes'>): string | null {
  if (entry.howOut === 'DID_NOT_BAT') return null
  if (entry.howOut == null && figures(entry)) return 'Choose how out'
  if (entry.runs != null && (entry.fours ?? 0) * 4 + (entry.sixes ?? 0) * 6 > entry.runs) return 'The boundaries add up to more than the runs'
  if (entry.balls != null && entry.balls < (entry.fours ?? 0) + (entry.sixes ?? 0)) return 'Fewer balls than boundaries'
  return null
}

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
  return null
}
