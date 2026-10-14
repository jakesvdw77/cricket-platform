import type { Innings, ResultDraft, ResultMarginType, ResultSide } from '../api/matchResultApi'
import { ballsToOvers } from './oversFormat'

// docs/specs/100-match-results-core.md: what the entered scores say the result is, and whether the outcome, winner and
// margin the manager entered agree with it. Pure: the wizard only ever suggests, never overwrites without a tap. The
// server's validate stays the authority for publishing; this adds the checks that need the side names and a Fix action.

const WICKETS_IN_HAND = 10

export type CheckStatus = 'match' | 'mismatch' | 'cannot-check'

// The result the scores point to.
export interface SuggestedResult {
  outcomeType: 'WON' | 'TIE'
  decidedBy: 'REGULAR' | 'SUPER_OVER'
  winningSide: ResultSide | null
  marginType: ResultMarginType | null
  marginValue: number | null
}

export interface MarginCheck {
  // The margin the scores give for the entered result (null when there is none to compare).
  expected: { type: ResultMarginType; value: number } | null
  // The whole result the scores give; null until both innings are in, and for a DLS win.
  suggestion: SuggestedResult | null
  status: CheckStatus
  // One plain-English sentence for the status.
  reason: string
}

export interface SideNames {
  home: string
  away: string
}

type Scored = Innings & { runs: number; battingSide: ResultSide }

const scored = (innings: Innings | undefined): innings is Scored =>
  Boolean(innings) && innings?.runs !== null && innings?.runs !== undefined && Boolean(innings?.battingSide)

const bySequence = (a: Innings, b: Innings) => (a.sequence ?? 0) - (b.sequence ?? 0)
function nameOf(side: ResultSide, names: SideNames) {
  return side === 'HOME' ? names.home : names.away
}

function plural(value: number, unit: string) {
  return `${value} ${unit}${value === 1 ? '' : 's'}`
}

function marginWords(type: ResultMarginType | null | undefined, value: number | null | undefined) {
  if (!type || value === null || value === undefined) return null
  return plural(value, type === 'RUNS' ? 'run' : 'wicket')
}

// The suggestion from two regular innings: the higher score wins, by runs when it batted first, by the wickets in hand
// when it batted second. Level scores are a tie, or a super over win when super over innings are entered and differ.
function suggest(draft: ResultDraft, first: Scored, second: Scored): SuggestedResult {
  if (first.runs !== second.runs) {
    if (first.runs > second.runs) {
      return { outcomeType: 'WON', decidedBy: 'REGULAR', winningSide: first.battingSide, marginType: 'RUNS', marginValue: first.runs - second.runs }
    }
    return {
      outcomeType: 'WON',
      decidedBy: 'REGULAR',
      winningSide: second.battingSide,
      marginType: 'WICKETS',
      marginValue: Math.max(WICKETS_IN_HAND - (second.wickets ?? 0), 0),
    }
  }
  const superOvers = (draft.innings ?? []).filter((item) => item.kind === 'SUPER_OVER' && scored(item))
  const totals = new Map<ResultSide, number>()
  for (const item of superOvers) totals.set(item.battingSide as ResultSide, (totals.get(item.battingSide as ResultSide) ?? 0) + (item.runs ?? 0))
  const home = totals.get('HOME') ?? 0
  const away = totals.get('AWAY') ?? 0
  if (superOvers.length >= 2 && home !== away) {
    return { outcomeType: 'WON', decidedBy: 'SUPER_OVER', winningSide: home > away ? 'HOME' : 'AWAY', marginType: null, marginValue: null }
  }
  return { outcomeType: 'TIE', decidedBy: 'REGULAR', winningSide: null, marginType: null, marginValue: null }
}

function superOverTotals(draft: ResultDraft) {
  const totals = { HOME: 0, AWAY: 0, count: 0 }
  for (const item of draft.innings ?? []) {
    if (item.kind === 'SUPER_OVER' && scored(item)) {
      totals[item.battingSide] += item.runs
      totals.count += 1
    }
  }
  return totals
}

function checkDls(draft: ResultDraft, second: Scored, names: SideNames): MarginCheck {
  const cannot = (reason: string): MarginCheck => ({ expected: null, suggestion: null, status: 'cannot-check', reason })
  const target = draft.dlsTarget
  const winner = draft.winningSide
  if (target === null || target === undefined || !winner) return cannot('DLS target applies, so the margin cannot be checked from the scores.')
  // The target is the score the side batting second needed. Plausible: it reached it and won, or fell short and lost.
  const chaserWon = winner === second.battingSide
  const reached = second.runs >= target
  if (chaserWon && !reached) {
    return { expected: null, suggestion: null, status: 'mismatch', reason: `${nameOf(winner, names)} won chasing a DLS target of ${target}, but scored ${second.runs}.` }
  }
  if (!chaserWon && reached) {
    return { expected: null, suggestion: null, status: 'mismatch', reason: `${nameOf(second.battingSide, names)} reached the DLS target of ${target}, but ${nameOf(winner, names)} is marked as the winner.` }
  }
  return cannot('DLS target applies, so the margin is not checked; the winner fits the target.')
}

// Compares the entered outcome, winner and margin with what the regular (and super over) innings say.
export function checkMargin(draft: ResultDraft, names: SideNames): MarginCheck {
  const outcome = draft.outcomeType ?? null
  const decidedBy = draft.decidedBy ?? 'REGULAR'
  const noCheck = (reason: string): MarginCheck => ({ expected: null, suggestion: null, status: 'cannot-check', reason })

  if (outcome === 'FORFEIT' || outcome === 'ABANDONED' || outcome === 'NO_RESULT' || outcome === 'DRAW') {
    return noCheck('Nothing to check from the scores for this result.')
  }
  const regular = (draft.innings ?? []).filter((item) => item.kind !== 'SUPER_OVER').sort(bySequence)
  const [first, second] = regular
  if (!scored(first) || !scored(second)) return noCheck('Enter both innings to check the result.')

  if (outcome === 'WON' && decidedBy === 'DLS') return checkDls(draft, second, names)

  const suggestion = suggest(draft, first, second)
  const expected = suggestion.marginType && suggestion.marginValue !== null ? { type: suggestion.marginType, value: suggestion.marginValue } : null
  const result = (status: CheckStatus, reason: string): MarginCheck => ({ expected, suggestion, status, reason })

  if (outcome === null) return result('cannot-check', 'Choose the outcome to check it against the scores.')

  const level = first.runs === second.runs
  if (outcome === 'TIE') {
    return level
      ? result('match', 'The innings are level, as a tie needs.')
      : result('mismatch', `Recorded as a tie, but the scores differ by ${plural(Math.abs(first.runs - second.runs), 'run')}.`)
  }

  // outcome === 'WON'
  const winner = draft.winningSide ?? null
  if (decidedBy === 'SUPER_OVER') {
    if (!level) return result('mismatch', `A super over win needs level scores, but they differ by ${plural(Math.abs(first.runs - second.runs), 'run')}.`)
    const totals = superOverTotals(draft)
    if (totals.count < 2) return result('cannot-check', 'Enter the super over innings to check the winner.')
    if (totals.HOME === totals.AWAY) return result('mismatch', 'The super over is level too; add another super over.')
    const better: ResultSide = totals.HOME > totals.AWAY ? 'HOME' : 'AWAY'
    return winner === better
      ? result('match', `${nameOf(better, names)} scored more in the super over.`)
      : result('mismatch', `${nameOf(better, names)} scored more in the super over, but ${winner ? nameOf(winner, names) : 'no side'} is marked as the winner.`)
  }

  if (level) return result('mismatch', 'The scores are level. Was it a tie, or decided in a super over?')
  const better = suggestion.winningSide as ResultSide
  if (winner !== better) {
    return result(
      'mismatch',
      `${nameOf(better, names)} scored more, but ${winner ? nameOf(winner, names) : 'no side'} is marked as the winner.`,
    )
  }
  const entered = marginWords(draft.marginType, draft.marginValue)
  const wanted = marginWords(suggestion.marginType, suggestion.marginValue)
  if (!entered) return result('mismatch', `No margin entered; the scores say ${wanted}.`)
  if (draft.marginType !== suggestion.marginType || draft.marginValue !== suggestion.marginValue) {
    return result('mismatch', `You entered won by ${entered}; the scores say ${wanted}.`)
  }
  let reason = `The margin of ${entered} matches the scores.`
  if (suggestion.marginType === 'WICKETS' && draft.scheduledBalls && second.balls !== null && second.balls !== undefined && second.balls < draft.scheduledBalls) {
    const left = draft.scheduledBalls - second.balls
    reason = `${reason} ${nameOf(better, names)} won with ${ballsToOvers(left, draft.ballsPerOver ?? 6)} overs to spare.`
  }
  return result('match', reason)
}

// A short sentence for "Suggested result" ("Irene Villagers won by 24 runs", "Match tied", "X won in the super over").
export function suggestionText(suggestion: SuggestedResult, names: SideNames): string {
  if (suggestion.outcomeType === 'TIE') return 'Match tied'
  const winner = nameOf(suggestion.winningSide as ResultSide, names)
  if (suggestion.decidedBy === 'SUPER_OVER') return `Tied, ${winner} won in the super over`
  return `${winner} won by ${marginWords(suggestion.marginType, suggestion.marginValue)}`
}
