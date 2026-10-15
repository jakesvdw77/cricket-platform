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

// docs/specs/101 (dismissal bowler and fielder): which dismissals take a bowler and which a fielder. Mirrors the backend's
// DismissalType.allowsBowler() / allowsFielder(): a bowler for every bowler-credited dismissal (not a run-out), a fielder
// for a catch, a stumping and a run-out (a caught-and-bowled has only the bowler).
export const allowsBowler = (type: DismissalType | null | undefined): boolean => isBowlerCredited(type)
export const allowsFielder = (type: DismissalType | null | undefined): boolean =>
  type === 'CAUGHT' || type === 'STUMPED' || type === 'RUN_OUT'

// What the dismissals credit one player, mirroring the server's DismissalCredits (the server is authoritative: this only
// keeps the screen responsive between saves).
export interface Credit {
  wickets: number
  catches: number
  stumpings: number
  runOuts: number
}

export const NO_CREDIT: Credit = { wickets: 0, catches: 0, stumpings: 0, runOuts: 0 }

export interface Dismissal {
  howOut: DismissalType | null | undefined
  bowler: string | null | undefined
  fielder: string | null | undefined
}

// The credit of every player named on a dismissal; a player not named is absent.
export function deriveCredits(dismissals: Dismissal[]): Map<string, Credit> {
  const credits = new Map<string, Credit>()
  const add = (key: string, patch: Partial<Credit>) => {
    const current = credits.get(key) ?? NO_CREDIT
    credits.set(key, {
      wickets: current.wickets + (patch.wickets ?? 0),
      catches: current.catches + (patch.catches ?? 0),
      stumpings: current.stumpings + (patch.stumpings ?? 0),
      runOuts: current.runOuts + (patch.runOuts ?? 0),
    })
  }
  for (const { howOut, bowler, fielder } of dismissals) {
    if (!howOut) continue
    if (allowsBowler(howOut) && bowler) add(bowler, { wickets: 1, catches: howOut === 'CAUGHT_AND_BOWLED' ? 1 : 0 })
    if (fielder && allowsFielder(howOut)) {
      add(fielder, { catches: howOut === 'CAUGHT' ? 1 : 0, stumpings: howOut === 'STUMPED' ? 1 : 0, runOuts: howOut === 'RUN_OUT' ? 1 : 0 })
    }
  }
  return credits
}

export const hasFieldingCredit = (credit: Credit): boolean => credit.catches + credit.stumpings + credit.runOuts > 0

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

// docs/specs/101 (result page): how a batter's innings ended, written as a scorecard line from the already-labelled
// names of the fielder and bowler (labels come from PlayerName's labeler, so the Full name / First name choice applies).
// A missing name falls back to the plain word with the names that are known: "caught b Jones".
export function dismissalText(
  howOut: DismissalType | null | undefined,
  bowler?: string | null,
  fielder?: string | null,
): string {
  const by = bowler ? ` b ${bowler}` : ''
  switch (howOut) {
    case undefined:
    case null:
      return ''
    case 'CAUGHT':
      return fielder ? `c ${fielder}${by}` : `caught${by}`
    case 'CAUGHT_AND_BOWLED':
      return bowler ? `c & b ${bowler}` : 'caught and bowled'
    case 'STUMPED':
      return fielder ? `st ${fielder}${by}` : `stumped${by}`
    case 'BOWLED':
      return bowler ? `b ${bowler}` : 'bowled'
    case 'LBW':
      return `lbw${by}`
    case 'RUN_OUT':
      return fielder ? `run out (${fielder})` : 'run out'
    case 'HIT_WICKET':
      return `hit wicket${by}`
    case 'NOT_OUT':
      return 'not out'
    case 'DID_NOT_BAT':
      return 'did not bat'
    default:
      return dismissalLabel(howOut).toLowerCase()
  }
}
