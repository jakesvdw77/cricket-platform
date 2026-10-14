import type { Match } from '../../../../api/matchApi'
import type { ResultDraft, ResultSide, ScorecardPrefill } from '../../../../api/matchResultApi'
import type { ResultSideInfo } from '../resultListHelpers'

// What every wizard step receives from ResultCapturePage: the one form state and how to change it.
export interface StepProps {
  clubId: string
  match: Match
  draft: ResultDraft
  // Shallow-merges into the draft.
  onChange: (patch: Partial<ResultDraft>) => void
  // Replaces the draft (for edits that touch several fields, such as adding a super over).
  onReplace: (next: ResultDraft) => void
  sides: [ResultSideInfo, ResultSideInfo]
  disabled?: boolean
  // Jumps to another step (saving first); the Scores step uses it to link back to the toss.
  // `side` also opens that side's tab on a scorecard step. `draftOverride` is saved instead of the page's current draft,
  // for a step that changes the draft and leaves in the same tap (Don't capture the team).
  onGoToStep?: (id: string, side?: ResultSide, draftOverride?: ResultDraft) => void
  // Whether the order of the innings is known (the toss fixes it, or the manager said who batted first, or scores exist),
  // and how to say it. Until it is known the innings cards are not shown.
  battingOrderKnown?: boolean
  onBattingOrder?: (first: ResultSide) => void
  // True when the scorecard steps are part of the wizard for this draft (the Scores step offers them).
  scorecardAvailable?: boolean
  // Saves the draft, then navigates (so leaving the wizard loses no edits); stays put when the save is refused.
  onSaveAndNavigate?: (to: string) => void
}

// One of the club's own sides in this match (two in a derby): its scorecard is entered in the scorecard steps.
export interface OurSide {
  side: ResultSide
  teamId: string
  teamName: string
}

export type PrefillState = 'loading' | 'ready' | 'unavailable'

// docs/specs/101-match-results-our-side-scorecard.md: what the scorecard steps (Teams, Batting, Bowling and fielding,
// Awards) receive on top of the shared step props. The scorecard itself lives in `draft.scorecard`.
export interface ScorecardStepProps extends StepProps {
  oursSides: OurSide[]
  prefill: ScorecardPrefill | null
  prefillState: PrefillState
  // The side shown on the scorecard steps (the side toggle): an ours side or the opposition.
  scorecardSide: ResultSide
  onScorecardSideChange: (side: ResultSide) => void
}
