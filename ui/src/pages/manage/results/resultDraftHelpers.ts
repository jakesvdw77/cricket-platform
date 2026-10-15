import type { SuggestedResult } from '../../../utils/marginCheck'
import type { Innings, MatchResult, ResultDraft, ResultSide, Scorecard } from '../../../api/matchResultApi'
import { DEFAULT_BALLS_PER_OVER } from '../../../utils/oversFormat'
import { hasBowlingFigures, hasCredit } from './scorecardDraft'

// docs/specs/100-match-results-core.md: pure helpers around the one ResultDraft the capture wizard edits. The form state
// may hold half-filled innings and stale choices (a margin left over after switching to a tie); toPayload() is the one
// place that turns it into what the server stores.

export const opposite = (side: ResultSide): ResultSide => (side === 'HOME' ? 'AWAY' : 'HOME')

export const isSuperOver = (innings: Innings) => innings.kind === 'SUPER_OVER'

export function blankInnings(sequence: number, battingSide: ResultSide): Innings {
  return {
    sequence,
    kind: sequence <= 2 ? 'REGULAR' : 'SUPER_OVER',
    battingSide,
    runs: null,
    wickets: null,
    balls: null,
  }
}

export const regularInningsOf = (draft: ResultDraft): Innings[] =>
  (draft.innings ?? []).filter((innings) => !isSuperOver(innings))

export const superOversOf = (draft: ResultDraft): Innings[] => (draft.innings ?? []).filter(isSuperOver)

// Both regular innings always exist in the form (blank until typed); a stored result may hold fewer.
function withRegularInnings(innings: Innings[]): Innings[] {
  const regular = innings.filter((item) => !isSuperOver(item))
  const first = regular.find((item) => item.sequence === 1)
  const second = regular.find((item) => item.sequence === 2)
  const firstSide = first?.battingSide ?? (second?.battingSide ? opposite(second.battingSide) : 'HOME')
  return [
    first ?? blankInnings(1, firstSide),
    second ?? blankInnings(2, opposite(firstSide)),
    ...innings.filter(isSuperOver),
  ]
}

export function emptyDraft(): ResultDraft {
  return {
    outcomeType: null,
    decidedBy: 'REGULAR',
    winningSide: null,
    marginType: null,
    marginValue: null,
    dlsTarget: null,
    dlsRevisedBalls: null,
    scheduledBalls: null,
    ballsPerOver: DEFAULT_BALLS_PER_OVER,
    tossWonBy: null,
    tossDecision: null,
    playingAreaId: null,
    note: null,
    innings: withRegularInnings([]),
  }
}

// `scorecard` is the stored scorecard (api getScorecard) when the caller has it: the result itself carries only
// `hasScorecard`. Left out, the draft holds no scorecard and a save leaves the stored one untouched.
export function draftFromResult(result: MatchResult | null, scorecard?: Scorecard | null): ResultDraft {
  if (!result) return emptyDraft()
  return {
    outcomeType: result.outcomeType,
    decidedBy: result.decidedBy,
    winningSide: result.winningSide,
    marginType: result.marginType,
    marginValue: result.marginValue,
    dlsTarget: result.dlsTarget,
    dlsRevisedBalls: result.dlsRevisedBalls,
    scheduledBalls: result.scheduledBalls,
    ballsPerOver: result.ballsPerOver,
    tossWonBy: result.tossWonBy,
    tossDecision: result.tossDecision,
    playingAreaId: result.playingAreaId,
    note: result.note,
    innings: withRegularInnings(result.innings),
    ...(scorecard ? { scorecard } : {}),
  }
}

export function updateInnings(draft: ResultDraft, sequence: number, patch: Partial<Innings>): ResultDraft {
  return {
    ...draft,
    innings: (draft.innings ?? []).map((innings) => (innings.sequence === sequence ? { ...innings, ...patch } : innings)),
  }
}

// A super over is a pair of innings (sequences 3 and 4, then 5 and 6...). The side that batted second in the match bats
// first in the first super over; each later pair swaps again.
export function addSuperOver(draft: ResultDraft): ResultDraft {
  const innings = draft.innings ?? []
  const pairs = innings.filter(isSuperOver).length / 2
  const next = Math.max(innings.length, 2) + 1
  const secondBatter = innings.find((item) => item.sequence === 2)?.battingSide ?? 'AWAY'
  const firstSide = pairs % 2 === 0 ? secondBatter : opposite(secondBatter)
  return {
    ...draft,
    innings: [...innings, blankInnings(next, firstSide), blankInnings(next + 1, opposite(firstSide))],
  }
}

export function removeLastSuperOver(draft: ResultDraft): ResultDraft {
  const innings = draft.innings ?? []
  if (!innings.some(isSuperOver)) return draft
  return { ...draft, innings: innings.slice(0, -2) }
}

export const withoutSuperOvers = (draft: ResultDraft): ResultDraft => ({
  ...draft,
  innings: (draft.innings ?? []).filter((innings) => !isSuperOver(innings)),
})

// Writes a suggested result (outcome, winner, margin) into the form. Super overs are kept only for a super over win.
export function applySuggestion(draft: ResultDraft, suggestion: SuggestedResult): ResultDraft {
  const base = suggestion.decidedBy === 'SUPER_OVER' ? draft : withoutSuperOvers(draft)
  return {
    ...base,
    outcomeType: suggestion.outcomeType,
    decidedBy: suggestion.decidedBy,
    winningSide: suggestion.winningSide,
    marginType: suggestion.marginType,
    marginValue: suggestion.marginValue,
  }
}

// The side that batted first, from the toss: the winner bats when they chose to bat, otherwise the other side does.
// Null while the toss or its decision is not recorded (the Scores step then asks who batted first).
export function firstBatterFromToss(draft: Pick<ResultDraft, 'tossWonBy' | 'tossDecision'>): ResultSide | null {
  if (!draft.tossWonBy || !draft.tossDecision) return null
  return draft.tossDecision === 'BAT' ? draft.tossWonBy : opposite(draft.tossWonBy)
}

// Puts `firstSide` in innings 1 and the other side in innings 2. The entered figures travel with their side (mapped by
// batting side, not by position), so changing the toss after scores are typed never loses a number. Super overs are
// untouched.
export function applyBattingOrder(draft: ResultDraft, firstSide: ResultSide): ResultDraft {
  const innings = draft.innings ?? []
  const regular = innings.filter((item) => !isSuperOver(item))
  const forSide = (side: ResultSide, sequence: number): Innings => {
    const found = regular.find((item) => item.battingSide === side)
    return found ? { ...found, sequence, kind: 'REGULAR' } : blankInnings(sequence, side)
  }
  return {
    ...draft,
    innings: [forSide(firstSide, 1), forSide(opposite(firstSide), 2), ...innings.filter(isSuperOver)],
  }
}

// Applies a toss change and, when the toss now fixes who batted first, re-orders the innings to match.
export function withToss(draft: ResultDraft, patch: Pick<ResultDraft, 'tossWonBy' | 'tossDecision'>): ResultDraft {
  const next = { ...draft, ...patch }
  const first = firstBatterFromToss(next)
  return first ? applyBattingOrder(next, first) : next
}

export const hasRegularFigures = (draft: ResultDraft): boolean =>
  regularInningsOf(draft).some((item) => item.runs !== null || item.wickets !== null || item.balls !== null)

const hasFigures = (innings: Innings) => innings.runs !== null && innings.wickets !== null && innings.balls !== null
const hasAnyFigure = (innings: Innings) => innings.runs !== null || innings.wickets !== null || innings.balls !== null

// Whether the scorecard holds anything that would be saved for the innings `side` batted: a decided batting row, or a bowling
// or fielding row of the other side against it.
function hasEntriesFor(scorecard: Scorecard | null | undefined, side: ResultSide | null): boolean {
  if (!scorecard || !side) return false
  return (
    scorecard.batting.some((entry) => entry.battingSide === side && entry.howOut != null) ||
    scorecard.bowling.some((entry) => entry.battingSide === side && hasBowlingFigures(entry)) ||
    scorecard.fielding.some((entry) => entry.battingSide === side && hasCredit(entry))
  )
}

export function isBlankDraft(draft: ResultDraft): boolean {
  return (
    !draft.outcomeType &&
    !draft.tossWonBy &&
    !draft.tossDecision &&
    !draft.note &&
    !draft.playingAreaId &&
    draft.scheduledBalls === null &&
    (draft.innings ?? []).every((innings) => innings.runs === null && innings.wickets === null && innings.balls === null) &&
    !draft.scorecard?.players?.length
  )
}

// What the server stores. A regular innings is sent with whatever figures it has (see below); a margin, winner or DLS figure that the chosen outcome does not use is dropped.
export function toPayload(draft: ResultDraft): ResultDraft {
  const outcome = draft.outcomeType ?? null
  const won = outcome === 'WON'
  const decidedBy = won ? (draft.decidedBy ?? 'REGULAR') : 'REGULAR'
  const margin = won && decidedBy !== 'SUPER_OVER' && draft.marginType && draft.marginValue !== null
  // docs/specs/101 (migration 046): a regular innings is saved with whatever figures exist (the rest null) as soon as any
  // figure is typed, the scorecard holds entries for it, or the toss fixes who batted first (then both innings exist), so
  // its batting, bowling and fielding entries are kept on a partial innings. A super over still needs all three figures.
  const tossKnown = firstBatterFromToss(draft) !== null
  const sentInnings = (draft.innings ?? [])
    .filter((innings) => (isSuperOver(innings) ? hasFigures(innings) : innings.battingSide != null && (tossKnown || hasAnyFigure(innings) || hasEntriesFor(draft.scorecard, innings.battingSide))))
    .filter((innings) => decidedBy === 'SUPER_OVER' || !isSuperOver(innings))
  return {
    outcomeType: outcome,
    decidedBy,
    winningSide: won || outcome === 'FORFEIT' ? (draft.winningSide ?? null) : null,
    marginType: margin ? draft.marginType : null,
    marginValue: margin ? draft.marginValue : null,
    dlsTarget: won && decidedBy === 'DLS' ? (draft.dlsTarget ?? null) : null,
    dlsRevisedBalls: won && decidedBy === 'DLS' ? (draft.dlsRevisedBalls ?? null) : null,
    scheduledBalls: draft.scheduledBalls ?? null,
    ballsPerOver: draft.ballsPerOver ?? DEFAULT_BALLS_PER_OVER,
    tossWonBy: draft.tossWonBy ?? null,
    tossDecision: draft.tossWonBy ? (draft.tossDecision ?? null) : null,
    playingAreaId: draft.playingAreaId ?? null,
    note: draft.note?.trim() ? draft.note.trim() : null,
    innings: sentInnings.map((innings) => ({
        sequence: innings.sequence,
        kind: innings.kind,
        battingSide: innings.battingSide,
        runs: innings.runs,
        wickets: innings.wickets,
        balls: innings.balls,
        // The extras breakdown travels on the innings when the form holds one (`extras` itself is the server's sum and
        // is never sent); an innings that never had it keeps the summary-level shape of spec 100.
        ...extrasPayload(innings),
      })),
    ...scorecardPayload(draft.scorecard, sentInnings),
  }
}

// The scorecard section of a save. Absent means "untouched"; present replaces the whole scorecard. `innings` and
// `status` are read-only, so they are left out. A list of players with no innings and no outcome is a real draft (a team list
// saved before the game): the players and awards are sent whatever the innings. Rows the server would refuse or that carry
// no information yet stay in the form but are not sent: a batter whose how out is still undecided, a bowler or fielder with
// no figures, and every entry of an innings that is not part of this save (its figures are not complete yet). A Did not bat
// row carries no batting position (the order is the batters').
function scorecardPayload(scorecard: Scorecard | null | undefined, sent: Innings[]): { scorecard?: Scorecard } {
  if (!scorecard) return {}
  const regularSides = new Set(sent.filter((innings) => !isSuperOver(innings)).map((innings) => innings.battingSide))
  const inSave = <T extends { battingSide: ResultSide }>(entry: T) => regularSides.has(entry.battingSide)
  return {
    scorecard: {
      players: scorecard.players ?? [],
      batting: (scorecard.batting ?? [])
        .filter(inSave)
        .filter((entry) => entry.howOut !== null && entry.howOut !== undefined)
        // `auto` is client-only (the wicket fill's marker), not part of the API.
        .map(({ auto: _auto, ...entry }) => (entry.howOut === 'DID_NOT_BAT' ? { ...entry, position: null } : entry)),
      // `auto` is client-only (a row created from a dismissal), not part of the API.
      bowling: (scorecard.bowling ?? []).filter(inSave).filter(hasBowlingFigures).map(({ auto: _auto, ...entry }) => entry),
      fielding: (scorecard.fielding ?? []).filter(inSave).filter(hasCredit),
      awards: scorecard.awards ?? [],
    },
  }
}

const EXTRAS_KEYS = ['wides', 'noBalls', 'byes', 'legByes', 'penaltyRuns', 'nonBowlerWickets'] as const

function extrasPayload(innings: Innings): Partial<Innings> {
  const out: Partial<Innings> = {}
  for (const key of EXTRAS_KEYS) {
    if (innings[key] !== undefined) out[key] = innings[key]
  }
  return out
}

// docs/specs/101 (decisions 20 and 22): the scorecard steps Batting, Bowling and fielding and Awards no longer wait for
// scores: they apply to every match that was played (an unknown outcome included), never to a forfeit, an abandoned match or
// no result. The innings figures are entered on them. Teams, Result and Toss are always part of the wizard.
export function scorecardStepsApplicable(draft: Pick<ResultDraft, 'outcomeType'>): boolean {
  return !(draft.outcomeType === 'FORFEIT' || draft.outcomeType === 'ABANDONED' || draft.outcomeType === 'NO_RESULT')
}
