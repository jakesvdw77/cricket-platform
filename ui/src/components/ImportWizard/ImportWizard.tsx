import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import HistoryIcon from '@mui/icons-material/History'
import { useNavigate } from 'react-router-dom'
import { triggerDownload } from '../../utils/triggerDownload'
import { downloadImportTemplate, emptyImportDecisions, importErrorMessage, useAiHelp, useCommitImport, useDiscardImport, useImportBatch, useImportTypes, usePreviewImport, useSaveImportDecisions, useStartBlankImport } from '../../api/importApi'
import type { ImportBatch, ImportDecisions, ImportScope, ImportScopeMode, ImportTemplateScope, PlannedChange, ReferenceCandidate, ReferenceProposal } from '../../api/importApi'
import { RESOLUTION_STEP_CODES, deriveNotOurs, hasDecisions, nextAddedRowNumber, removeAddedRow, resumeStepFor, seedDecisions, toggleExcluded, toggleUpdate, withAddedRow, withPickedResolutions, withRowEdit, withoutRowEdit } from '../../utils/importDecisions'
import type { ImportColumnOptions } from '../../utils/importDecisions'
import { Button } from '../Button'
import { ConvertWithAiPanel } from '../ConvertWithAiPanel'
import { EmptyState } from '../EmptyState'
import type { DescribedChange } from '../ImportConfirmPanel'
import { ImportHistoryPanel } from '../ImportHistoryPanel'
import type { ImportColumn, ImportEditLayout } from '../ImportIssueTable'
import type { ImportResultLink } from '../ImportResultReport'
import { ManageScreenHeader } from '../ManageScreenHeader'
import type { ResolverCreateOptions } from '../ReferenceResolver'
import { ResultStepper } from '../ResultStepper'
import { IMPORT_STEPS, RESULT_STEPS, identifiesOurs } from './importSteps'
import type { ImportCheckSettingsState, ImportStepContext, ImportStepId, ImportUploadExtrasState, ImportWizardLabels } from './importWizardTypes'

export interface ImportWizardProps {
  clubId: string
  // The import type (GET types): "LEAGUE_SCHEDULE".
  type: string
  // The consumer's scope: params (leagueId, seasonId ...) and the starting scope choices.
  scope: ImportScope
  title: string
  // The target line, "Importing into: <scopeLabel>", shown on every step.
  scopeLabel: string
  backTo: string
  backLabel?: string
  // Resume an existing batch (a PREVIEW opens at Check rows, a COMMITTED one at the report). The consumer keeps it in its URL.
  batchId?: string | null
  onBatchChange?: (batchId: string | null) => void
  // How a row is shown; omitted, the keys of the row values.
  columns?: ImportColumn[]
  renderProposalExtras?: (proposal: ReferenceProposal, candidate: ReferenceCandidate) => ReactNode
  candidateBadge?: (candidate: ReferenceCandidate) => string | null
  describeChange?: (change: PlannedChange) => DescribedChange
  resultLinks?: ImportResultLink[]
  // The keys of the data the import changes: refetched after a commit or a delete.
  invalidateKeys?: QueryKey[]
  labels?: Partial<ImportWizardLabels>
  // The consumer's own controls on the Upload step. What they change is merged into scope.params (the preview, the template and the
  // AI help all see it); `uploadExtrasDefaults` are the starting values (a resumed batch brings its own through scope.params).
  uploadExtras?: (state: ImportUploadExtrasState) => ReactNode
  uploadExtrasDefaults?: Record<string, string>
  // The consumer's settings control on Check rows, beside the Problems only switch: a node, or a function of the saved decisions.
  checkSettings?: ReactNode | ((state: ImportCheckSettingsState) => ReactNode)
  // Create new: the tidied name, abbreviation and duplicate hint of the Resolve step.
  createOptions?: ResolverCreateOptions
  // List the weak (below 70) candidates behind a button.
  collapseLowCandidates?: boolean
  // The Confirm button's wording, from the batch ("Confirm and create 6 teams and 90 matches").
  confirmLabelFor?: (batch: ImportBatch) => string
  // Issue codes that a later step clears, so Check rows lists them as pending and does not block on them.
  deferredCodes?: string[]
  // Spec 125: type-ahead suggestions for editable columns (key = column key), supplied by the consumer. Free text is still accepted.
  columnOptions?: ImportColumnOptions
  // Spec 125: order and grouping of an edited row's inputs (for example notes behind an Add note button).
  editLayout?: ImportEditLayout
  // Told which step is showing (and on mount), so a consumer can load its suggestions only while Check rows is on screen.
  onStepChange?: (step: ImportStepId) => void
}

const DEFAULT_LABELS: ImportWizardLabels = {
  resolveStep: 'Match teams',
  identifyStep: 'Identify ours',
  rowsStep: 'Check rows',
  reportStep: 'Report',
  identifyDescription: 'Confirm which of these are yours. Only rows that involve them are imported.',
  createLabel: 'Create', noun: 'names', pendingRowsLabel: 'Resolved in the team step',
  entityLabels: {},
  startBlankLabel: 'Start with no rows', emptyRowsLabel: 'No rows yet. Add the first row.',
}

// docs/specs/097-import-framework.md, "Generic frontend: ImportWizard": the shell of every import. A stepper over the steps
// registered as data (IMPORT_STEPS, and RESULT_STEPS once committed), the target line, the footer of each step and the
// resume-from-history behaviour. The state that matters lives in the server batch (revision, issues, proposals, token), so a
// reload with the batch id resumes; this component holds only the manager's choices on top of it (the decisions it sends on
// every change). A consumer supplies configuration, not layout.
export function ImportWizard({ clubId, type: typeName, scope: baseScope, title, scopeLabel, backTo, backLabel = 'Back', batchId: initialBatchId = null, onBatchChange, columns, renderProposalExtras, candidateBadge, describeChange, resultLinks, invalidateKeys, labels: labelOverrides, uploadExtras, uploadExtrasDefaults, checkSettings, createOptions, collapseLowCandidates, confirmLabelFor, deferredCodes = RESOLUTION_STEP_CODES, columnOptions, editLayout, onStepChange }: ImportWizardProps) {
  const navigate = useNavigate()
  const labels: ImportWizardLabels = { ...DEFAULT_LABELS, ...labelOverrides, entityLabels: { ...DEFAULT_LABELS.entityLabels, ...labelOverrides?.entityLabels } }
  const typesQuery = useImportTypes(clubId)
  const type = typesQuery.data?.find((candidate) => candidate.type === typeName)

  const [batchId, setBatchId] = useState<string | null>(initialBatchId)
  const [stepId, setStepId] = useState<ImportStepId>(initialBatchId ? 'rows' : 'upload')
  const [choices, setChoices] = useState<{ scopeMode: ImportScopeMode; templateScope: ImportTemplateScope }>({ scopeMode: baseScope.scopeMode ?? 'ALL', templateScope: baseScope.templateScope ?? 'OURS_AND_OTHERS' })
  const [extraParams, setExtraParams] = useState<Record<string, string>>(uploadExtrasDefaults ?? {})
  const [file, setFile] = useState<File | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<ImportDecisions>(emptyImportDecisions())
  const [seededKeys, setSeededKeys] = useState<string[]>([])
  const [notOurs, setNotOurs] = useState<string[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  // The batch whose saved decisions have been put into the state above (once per batch).
  const [restoredFor, setRestoredFor] = useState<string | null>(null)
  const tokenRequested = useRef(false)
  // Seeded decisions are saved to the server (so it revalidates) once for each set of proposals that adds some: a flag set while
  // seeding. Each proposal is seeded only the first time it is seen (seededKeys), so a save cannot trigger itself again.
  const seedSavePending = useRef(false)

  const batchQuery = useImportBatch(clubId, batchId)
  const batch = batchQuery.data ?? null
  const preview = usePreviewImport(clubId, typeName)
  const startBlank = useStartBlankImport(clubId, typeName)
  // The highest added-row number handed out in this session, so a removed row's number is never reused (spec 125).
  const lastAddedRow = useRef(0)
  const save = useSaveImportDecisions(clubId, batchId ?? '')
  const commit = useCommitImport(clubId, batchId ?? '', invalidateKeys)
  const discard = useDiscardImport(clubId)

  // A loaded or resumed batch brings the decisions the server saved: they replace the local state once, so a reload restores
  // exclusions, resolutions, ticks and acknowledgements. A resumed PREVIEW then opens at the step its state points to.
  const identifies = type ? identifiesOurs({ type, scope: { ...baseScope, scopeMode: choices.scopeMode }, batch }) : false
  const restorable = batch !== null && batch.id === batchId && restoredFor !== batch.id && (initialBatchId !== batch.id || type !== undefined)
  // An exact match or a remembered alias is taken as the manager's choice once (still shown and counted). Proposals arrive
  // with the batch and again after a save (the next step's), so each new key is seeded the first time it is seen.
  const unseeded = (batch?.proposals ?? []).filter((proposal) => !seededKeys.includes(`${proposal.step}:${proposal.key}`))
  if (restorable) {
    const saved = batch.decisions ?? emptyImportDecisions()
    const restoredNotOurs = deriveNotOurs(batch.proposals ?? [], saved)
    setRestoredFor(batch.id)
    if (hasDecisions(saved) || Object.keys(saved.options).length > 0) {
      setDecisions(saved)
      setNotOurs(restoredNotOurs)
      setSeededKeys((batch.proposals ?? []).map((proposal) => `${proposal.step}:${proposal.key}`))
    }
    if (initialBatchId === batch.id && batch.status === 'PREVIEW') setStepId(resumeStepFor(batch, saved, restoredNotOurs, identifies))
  } else if (unseeded.length > 0) {
    setSeededKeys([...seededKeys, ...unseeded.map((proposal) => `${proposal.step}:${proposal.key}`)])
    const seeded = seedDecisions(unseeded, decisions)
    if (seeded !== decisions && batch) seedSavePending.current = true
    setDecisions(seeded)
  }

  const scope: ImportScope = { ...baseScope, params: { ...baseScope.params, ...extraParams }, scopeMode: type?.supportsOursScope ? choices.scopeMode : null, templateScope: choices.templateScope }
  const finished = batch !== null && (batch.status === 'COMMITTED' || batch.status === 'DELETED')
  const stepContext = { type: type as NonNullable<typeof type>, scope, batch }
  // The team steps are in the flow only while a name needs a decision, or while the user is on one (spec 125 amendment).
  const appliesContext = { ...stepContext, decisions, notOurs }
  const flow = type ? IMPORT_STEPS.filter((step) => !step.applies || step.applies({ ...appliesContext, current: stepId })) : IMPORT_STEPS
  const steps = finished ? [...flow, ...RESULT_STEPS] : flow
  const activeId: ImportStepId = finished ? 'report' : flow.some((step) => step.id === stepId) ? stepId : flow[0].id
  useEffect(() => {
    onStepChange?.(activeId)
  }, [activeId, onStepChange])
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeId))
  const active = steps[activeIndex]
  const busy = preview.isPending || startBlank.isPending || save.isPending || commit.isPending

  const move = (id: ImportStepId) => {
    setProblem(null)
    setStepId(id)
  }

  const persist = (next: ImportDecisions) => {
    setDecisions(next)
    if (!batch || batch.status !== 'PREVIEW') return
    setProblem(null)
    save.mutate({ revision: batch.revision, decisions: next }, { onError: (error) => setProblem(importErrorMessage(error, 'We could not save your choices. Please try again.')) })
  }

  // The seeded exact and alias matches are saved once, with the batch's current revision, so the server drops the TEAM_UNRESOLVED
  // errors they answer. Only after the saved decisions were restored; names that first appear after an edit or an added row are
  // saved the same way, once for that set of proposals.
  useEffect(() => {
    if (!seedSavePending.current || !batch || batch.status !== 'PREVIEW' || restoredFor !== batch.id || save.isPending) return
    seedSavePending.current = false
    save.mutate({ revision: batch.revision, decisions }, { onError: (error) => setProblem(importErrorMessage(error, 'We could not save your choices. Please try again.')) })
  })

  // A resumed batch opening at Review has no confirmation token yet (only a decisions save returns one): save once to get it.
  useEffect(() => {
    if (stepId !== 'review' || !batch || batch.status !== 'PREVIEW' || batch.confirmationToken || tokenRequested.current || restoredFor !== batch.id) return
    tokenRequested.current = true
    save.mutate({ revision: batch.revision, decisions }, { onError: (error) => setProblem(importErrorMessage(error, 'We could not save your choices. Please try again.')) })
  })

  const onNext = async () => {
    if (!steps[activeIndex + 1] || !type) return
    let freshBatch: ImportBatch | null = batch
    let freshDecisions = decisions
    if (batch && batch.status === 'PREVIEW') {
      try {
        freshBatch = await save.mutateAsync({ revision: batch.revision, decisions })
      } catch (error) {
        setProblem(importErrorMessage(error, 'We could not save your choices. Please try again.'))
        return
      }
      // The save can bring the next step's names (and the matches they seed): ask what comes next from that fresh state.
      const newlySeen = (freshBatch.proposals ?? []).filter((proposal) => !seededKeys.includes(`${proposal.step}:${proposal.key}`))
      freshDecisions = seedDecisions(newlySeen, decisions)
    }
    const after = IMPORT_STEPS.findIndex((step) => step.id === activeId)
    const next = IMPORT_STEPS.slice(after + 1).find((step) => !step.applies || step.applies({ type, scope, batch: freshBatch, decisions: freshDecisions, notOurs, current: null }))
    move((next ?? steps[activeIndex + 1]).id)
  }

  // A new batch replaces the open preview (which is discarded) and starts again at Check rows.
  const adoptBatch = (created: ImportBatch, previous: string | null) => {
    if (previous) discard.mutate(previous)
    setBatchId(created.id)
    setRestoredFor(created.id)
    onBatchChange?.(created.id)
    setDecisions(emptyImportDecisions())
    setSeededKeys([])
    setNotOurs([])
    setFile(null)
    lastAddedRow.current = 0
    setStepId('rows')
  }
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

  const onUpload = () => {
    if (!file || !type) return
    setProblem(null)
    const previous = batch && batch.status === 'PREVIEW' ? batch.id : null
    preview.mutate(
      { file, scope, timeZone },
      {
        onSuccess: (created) => adoptBatch(created, previous),
        onError: (error) => setProblem(importErrorMessage(error, 'We could not read this file. Check it is the template and try again.')),
      },
    )
  }

  const onStartBlank = () => {
    if (!type?.editable) return
    setProblem(null)
    const previous = batch && batch.status === 'PREVIEW' ? batch.id : null
    startBlank.mutate(
      { scope, timeZone },
      {
        onSuccess: (created) => adoptBatch(created, previous),
        onError: (error) => setProblem(importErrorMessage(error, 'We could not start with no rows. Please try again.')),
      },
    )
  }

  const onConfirm = () => {
    if (!batch?.confirmationToken || !batch.creationsDigest) return
    setProblem(null)
    commit.mutate(
      { revision: batch.revision, confirmationToken: batch.confirmationToken, confirmedCreationsDigest: batch.creationsDigest },
      { onError: (error) => setProblem(importErrorMessage(error, 'We could not import. Nothing was saved. Please check the rows and try again.')) },
    )
  }

  const startAgain = () => {
    setBatchId(null)
    setRestoredFor(null)
    onBatchChange?.(null)
    setDecisions(emptyImportDecisions())
    setSeededKeys([])
    setNotOurs([])
    setStepId('upload')
  }

  const context: ImportStepContext = {
    clubId,
    type: type as NonNullable<typeof type>,
    scope,
    onScopeChange: (patch) => setChoices((current) => ({ scopeMode: patch.scopeMode ?? current.scopeMode, templateScope: patch.templateScope ?? current.templateScope })),
    labels,
    deferredCodes,
    batch,
    decisions,
    onDecisionsChange: persist,
    notOurs,
    onNotOursChange: setNotOurs,
    onToggleExclude: (rowNumber) => persist(toggleExcluded(decisions, rowNumber)),
    onToggleUpdate: (rowNumber) => persist(toggleUpdate(decisions, rowNumber)),
    onEditRow: (rowNumber, values, picks) => persist(withPickedResolutions(withRowEdit(decisions, rowNumber, values), picks)),
    onAddRow: (values, picks) => {
      const rowNumber = nextAddedRowNumber(decisions, lastAddedRow.current)
      lastAddedRow.current = rowNumber
      persist(withPickedResolutions(withAddedRow(decisions, { rowNumber, values }), picks))
    },
    onRemoveRow: (rowNumber) => persist(removeAddedRow(decisions, rowNumber)),
    onResetRow: (rowNumber) => persist(withoutRowEdit(decisions, rowNumber)),
    saving: save.isPending,
    problem,
    columns,
    renderProposalExtras,
    candidateBadge,
    describeChange,
    resultLinks,
    invalidateKeys,
    createOptions,
    columnOptions,
    editLayout,
    collapseLowCandidates,
    confirmLabel: batch && confirmLabelFor ? confirmLabelFor(batch) : undefined,
    checkSettings: typeof checkSettings === 'function' ? checkSettings({ decisions, issues: batch?.issues ?? [], setOptions: (patch) => persist({ ...decisions, options: { ...decisions.options, ...patch } }), disabled: save.isPending || busy }) : checkSettings,
    uploadExtras: uploadExtras?.({ params: extraParams, onChange: (patch) => setExtraParams((current) => ({ ...current, ...patch })), disabled: preview.isPending || startBlank.isPending }),
    file,
    onFileChange: (next) => {
      setProblem(null)
      setFile(next)
    },
    uploading: preview.isPending,
    onUpload,
    onStartBlank,
    startingBlank: startBlank.isPending,
    confirming: commit.isPending,
    onConfirm,
    onChangeTeams: () => move('resolve'),
    onChangeOurs: identifies && (batch?.proposals ?? []).some((proposal) => proposal.step === 'IDENTIFY_OURS') ? () => move('identify') : undefined,
    onBack: () => move(steps[Math.max(0, activeIndex - 1)].id),
    onNext: () => void onNext(),
    onSkipUpload: () => move('rows'),
  }

  let body: ReactNode
  if (typesQuery.isPending || (initialBatchId !== null && batchQuery.isPending && batch === null)) {
    body = <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} aria-label="Loading the import" /></Box>
  } else if (typesQuery.isError || !type) {
    body = <EmptyState title="This import is not available" description="We could not find this kind of import for your club." action={<Button size="compact" onClick={() => void typesQuery.refetch()}>Try again</Button>} />
  } else if (batchId && batchQuery.isError && !batch) {
    body = <EmptyState title="We could not open this import" description="It may have been removed, or it belongs to another club." action={<Button size="compact" onClick={startAgain}>Start a new import</Button>} />
  } else if (batch && (batch.status === 'DISCARDED' || batch.status === 'EXPIRED')) {
    body = (
      <EmptyState
        title={batch.status === 'EXPIRED' ? 'This import has expired' : 'This import was discarded'}
        description="Nothing was imported. Upload the file again to start a new import."
        action={<Button size="compact" onClick={startAgain}>Start a new import</Button>}
      />
    )
  } else if (active.id !== 'upload' && !batch) {
    body = <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} aria-label="Loading the import" /></Box>
  } else {
    body = active.render(context)
  }

  // Convert with AI: a header button while Upload is active; the help text is only requested once the dialog is open.
  const aiHelp = useAiHelp(clubId, typeName, scope, aiOpen)
  const aiTemplate = useMutation({
    mutationFn: (format: string) => downloadImportTemplate(clubId, typeName, format, scope),
    onSuccess: ({ blob, fileName }) => triggerDownload(URL.createObjectURL(blob), fileName),
  })
  const showAiButton = active.id === 'upload' && !finished

  const stepLabel = (step: (typeof steps)[number]) => (step.labelFor ? step.labelFor(labels) : step.label)
  const showGeneralProblem = problem !== null && active.id !== 'upload' && active.id !== 'review'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2.5 }, minWidth: 0 }}>
      <ManageScreenHeader
        title={title}
        subtitle={<Typography component="span" sx={{ fontWeight: 600 }}>Importing into: {scopeLabel}</Typography>}
        backTo={backTo}
        backLabel={backLabel}
        action={
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
            {showAiButton && (
              <Button size="compact" variant="secondary" startIcon={<AutoAwesomeOutlinedIcon />} aria-haspopup="dialog" onClick={() => setAiOpen(true)} sx={{ minHeight: { xs: 44, md: 32 } }}>
                Convert with AI
              </Button>
            )}
            <Button size="compact" variant="secondary" startIcon={<HistoryIcon />} onClick={() => setHistoryOpen(true)} sx={{ minHeight: { xs: 44, md: 32 } }}>
              Import history
            </Button>
          </Box>
        }
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <ResultStepper
          steps={steps.map((step) => ({ id: step.id, label: stepLabel(step) }))}
          activeId={active.id}
          // Only back: a later step is reached with the step's own button, once what it needs is there.
          onSelect={(id) => {
            const target = steps.findIndex((step) => step.id === id)
            if (!finished && target < activeIndex) move(id as ImportStepId)
          }}
          disabled={busy || finished}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
          Step {activeIndex + 1} of {steps.length}: {stepLabel(active)}
        </Typography>
      </Box>

      {showGeneralProblem && <Alert severity="error" role="alert">{problem}</Alert>}

      {body}

      <ConvertWithAiPanel
        open={aiOpen && showAiButton}
        onClose={() => setAiOpen(false)}
        prompt={aiHelp.data?.prompt}
        loading={aiHelp.isPending && aiHelp.fetchStatus !== 'idle'}
        error={aiHelp.isError}
        onRetry={() => void aiHelp.refetch()}
        onDownloadTemplate={() => aiTemplate.mutate(type?.formats[0] ?? 'xlsx')}
        downloadPending={aiTemplate.isPending}
      />

      <ImportHistoryPanel
        clubId={clubId}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        type={typeName}
        scopeKey={batch?.scopeKey ?? undefined}
        onOpenReport={(entry) => navigate(`/manage/imports/${entry.id}`)}
        onResume={(entry) => navigate(`/manage/imports/${entry.id}`)}
        invalidateKeys={invalidateKeys}
      />
    </Box>
  )
}
