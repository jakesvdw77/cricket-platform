import type { DismissalType } from '../api/matchResultApi'

// docs/specs/101-match-results-our-side-scorecard.md: how a batter's innings ended. Mirrors the backend's
// DismissalType enum (domain/DismissalType.java), including its two flags:
//  - wicket: counts toward the innings' wicket count (everything except Not out, Did not bat and Retired not out);
//  - bowlerCredited: counts toward a bowler's wickets. The other wickets (run-out, obstructing the field, handled ball,
//    hit ball twice, timed out, retired out) are "non-bowler wickets" for the bowling reconciliation.
// The frontend uses the flags only for conveniences (the wickets meter, the not-out auto-fill); the server's validation
// is authoritative.

export interface DismissalInfo {
  type: DismissalType
  label: string
  // Short type-ahead code in the How out field ("c" Caught, "cb" Caught and bowled).
  shortcut: string
  wicket: boolean
  bowlerCredited: boolean
}

export const DISMISSALS: readonly DismissalInfo[] = [
  { type: 'NOT_OUT', label: 'Not out', shortcut: 'n', wicket: false, bowlerCredited: false },
  { type: 'DID_NOT_BAT', label: 'Did not bat', shortcut: 'd', wicket: false, bowlerCredited: false },
  { type: 'BOWLED', label: 'Bowled', shortcut: 'b', wicket: true, bowlerCredited: true },
  { type: 'CAUGHT', label: 'Caught', shortcut: 'c', wicket: true, bowlerCredited: true },
  { type: 'CAUGHT_AND_BOWLED', label: 'Caught and bowled', shortcut: 'cb', wicket: true, bowlerCredited: true },
  { type: 'LBW', label: 'LBW', shortcut: 'l', wicket: true, bowlerCredited: true },
  { type: 'STUMPED', label: 'Stumped', shortcut: 's', wicket: true, bowlerCredited: true },
  { type: 'RUN_OUT', label: 'Run out', shortcut: 'r', wicket: true, bowlerCredited: false },
  { type: 'HIT_WICKET', label: 'Hit wicket', shortcut: 'hw', wicket: true, bowlerCredited: true },
  { type: 'HANDLED_BALL', label: 'Handled the ball', shortcut: 'hb', wicket: true, bowlerCredited: false },
  { type: 'OBSTRUCTING_FIELD', label: 'Obstructing the field', shortcut: 'of', wicket: true, bowlerCredited: false },
  { type: 'HIT_BALL_TWICE', label: 'Hit the ball twice', shortcut: 'ht', wicket: true, bowlerCredited: false },
  { type: 'TIMED_OUT', label: 'Timed out', shortcut: 'to', wicket: true, bowlerCredited: false },
  { type: 'RETIRED_NOT_OUT', label: 'Retired not out', shortcut: 'rn', wicket: false, bowlerCredited: false },
  { type: 'RETIRED_OUT', label: 'Retired out', shortcut: 'ro', wicket: true, bowlerCredited: false },
]

const BY_TYPE = new Map(DISMISSALS.map((info) => [info.type, info]))

export const dismissalInfo = (type: DismissalType): DismissalInfo => BY_TYPE.get(type) as DismissalInfo

export const dismissalLabel = (type: DismissalType | null | undefined): string =>
  type ? dismissalInfo(type).label : ''

// A wicket counts toward the innings' wicket count.
export const isWicket = (type: DismissalType | null | undefined): boolean => (type ? dismissalInfo(type).wicket : false)

export const isBowlerCredited = (type: DismissalType | null | undefined): boolean =>
  type ? dismissalInfo(type).bowlerCredited : false

// A wicket not credited to a bowler (run-out, retired out and the like).
export const isNonBowlerWicket = (type: DismissalType | null | undefined): boolean =>
  isWicket(type) && !isBowlerCredited(type)

// Whether the row batted at all: anything but Did not bat. An undecided row (null) is treated as batted.
export const hasBatted = (type: DismissalType | null | undefined): boolean => type !== 'DID_NOT_BAT'

// The dismissals whose shortcut or label starts with what was typed, the best match first: an exact shortcut ("c" is
// Caught, not Caught and bowled), then shortcut prefixes, then label prefixes. Empty text matches every dismissal.
export function matchDismissals(text: string): DismissalInfo[] {
  const typed = text.trim().toLowerCase()
  if (typed === '') return [...DISMISSALS]
  const exact = DISMISSALS.filter((info) => info.shortcut === typed)
  const byShortcut = DISMISSALS.filter((info) => info.shortcut !== typed && info.shortcut.startsWith(typed))
  const byLabel = DISMISSALS.filter(
    (info) => !exact.includes(info) && !byShortcut.includes(info) && info.label.toLowerCase().startsWith(typed),
  )
  return [...exact, ...byShortcut, ...byLabel]
}

// The dismissal that Enter accepts for the typed text, or null when nothing matches.
export const bestDismissal = (text: string): DismissalType | null => matchDismissals(text)[0]?.type ?? null
