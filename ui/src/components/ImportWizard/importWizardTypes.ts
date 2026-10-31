import type { ReactNode } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import type { ImportBatch, ImportIssue, ImportDecisions, ImportScope, ImportScopeMode, ImportTemplateScope, ImportType, PlannedChange, ReferenceCandidate, ReferenceProposal } from '../../api/importApi'
import type { ImportColumnOptions, ImportOptionPick } from '../../utils/importDecisions'
import type { DescribedChange } from '../ImportConfirmPanel'
import type { ImportColumn, ImportEditLayout } from '../ImportIssueTable'
import type { ImportResultLink } from '../ImportResultReport'
import type { ResolverCreateOptions } from '../ReferenceResolver'

export type ImportStepId = 'upload' | 'rows' | 'identify' | 'resolve' | 'review' | 'report'

// The consumer's own words (every default is generic).
export interface ImportWizardLabels {
  // "Match teams" is the label of the Resolve step in the approved design; another type names its own thing.
  resolveStep: string
  identifyStep: string
  // The Check rows and Done (report) steps' names ("Check", "Done").
  rowsStep: string
  reportStep: string
  // The line above the Identify step's cards.
  identifyDescription: string
  createLabel: string
  // What the resolver's values are called in its progress line.
  noun: string
  // The neutral chip of a row that only waits for the Match teams step on Check rows.
  pendingRowsLabel: string
  // The reason of such a row: with an exact match proposed (name, source in words), and without one. Neutral defaults when omitted.
  pendingLinkedLabel?: (name: string, source: string) => string
  pendingUnmatchedLabel?: string
  pendingCreatedLabel?: string
  entityLabels: Record<string, string>
  // Spec 125, only for an editable type: the Upload step's button that starts with no rows, and the table's empty state.
  startBlankLabel: string
  emptyRowsLabel: string
  templateScopeLabels?: Record<ImportTemplateScope, string>
  scopeModeLabels?: Record<ImportScopeMode, string>
  scopeModeHelp?: Record<ImportScopeMode, string>
}

// What every step is rendered with: the wizard's one state and how to change it (the same shape as the results import's
// ImportStepContext). The state itself lives in the server batch; this is only the view of it.
export interface ImportStepContext {
  clubId: string
  type: ImportType
  scope: ImportScope
  onScopeChange: (patch: Partial<Pick<ImportScope, 'scopeMode' | 'templateScope'>>) => void
  labels: ImportWizardLabels

  batch: ImportBatch | null
  decisions: ImportDecisions
  onDecisionsChange: (next: ImportDecisions) => void
  // Issue codes the later steps clear: Check rows does not block on them.
  deferredCodes: string[]
  notOurs: string[]
  onNotOursChange: (next: string[]) => void
  onToggleExclude: (rowNumber: number) => void
  onToggleUpdate: (rowNumber: number) => void
  // Spec 125 (an editable type): each is one decisions save.
  onEditRow: (rowNumber: number, values: Record<string, string>, picks?: ImportOptionPick[]) => void
  onAddRow: (values: Record<string, string>, picks?: ImportOptionPick[]) => void
  onRemoveRow: (rowNumber: number) => void
  onResetRow: (rowNumber: number) => void
  // A decisions save is in flight: controls wait.
  saving: boolean
  problem: string | null

  columns?: ImportColumn[]
  renderProposalExtras?: (proposal: ReferenceProposal, candidate: ReferenceCandidate) => ReactNode
  candidateBadge?: (candidate: ReferenceCandidate) => string | null
  describeChange?: (change: PlannedChange) => DescribedChange
  resultLinks?: ImportResultLink[]
  invalidateKeys?: QueryKey[]
  createOptions?: ResolverCreateOptions
  // Spec 125: type-ahead suggestions per editable column key (the consumer's data; free text is still accepted).
  columnOptions?: ImportColumnOptions
  editLayout?: ImportEditLayout
  collapseLowCandidates?: boolean
  confirmLabel?: string

  // Check rows: the consumer's settings control, already rendered with the wizard's decisions (beside the Problems only switch).
  checkSettings?: ReactNode

  // Upload step.
  // The consumer's own controls on the Upload step (for example "Advanced"), already rendered with the wizard's state.
  uploadExtras?: ReactNode
  file: File | null
  onFileChange: (file: File | null) => void
  uploading: boolean
  onUpload: () => void
  // Starts with no rows and no file (an editable type); the batch is discarded-and-replaced like an upload.
  onStartBlank: () => void
  startingBlank: boolean

  // Review step.
  confirming: boolean
  onConfirm: () => void

  // Review's "Change teams" / "Change our teams": open a team step that was skipped because nothing was in doubt.
  onChangeTeams?: () => void
  onChangeOurs?: () => void
  onBack: () => void
  // Saves the decisions, then moves on.
  onNext: () => void
  // Moves on without saving (Upload, when a batch already exists).
  onSkipUpload: () => void
}

// What decides whether a step is in the flow. `current` is the step on screen (null when asking what comes next): a step the user is
// on stays in the flow until they leave it, so settling its last name does not make it vanish under them, and Change teams can open it.
export type ImportStepAppliesContext = Pick<ImportStepContext, 'type' | 'scope' | 'batch' | 'decisions' | 'notOurs'> & { current: ImportStepId | null }

export interface ImportStepRegistration {
  id: ImportStepId
  label: string
  shortLabel?: string
  // Left out of the stepper (and of the flow) when this is false.
  applies?: (context: ImportStepAppliesContext) => boolean
  // Label from the consumer's words, when the step has one.
  labelFor?: (labels: ImportWizardLabels) => string
  render: (context: ImportStepContext) => ReactNode
}

// What a consumer's uploadExtras renders from: the extra scope params held by the wizard and how to change them.
export interface ImportUploadExtrasState {
  params: Record<string, string>
  onChange: (patch: Record<string, string>) => void
  disabled: boolean
}

// What a consumer's checkSettings renders from: the saved decisions, and a way to save a patch of decisions.options (one save, the
// server rechecks every row).
export interface ImportCheckSettingsState {
  decisions: ImportDecisions
  // The batch's current issues (empty before the first check), so a consumer can offer an action for a code it knows.
  issues: ImportIssue[]
  setOptions: (patch: Record<string, unknown>) => void
  disabled: boolean
}
