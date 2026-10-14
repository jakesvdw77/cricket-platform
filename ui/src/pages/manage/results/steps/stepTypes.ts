import type { Match } from '../../../../api/matchApi'
import type { ResultDraft } from '../../../../api/matchResultApi'
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
  onGoToStep?: (id: string) => void
}
