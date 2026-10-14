import type { Innings } from '../api/matchResultApi'

// docs/specs/101-match-results-our-side-scorecard.md: the batters' runs plus extras against the innings total, as the
// strip beside the batting grid shows it ("Total 148 = 135 off the bat + 13 extras"). A convenience only: a mismatch is
// an amber strip, never a block, and the server's BATTING_TOTAL_MISMATCH check is authoritative.

export type ExtrasBreakdown = Pick<Innings, 'wides' | 'noBalls' | 'byes' | 'legByes' | 'penaltyRuns'>

const n = (value: number | null | undefined): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)

// The sum of the five extras (an empty part counts as 0).
export const extrasTotal = (extras: ExtrasBreakdown | null | undefined): number =>
  n(extras?.wides) + n(extras?.noBalls) + n(extras?.byes) + n(extras?.legByes) + n(extras?.penaltyRuns)

export const hasExtras = (extras: ExtrasBreakdown | null | undefined): boolean =>
  [extras?.wides, extras?.noBalls, extras?.byes, extras?.legByes, extras?.penaltyRuns].some((part) => part != null)

export interface BattingTotals {
  // Runs scored by the batters.
  offBat: number
  extras: number
  // offBat + extras.
  total: number
  // The innings total from the Scores step, or null when it is not entered yet.
  inningsRuns: number | null
  // 'unknown' when the innings total is missing (nothing to compare), otherwise match or mismatch.
  status: 'match' | 'mismatch' | 'unknown'
  // total - inningsRuns (positive: the card adds up to more than the innings), 0 when unknown.
  difference: number
}

export function battingTotals(
  batters: ReadonlyArray<{ runs: number | null }>,
  extras: ExtrasBreakdown | null | undefined,
  inningsRuns: number | null | undefined,
): BattingTotals {
  const offBat = batters.reduce((sum, batter) => sum + n(batter.runs), 0)
  const extrasSum = extrasTotal(extras)
  const total = offBat + extrasSum
  const known = typeof inningsRuns === 'number'
  return {
    offBat,
    extras: extrasSum,
    total,
    inningsRuns: known ? inningsRuns : null,
    status: !known ? 'unknown' : total === inningsRuns ? 'match' : 'mismatch',
    difference: known ? total - inningsRuns : 0,
  }
}
