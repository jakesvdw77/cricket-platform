import type { Match } from '../../../api/matchApi'
import type { RecordCardBadge } from '../../../components/RecordCard'
import { resultCaptureTo, resultImportTo, resultViewTo } from '../results/resultListHelpers'

// docs/specs/100-match-results-core.md, Match integration: the Matches list and Match page read the match's real
// result state (`resultStatus`) instead of guessing "played" from the date. A match with no result is none; an
// inactive match offers no result action.
export type MatchResultState = 'none' | 'draft' | 'published'

export function resultStateOf(match: Pick<Match, 'resultStatus'>): MatchResultState {
  if (match.resultStatus === 'DRAFT') return 'draft'
  if (match.resultStatus === 'PUBLISHED') return 'published'
  return 'none'
}

export interface MatchResultAction {
  // The short caption under a footer icon, the full name for assistive tech, and where it goes.
  caption: string
  label: string
  to: string
}

export function resultActionFor(match: Pick<Match, 'id' | 'active' | 'resultStatus'>): MatchResultAction | null {
  const state = resultStateOf(match)
  if (state === 'published') return { caption: 'Result', label: 'View result', to: resultViewTo(match.id) }
  if (!match.active) return null
  if (state === 'draft') return { caption: 'Continue', label: 'Continue result', to: resultCaptureTo(match.id) }
  return { caption: 'Capture', label: 'Capture result', to: resultCaptureTo(match.id) }
}

// docs/specs/104: Import result for a match that has started and has no published result (an inactive match takes none). It
// opens the import wizard with this match preselected; the wizard still asks the manager to confirm it.
export function resultImportActionFor(match: Pick<Match, 'id' | 'active' | 'resultStatus' | 'matchDate'>, now = Date.now()): MatchResultAction | null {
  if (!match.active || resultStateOf(match) === 'published' || new Date(match.matchDate).getTime() > now) return null
  return { caption: 'Import', label: 'Import result', to: resultImportTo(match.id) }
}

// A draft is amber, a published result (the match is completed) green; no result shows nothing.
export function resultBadgeFor(match: Pick<Match, 'resultStatus'>): RecordCardBadge | null {
  const state = resultStateOf(match)
  if (state === 'draft') return { label: 'Result draft', tone: 'warning' }
  if (state === 'published') return { label: 'Completed', tone: 'active' }
  return null
}

// Owner decision 2026-11-01: a match that started less than this many hours ago and has no published result is Live; after that
// it is Awaiting Result. Eight hours covers a T20 and a one-day game; the Player Hub's server rule (docs/specs/135) uses the same number.
export const LIVE_WINDOW_HOURS = 8

export type MatchStatusKind = 'upcoming' | 'live' | 'awaiting' | 'draft' | 'completed' | 'inactive'

export interface MatchStatus {
  kind: MatchStatusKind
  label: string
  tone: RecordCardBadge['tone']
  // Where the chip goes: the result page when a result exists, Capture Result when Live or Awaiting Result; none otherwise.
  to?: string
  // Names the destination for assistive tech, for example "View result for Home v Away".
  ariaLabel?: string
}

// The Status column and chip of a match. Never empty: Upcoming, Live, Awaiting Result, Result draft, Completed or Inactive.
export function matchStatusFor(match: Pick<Match, 'id' | 'active' | 'resultStatus' | 'matchDate'>, matchName: string, now = Date.now()): MatchStatus {
  if (!match.active) return { kind: 'inactive', label: 'Inactive', tone: 'muted' }
  const state = resultStateOf(match)
  const action = resultActionFor(match)
  const link = action ? { to: action.to, ariaLabel: `${state === 'published' ? 'View' : state === 'draft' ? 'Continue' : 'Capture'} result for ${matchName}` } : {}
  if (state === 'published') return { kind: 'completed', label: 'Completed', tone: 'active', ...link }
  if (state === 'draft') return { kind: 'draft', label: 'Result draft', tone: 'warning', ...link }
  const started = new Date(match.matchDate).getTime() <= now
  if (!started) return { kind: 'upcoming', label: 'Upcoming', tone: 'neutral' }
  const live = now - new Date(match.matchDate).getTime() < LIVE_WINDOW_HOURS * 3_600_000
  return live ? { kind: 'live', label: 'Live', tone: 'open', ...link } : { kind: 'awaiting', label: 'Awaiting Result', tone: 'warning', ...link }
}
