import { Alert, Box, Typography } from '@mui/material'
import { importCount } from '../../api/importApi'
import { blockingErrorCount, hasOpenProposals, isProposalResolved, teamSummary } from '../../utils/importDecisions'
import { ImportConfirmPanel } from '../ImportConfirmPanel'
import { ImportIssueTable } from '../ImportIssueTable'
import { ImportResultReport } from '../ImportResultReport'
import { ImportUploadStep } from '../ImportUploadStep'
import { ReferenceResolver } from '../ReferenceResolver'
import { WizardFooter } from '../WizardFooter'
import type { ImportStepAppliesContext, ImportStepContext, ImportStepRegistration } from './importWizardTypes'

// Whether this import identifies what is ours first: the chosen scope mode, or the batch's own once it exists.
export function identifiesOurs({ type, scope, batch }: Pick<ImportStepContext, 'type' | 'scope' | 'batch'>): boolean {
  if (!type.supportsOursScope) return false
  return (batch?.scopeMode ?? scope.scopeMode) === 'OURS_ONLY'
}

// Spec 125 amendment: a team step is in the flow only while a name needs a decision (or while the user is on it).
export const identifyApplies = (context: ImportStepAppliesContext) => identifiesOurs(context) && (context.current === 'identify' || hasOpenProposals(context.batch, 'IDENTIFY_OURS', context.decisions, context.notOurs))
export const resolveApplies = (context: ImportStepAppliesContext) => context.current === 'resolve' || hasOpenProposals(context.batch, 'RESOLVE', context.decisions, context.notOurs)

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

function renderUploadStep(context: ImportStepContext) {
  const { clubId, type, scope, batch } = context
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <ImportUploadStep
        clubId={clubId}
        type={type}
        scope={scope}
        onScopeChange={context.onScopeChange}
        file={context.file}
        onFileChange={context.onFileChange}
        uploading={context.uploading}
        error={context.problem}
        earlierImportWarning={batch?.earlierImportWarning}
        templateScopeLabels={context.labels.templateScopeLabels}
        scopeModeLabels={context.labels.scopeModeLabels}
        scopeModeHelp={context.labels.scopeModeHelp}
        extras={context.uploadExtras}
        onStartBlank={type.editable ? context.onStartBlank : undefined}
        startBlankLabel={context.labels.startBlankLabel}
        startingBlank={context.startingBlank}
      />
      <WizardFooter
        primary={{ label: context.uploading ? 'Checking the File...' : 'Upload and Check Rows', onClick: context.onUpload, disabled: !context.file || context.uploading || context.startingBlank }}
        secondary={batch ? { label: 'Keep the Current Check', onClick: context.onSkipUpload, disabled: context.uploading } : undefined}
        note="Nothing is saved at this step."
      />
    </Box>
  )
}

function renderRowsStep(context: ImportStepContext) {
  const { batch, decisions } = context
  if (!batch) return null
  const errors = batch.issues ? blockingErrorCount(batch.issues, decisions, context.deferredCodes) : importCount(batch, 'errors')
  // Spec 125: only a type that declares editable columns gets Edit, Add row and Remove.
  const editing = context.type.editable && context.type.editableColumns?.length
    ? { editableColumns: context.type.editableColumns, onEditRow: context.onEditRow, onAddRow: context.onAddRow, onRemoveRow: context.onRemoveRow, onResetRow: context.onResetRow, emptyLabel: context.labels.emptyRowsLabel }
    : {}
  const rowsFooter = (
    <WizardFooter
      inlineNote
      back={{ label: 'Back', onClick: context.onBack }}
      primary={{ label: 'Next', onClick: context.onNext, disabled: errors > 0 || context.saving }}
      note={errors > 0 ? <Box component="span" sx={{ color: 'error.main' }}>Fix or exclude {plural(errors, 'error', 'errors')} to continue.</Box> : 'Nothing is saved at this step.'}
    />
  )
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      {batch.earlierImportWarning && <Alert severity="warning">{batch.earlierImportWarning}</Alert>}
      {(batch.fileWarnings ?? []).map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
      <ImportIssueTable clubId={context.clubId} batch={batch} decisions={decisions} columns={context.columns} onToggleExclude={context.onToggleExclude} onToggleUpdate={context.onToggleUpdate} disabled={context.saving} deferredCodes={context.deferredCodes} columnOptions={context.columnOptions} editLayout={context.editLayout} pendingLabel={context.labels.pendingRowsLabel} pendingLinkedLabel={context.labels.pendingLinkedLabel} pendingUnmatchedLabel={context.labels.pendingUnmatchedLabel} pendingCreatedLabel={context.labels.pendingCreatedLabel} candidateBadge={context.candidateBadge} toolbarExtra={context.checkSettings} footer={rowsFooter} {...editing} />
    </Box>
  )
}

function renderResolverStep(context: ImportStepContext, mode: 'identify' | 'resolve') {
  const { batch, decisions, labels } = context
  if (!batch) return null
  const proposals = (batch.proposals ?? []).filter((proposal) => proposal.step === (mode === 'identify' ? 'IDENTIFY_OURS' : 'RESOLVE'))
  const open = proposals.filter((proposal) => !isProposalResolved(proposal, decisions, context.notOurs)).length
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minWidth: 0 }}>
      {mode === 'identify' && <Typography variant="body2" color="text.secondary">{labels.identifyDescription}</Typography>}
      <ReferenceResolver
        mode={mode}
        proposals={proposals}
        decisions={decisions}
        onDecisionsChange={context.onDecisionsChange}
        notOurs={context.notOurs}
        onNotOursChange={context.onNotOursChange}
        renderProposalExtras={context.renderProposalExtras}
        candidateBadge={context.candidateBadge}
        createLabel={labels.createLabel}
        noun={labels.noun}
        create={context.createOptions}
        collapseLow={context.collapseLowCandidates}
        disabled={context.saving}
      />
      <WizardFooter
        back={{ label: 'Back', onClick: context.onBack }}
        primary={{ label: 'Next', onClick: context.onNext, disabled: open > 0 || context.saving }}
        note={open > 0 ? <Box component="span" sx={{ color: 'error.main' }}>{plural(open, 'name still needs', 'names still need')} a decision.</Box> : 'Nothing is saved at this step.'}
      />
    </Box>
  )
}

function teamSummaryFor(context: ImportStepContext) {
  const proposals = context.batch?.proposals ?? []
  return proposals.some((proposal) => proposal.step === 'RESOLVE') ? teamSummary(proposals, context.decisions) : null
}

// docs/specs/097-import-framework.md, "The standard flow": the wizard's steps as data, like the results import's IMPORT_STEPS
// (a new step is a new entry, not another branch in the shell). Parse and Validate happen server-side as part of Upload, so the
// user's steps are Upload, Check rows, Identify ours (only in Ours-only mode), Match teams and Review.
export const IMPORT_STEPS: ImportStepRegistration[] = [
  { id: 'upload', label: 'Upload', render: renderUploadStep },
  { id: 'rows', label: 'Check rows', labelFor: (labels) => labels.rowsStep, render: renderRowsStep },
  { id: 'identify', label: 'Identify ours', labelFor: (labels) => labels.identifyStep, applies: identifyApplies, render: (context) => renderResolverStep(context, 'identify') },
  { id: 'resolve', label: 'Match teams', labelFor: (labels) => labels.resolveStep, applies: resolveApplies, render: (context) => renderResolverStep(context, 'resolve') },
  {
    id: 'review',
    label: 'Review',
    render: (context) =>
      context.batch ? (
        <ImportConfirmPanel
          batch={context.batch}
          decisions={context.decisions}
          onDecisionsChange={context.onDecisionsChange}
          describeChange={context.describeChange}
          entityLabels={context.labels.entityLabels}
          teamSummary={teamSummaryFor(context)}
          teamsLabel={context.labels.noun.charAt(0).toUpperCase() + context.labels.noun.slice(1)}
          onChangeTeams={context.onChangeTeams}
          changeOursLabel={context.labels.identifyStep}
          onChangeOurs={context.onChangeOurs}
          onBack={context.onBack}
          onConfirm={context.onConfirm}
          saving={context.saving}
          confirming={context.confirming}
          confirmLabel={context.confirmLabel}
          errorMessage={context.problem}
        />
      ) : null,
  },
]

// Shown instead of the flow once a batch is committed (or deleted): the report.
export const RESULT_STEPS: ImportStepRegistration[] = [
  {
    id: 'report',
    label: 'Report',
    labelFor: (labels) => labels.reportStep,
    render: (context) => (context.batch ? <ImportResultReport clubId={context.clubId} batch={context.batch} resultLinks={context.resultLinks} invalidateKeys={context.invalidateKeys} /> : null),
  },
]
