import type { ReactNode } from 'react'
import type { ImportProblem } from '../../../../api/importErrors'
import type { Match } from '../../../../api/matchApi'
import type { ResultSide } from '../../../../api/matchResultApi'
import type { ImportCatalogue, ImportPreview, ImportResolved } from '../../../../api/resultImportApi'

// What the Source step collects. Held by the page, so a failed preview never loses the pasted text or the chosen file.
export interface SourceState {
  adaptorType: string | null
  format: string | null
  tab: 'upload' | 'paste' | 'other'
  paste: string
  file: File | null
}

// What every import step is rendered with: the page's one state and how to change it.
export interface ImportStepContext {
  clubId: string
  catalogue: ImportCatalogue

  // Step 1, Source.
  source: SourceState
  onSourceChange: (patch: Partial<SourceState>) => void
  previewing: boolean
  sourceProblem: ImportProblem | null
  canContinue: boolean
  onContinue: () => void

  // Step 2, Match.
  preview: ImportPreview | null
  // The match the wizard was opened from (`?matchId=`), if any.
  launchedMatchId: string | null
  matchId: string | null
  onMatchChange: (matchId: string) => void
  // A match was added from the Match step's dialog: it joins the candidates, is chosen, and the wizard stays on this step.
  onMatchCreated: (match: Match) => void
  // docs/specs/109-delete-empty-match.md: an empty match was deleted from the Match step; it leaves the candidates and, if it was chosen, the choice is cleared.
  onMatchDeleted: (matchId: string) => void
  matchPending: boolean
  matchProblem: ImportProblem | null
  onMatchNext: () => void
  // The required tick when the chosen match is more than a day away from the file's date; reset with each choice of match.
  dateAck: boolean
  onDateAckChange: (ticked: boolean) => void

  // Step 3, Teams.
  mapping: Record<string, ResultSide | null>
  onMappingChange: (fileKey: string, side: ResultSide) => void
  onSwap: () => void
  replaceAck: boolean
  onReplaceAckChange: (ticked: boolean) => void
  creating: boolean
  createProblem: ImportProblem | null
  resolved: ImportResolved | null
  onCreate: () => void
  onReview: () => void

  onBack: () => void
}

export interface ImportStepRegistration {
  id: string
  label: string
  render: (context: ImportStepContext) => ReactNode
}
