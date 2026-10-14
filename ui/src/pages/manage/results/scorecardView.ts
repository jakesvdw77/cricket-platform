import type { Innings, MatchResult, ScorecardInnings } from '../../../api/matchResultApi'
import { ballsToOvers } from '../../../utils/oversFormat'

// Pure display helpers of the result page's scorecard (docs/specs/101-match-results-our-side-scorecard.md, Review step and
// result page). Rates are calculated on display and never stored.

const DASH = '–'

// Whole overs read without the ".0" in a sentence ("20 overs"), part overs keep it ("18.3 overs").
const oversText = (balls: number, ballsPerOver: number) => ballsToOvers(balls, ballsPerOver).replace(/\.0$/, '')

const rate = (numerator: number | null | undefined, per: number | null | undefined): string =>
  numerator === null || numerator === undefined || !per ? DASH : (numerator / per).toFixed(2)

// Runs per 100 balls faced.
export const strikeRate = (runs: number | null | undefined, balls: number | null | undefined): string =>
  runs === null || runs === undefined || !balls ? DASH : ((runs / balls) * 100).toFixed(2)

// Runs per over (an over is `ballsPerOver` balls); used for a bowler's economy and an innings' run rate.
export const runsPerOver = (runs: number | null | undefined, balls: number | null | undefined, ballsPerOver: number): string =>
  runs === null || runs === undefined || !balls ? DASH : rate(runs, balls / ballsPerOver)

// "Extras (b 4, lb 1, w 3, nb 0, pen 0) 8", or null when nothing is known.
export function extrasLine(innings: Pick<ScorecardInnings, 'byes' | 'legByes' | 'wides' | 'noBalls' | 'penaltyRuns' | 'extras'> | undefined, fallbackTotal: number | null | undefined): string | null {
  const total = innings?.extras ?? fallbackTotal
  if (!innings && (total === null || total === undefined)) return null
  const n = (value: number | null | undefined) => value ?? 0
  const parts = `b ${n(innings?.byes)}, lb ${n(innings?.legByes)}, w ${n(innings?.wides)}, nb ${n(innings?.noBalls)}, pen ${n(innings?.penaltyRuns)}`
  return `Extras (${parts}) ${total ?? DASH}`
}

// "Total 7 wickets, 20 overs: 133" and the run rate calculated beside it.
export function totalLine(innings: Innings, ballsPerOver: number): { text: string; runRate: string | null } {
  const wickets = innings.allOut ? 'all out' : innings.wickets === null || innings.wickets === undefined ? null : `${innings.wickets} ${innings.wickets === 1 ? 'wicket' : 'wickets'}`
  const overs = innings.balls === null || innings.balls === undefined ? null : `${oversText(innings.balls, ballsPerOver)} overs`
  const head = ['Total', [wickets, overs].filter(Boolean).join(', ')].filter(Boolean).join(' ')
  const runRate = runsPerOver(innings.runs, innings.balls, ballsPerOver)
  return { text: `${head}: ${innings.runs ?? DASH}`, runRate: runRate === DASH ? null : runRate }
}

// "Target: 134 runs from 20 overs" for the side batting second in a regular win or loss, else null.
export function targetLine(result: Pick<MatchResult, 'decidedBy' | 'outcomeType' | 'scheduledBalls' | 'ballsPerOver'>, first: Innings | undefined, isSecond: boolean): string | null {
  if (!isSecond || !first || result.decidedBy !== 'REGULAR' || result.outcomeType !== 'WON') return null
  if (first.runs === null || first.runs === undefined || !result.scheduledBalls) return null
  return `Target: ${first.runs + 1} runs from ${oversText(result.scheduledBalls, result.ballsPerOver)} overs`
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

// "2 catches, 1 stumping, 1 run-out"; empty when the player has no credit.
export function fieldingCredits(entry: { catches: number | null; stumpings: number | null; runOuts: number | null }): string {
  return [
    entry.catches ? plural(entry.catches, 'catch', 'catches') : null,
    entry.stumpings ? plural(entry.stumpings, 'stumping', 'stumpings') : null,
    entry.runOuts ? plural(entry.runOuts, 'run-out', 'run-outs') : null,
  ]
    .filter(Boolean)
    .join(', ')
}
