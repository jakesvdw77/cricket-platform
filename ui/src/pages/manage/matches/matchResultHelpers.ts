import type { Match } from '../../../api/matchApi'
import type { RecordCardBadge } from '../../../components/RecordCard'
import { resultCaptureTo, resultViewTo } from '../results/resultListHelpers'

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

// A draft is amber, a published result (the match is completed) green; no result shows nothing.
export function resultBadgeFor(match: Pick<Match, 'resultStatus'>): RecordCardBadge | null {
  const state = resultStateOf(match)
  if (state === 'draft') return { label: 'Result draft', tone: 'warning' }
  if (state === 'published') return { label: 'Completed', tone: 'active' }
  return null
}
