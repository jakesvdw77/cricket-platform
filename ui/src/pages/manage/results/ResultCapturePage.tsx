import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState } from '../../../components/EmptyState'
import type { FieldPickerValue } from '../../../components/FieldPicker'
import { RecordFormScreen } from '../../../components/RecordFormScreen'
import { ResultStepper } from '../../../components/ResultStepper'
import { getMatch } from '../../../api/matchApi'
import type { Match } from '../../../api/matchApi'
import {
  getMatchResult,
  getScorecard,
  getScorecardPrefill,
  publishResult,
  resultKeys,
  resultsKey,
  saveResultDraft,
  validateResult,
} from '../../../api/matchResultApi'
import type { MatchResult, ResultDraft, ResultSide, ResultValidation, Scorecard, ScorecardPrefill } from '../../../api/matchResultApi'
import { getPlayingConditions } from '../../../api/leaguePlayingConditionsApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { checkMargin } from '../../../utils/marginCheck'
import { errorIssues, errorList, errorStatus, isNotFound } from '../../../utils/errorDetail'
import type { MarginCheck } from '../../../utils/marginCheck'
import { applyBattingOrder, applySuggestion, draftFromResult, firstBatterFromToss, hasRegularFigures, isBlankDraft, scorecardStepsApplicable, tossIncomplete, toPayload } from './resultDraftHelpers'
import { ownSidesOf, resultSides, resultViewTo } from './resultListHelpers'
import { defaultSideFor, mergeSuggestions, normalizeLoaded } from './scorecardDraft'
import { withCalculatedMargin } from './calculatedMargin'
import { ImportedChip } from './import/ImportedChip'
import { ImportReviewContext } from './import/importReviewContext'
import { readImportNotes, readOtherImportNotes } from './import/importNotesStore'
import { ImportNotesList } from './import/ImportNotesList'
import { importedProvider } from './import/importSource'
import { AwardsStep } from './steps/AwardsStep'
import { BattingStep } from './steps/BattingStep'
import { BowlingStep } from './steps/BowlingStep'
import { OutcomeStep } from './steps/OutcomeStep'
import { ReviewStep } from './steps/ReviewStep'
import { ScoresStep } from './steps/ScoresStep'
import { TeamsStep } from './steps/TeamsStep'
import type { OurSide, PrefillState, ScorecardStepProps, StepProps } from './steps/stepTypes'
import { TossFieldStep } from './steps/TossFieldStep'

// What a step is rendered with: the shared step props plus the page-owned pieces only some steps use.
interface StepContext extends StepProps, ScorecardStepProps {
  leagueScheduledBalls: number | null
  field: FieldPickerValue | null
  fieldChanged: boolean
  onFieldChange: (field: FieldPickerValue | null) => void
  check: MarginCheck
  needsAck: boolean
  onFix: () => void
  validation: ResultValidation | null
  validating: boolean
  validationFailed: boolean
  warningsAcknowledged: boolean
  onAcknowledgeChange: (acknowledged: boolean) => void
  onSaveForPreview: () => Promise<boolean>
}

interface StepRegistration {
  id: string
  label: string
  shortLabel?: string
  // docs/specs/101: a step the result can be published without; the stepper draws it dashed.
  optional?: boolean
  // Whether the step is part of the wizard for this draft; omitted, always. The wizard shows only the applicable steps.
  isApplicable?: (draft: ResultDraft, env: { oursSides: number }) => boolean
  render: (context: StepContext) => ReactNode
}

const scorecardApplicable = (draft: ResultDraft, env: { oursSides: number }) => env.oursSides > 0 && scorecardStepsApplicable(draft)

// docs/specs/100-match-results-core.md and docs/specs/101 (decision 22): the wizard's steps as a registration list; a new step
// is a new entry. Teams comes first because who is playing can be settled before the game, and is optional like the other
// scorecard steps; Toss then Result are always there (the toss fixes who batted first, and Result leads into Batting); Batting, Bowling and fielding and Awards apply to every match that was
// played (they are hidden once the outcome is a forfeit, an abandoned match or no result). The innings figures are typed on
// the scorecard steps; Scores and margin then checks the totals and settles the winner and margin.
const RESULT_STEPS: StepRegistration[] = [
  { id: 'teams', label: 'Teams', optional: true, render: (context) => <TeamsStep {...context} /> },
  { id: 'toss', label: 'Toss and field', shortLabel: 'Toss', render: (context) => <TossFieldStep {...context} /> },
  { id: 'outcome', label: 'Result', render: (context) => <OutcomeStep {...context} /> },
  { id: 'batting', label: 'Batting', optional: true, isApplicable: scorecardApplicable, render: (context) => <BattingStep {...context} /> },
  { id: 'bowling', label: 'Bowling and fielding', shortLabel: 'Bowling', optional: true, isApplicable: scorecardApplicable, render: (context) => <BowlingStep {...context} /> },
  { id: 'awards', label: 'Awards', optional: true, isApplicable: scorecardApplicable, render: (context) => <AwardsStep {...context} /> },
  { id: 'scores', label: 'Scores and margin', shortLabel: 'Scores', render: (context) => <ScoresStep {...context} /> },
  {
    id: 'review',
    label: 'Review',
    render: (context) => <ReviewStep {...context} fieldName={context.field?.name ?? null} />,
  },
]
const REVIEW_STEP_ID = 'review'

const RESULTS_PATH = '/manage/results'

const STEP_LABEL: Record<string, string> = {
  RESULT: 'Result',
  TOSS: 'Toss and field',
  SCORES: 'Scores',
  TEAMS: 'Teams',
  BATTING: 'Batting',
  BOWLING: 'Bowling and fielding',
  AWARDS: 'Awards',
}

// A refused save or publish, one line per issue naming the step (and, for a scorecard issue, the team) it concerns.
function problemLines(error: unknown, fallback: string, teamNames: Record<string, string> = {}): string[] {
  const issues = errorIssues(error).filter((issue) => issue.severity !== 'INFO')
  if (issues.length > 0) {
    return issues.map((issue) => {
      const where = [issue.step ? STEP_LABEL[issue.step] : null, issue.side && ['TEAMS', 'BATTING', 'BOWLING', 'AWARDS'].includes(issue.step ?? '') ? teamNames[issue.side] : null].filter(Boolean).join(', ')
      return where ? `${where}: ${issue.message}` : issue.message
    })
  }
  const errors = errorList(error)
  if (errors) return errors
  if (errorStatus(error) === 409) return ['This result has been published. Unpublish it before changing it.']
  return [fallback]
}

function initialField(match: Match, existing: MatchResult | null): FieldPickerValue | null {
  if (existing?.playingAreaId) {
    return { id: existing.playingAreaId, name: existing.playingAreaName ?? match.venue ?? 'Field', verificationStatus: null }
  }
  if (match.playingAreaId) {
    return {
      id: match.playingAreaId,
      name: match.playingAreaName ?? match.venue ?? 'Field',
      verificationStatus: match.playingAreaVerificationStatus ?? null,
    }
  }
  return null
}

// Fills the margin from the scores when the manager has not set one, so a tap on Next never loses the suggestion.
function withSuggestedMargin(draft: ResultDraft, names: { home: string; away: string }): ResultDraft {
  if (draft.outcomeType !== 'WON' || (draft.decidedBy ?? 'REGULAR') !== 'REGULAR') return draft
  if (draft.marginValue !== null && draft.marginValue !== undefined) return draft
  const suggestion = checkMargin(draft, names).suggestion
  if (!suggestion || suggestion.outcomeType !== 'WON' || suggestion.decidedBy !== 'REGULAR') return draft
  if (draft.winningSide && draft.winningSide !== suggestion.winningSide) return draft
  return applySuggestion(draft, suggestion)
}

function CaptureWizard({
  clubId,
  match,
  teams,
  existing,
  initialScorecard,
  prefill,
  prefillState,
  leagueScheduledBalls,
  justImported,
}: {
  clubId: string
  match: Match
  teams: Team[]
  existing: MatchResult | null
  // The stored scorecard (null when the result has none) and the team selection's proposed line-ups.
  initialScorecard: Scorecard | null
  prefill: ScorecardPrefill | null
  prefillState: PrefillState
  // The league's overs per innings in balls, or null for a friendly or a league with no overs set.
  leagueScheduledBalls: number | null
  // docs/specs/104: the manager has just come from the import wizard (`?imported=1`).
  justImported: boolean
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const teamsById = new Map(teams.map((team) => [team.id, team]))
  const sides = resultSides(match, teamsById)
  const names = { home: sides[0].name, away: sides[1].name }
  const matchId = match.id
  // The sides of this match that are the club's own: their scorecards are entered here (two in a derby).
  const ownSides = ownSidesOf(match, teamsById)
  const oursSides: OurSide[] = [
    ...(ownSides.home && match.homeTeamId ? [{ side: 'HOME' as const, teamId: match.homeTeamId, teamName: sides[0].name }] : []),
    ...(ownSides.away && match.awayTeamId ? [{ side: 'AWAY' as const, teamId: match.awayTeamId, teamName: sides[1].name }] : []),
  ]

  const [draft, setDraft] = useState<ResultDraft>(() => {
    const initial = draftFromResult(existing, initialScorecard)
    // A new result starts on the league's length; a stored value always wins.
    return initial.scheduledBalls == null && leagueScheduledBalls ? { ...initial, scheduledBalls: leagueScheduledBalls } : initial
  })
  const [field, setField] = useState<FieldPickerValue | null>(() => initialField(match, existing))
  const [stepId, setStepId] = useState(RESULT_STEPS[0].id)
  // Set once the manager says who batted first (no toss recorded), so the scorecard steps know the innings order.
  const [orderAsked, setOrderAsked] = useState(false)
  const [scorecardSide, setScorecardSide] = useState<ResultSide>(oursSides[0]?.side ?? 'HOME')
  const [savedAt, setSavedAt] = useState<Date | null>(existing ? new Date(existing.updatedAt) : null)
  const [problems, setProblems] = useState<string[]>([])
  const [validation, setValidation] = useState<ResultValidation | null>(null)
  const [validationFailed, setValidationFailed] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importedNoticeOpen, setImportedNoticeOpen] = useState(justImported)
  // docs/specs/104: an imported draft's provider (from its source) and what the import said about each name; a manual result
  // gets the empty default and shows no chips. The notes were left by the import page for this match (sessionStorage).
  const [importNotes] = useState(() => readImportNotes(clubId, matchId))
  const [otherNotes] = useState(() => readOtherImportNotes(clubId, matchId))
  const importProvider = importedProvider(existing?.source)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: resultsKey(clubId) })
    void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
  }

  const saveMutation = useMutation({ mutationFn: (next: ResultDraft) => saveResultDraft(clubId, matchId, toPayload(next)) })
  const validateMutation = useMutation({ mutationFn: (next: ResultDraft) => validateResult(clubId, matchId, toPayload(next)) })
  const publishMutation = useMutation({ mutationFn: () => publishResult(clubId, matchId, acknowledged) })

  // Every edit also keeps the calculated margin of a regular win in step with the scores (unless the manager edited it).
  const update = (patch: Partial<ResultDraft>) => setDraft((current) => withCalculatedMargin({ ...current, ...patch }, names))

  // Saves the draft (nothing is written for a form that is still empty). False when the server refused it.
  const save = async (next: ResultDraft): Promise<boolean> => {
    if (isBlankDraft(next)) return true
    try {
      await saveMutation.mutateAsync(next)
      setSavedAt(new Date())
      setProblems([])
      refresh()
      return true
    } catch (error) {
      setProblems(problemLines(error, "The draft couldn't be saved. Please try again.", { HOME: names.home, AWAY: names.away }))
      return false
    }
  }

  const runValidation = (next: ResultDraft) => {
    setValidation(null)
    setValidationFailed(false)
    setAcknowledged(false)
    validateMutation.mutate(next, {
      onSuccess: setValidation,
      onError: () => setValidationFailed(true),
    })
  }

  // Only the steps that apply to this draft (the scorecard steps are hidden for a forfeit, an abandoned match or no result).
  const stepEnv = { oursSides: oursSides.length }
  const visibleSteps = RESULT_STEPS.filter((step) => !step.isApplicable || step.isApplicable(draft, stepEnv))

  // After a save the server has run the standout rules: bring its suggested flags onto the entries (never anything else).
  // Failing to read them only leaves the stars as they were.
  const refreshSuggestions = async (saved: ResultDraft) => {
    if (!saved.scorecard?.players?.length) return
    try {
      const server = await queryClient.fetchQuery({ queryKey: resultKeys.scorecard(clubId, matchId), queryFn: () => getScorecard(clubId, matchId), staleTime: 0 })
      setDraft((current) => (current.scorecard ? { ...current, scorecard: mergeSuggestions(current.scorecard, server) } : current))
    } catch {
      // not fatal
    }
  }

  const goTo = async (id: string, side?: ResultSide, draftOverride?: ResultDraft) => {
    if (!visibleSteps.some((step) => step.id === id)) return
    if (id === stepId) {
      if (side) setScorecardSide(side)
      return
    }
    const next = withSuggestedMargin(draftOverride ?? draft, names)
    if (next !== draft) setDraft(next)
    if (!(await save(next))) return
    // Each scorecard step opens on its logical side (who bats first, who bowls first) unless a side was asked for.
    setScorecardSide(side ?? defaultSideFor(id, next, oursSides))
    if (id === 'awards') await refreshSuggestions(next)
    else void refreshSuggestions(next)
    setStepId(id)
    if (id === REVIEW_STEP_ID) runValidation(next)
  }

  const onSaveDraft = async () => {
    const next = withSuggestedMargin(draft, names)
    if (next !== draft) setDraft(next)
    await save(next)
  }

  const onPublish = async () => {
    setConfirmOpen(false)
    if (!(await save(draft))) return
    try {
      await publishMutation.mutateAsync()
      refresh()
      void queryClient.invalidateQueries({ queryKey: resultKeys.detail(clubId, matchId) })
      navigate(RESULTS_PATH)
    } catch (error) {
      setProblems(problemLines(error, "The result couldn't be published. Please try again.", { HOME: names.home, AWAY: names.away }))
    }
  }

  const index = Math.max(
    0,
    visibleSteps.findIndex((step) => step.id === stepId),
  )
  const current = visibleSteps[index]
  const previous = visibleSteps[index - 1]
  const following = visibleSteps[index + 1]
  const busy = saveMutation.isPending || publishMutation.isPending
  const onReview = current.id === REVIEW_STEP_ID
  // The scores disagreeing with the entered result is a warning like the server's: it needs the same tick.
  const check = checkMargin(draft, names)
  const needsAck = (validation?.warnings.length ?? 0) > 0 || check.status === 'mismatch'
  const canPublish =
    Boolean(validation) &&
    validation?.errors.length === 0 &&
    (!needsAck || acknowledged) &&
    !validateMutation.isPending &&
    !busy

  const context: StepContext = {
    clubId,
    match,
    draft,
    onChange: update,
    onReplace: (next) => setDraft(withCalculatedMargin(next, names)),
    sides,
    disabled: busy,
    leagueScheduledBalls,
    onGoToStep: (id, side, draftOverride) => void goTo(id, side, draftOverride),
    scorecardAvailable: scorecardApplicable(draft, stepEnv),
    battingOrderKnown:
      firstBatterFromToss(draft) !== null || orderAsked || hasRegularFigures(draft) || (existing?.innings.length ?? 0) > 0,
    onBattingOrder: (first) => {
      setOrderAsked(true)
      setDraft((current) => applyBattingOrder(current, first))
    },
    onSaveAndNavigate: (to) => {
      const next = withSuggestedMargin(draft, names)
      void save(next).then((saved) => saved && navigate(to))
    },
    oursSides,
    prefill,
    prefillState,
    scorecardSide,
    onScorecardSideChange: setScorecardSide,
    field,
    fieldChanged: Boolean(draft.playingAreaId && draft.playingAreaId !== match.playingAreaId),
    onFieldChange: (next) => {
      setField(next)
      update({ playingAreaId: next?.id ?? null })
    },
    validation,
    validating: validateMutation.isPending,
    validationFailed,
    check,
    needsAck,
    onFix: () => {
      if (!check.suggestion) return
      const fixed = applySuggestion(draft, check.suggestion)
      setDraft(fixed)
      runValidation(fixed)
    },
    warningsAcknowledged: acknowledged,
    onAcknowledgeChange: setAcknowledged,
    // docs/specs/104: the Review step's Preview result reads the saved draft, so it saves the current one first.
    onSaveForPreview: async () => {
      const next = withSuggestedMargin(draft, names)
      if (next !== draft) setDraft(next)
      return save(next)
    },
  }

  const subtitle = [`${sides[0].name} v ${sides[1].name}`, formatMatchDateTime(match.matchDate), field?.name ?? match.venue]
    .filter(Boolean)
    .join(' · ')

  return (
    <ImportReviewContext.Provider value={{ provider: importProvider, notes: importNotes }}>
    <RecordFormScreen
      title={existing ? 'Edit result' : 'Capture result'}
      backTo={RESULTS_PATH}
      backLabel="Back to Results"
      actions={
        <>
          <Button variant="secondary" onClick={() => void onSaveDraft()} disabled={busy}>
            {saveMutation.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          {previous && (
            <Button variant="ghost" onClick={() => void goTo(previous.id)} disabled={busy}>
              Back
            </Button>
          )}
          {onReview ? (
            <Button onClick={() => setConfirmOpen(true)} disabled={!canPublish}>
              Publish
            </Button>
          ) : (
            following && (
              <Button onClick={() => void goTo(following.id)} disabled={busy}>
                Next: {following.label}
              </Button>
            )
          )}
        </>
      }
    >
      <Box sx={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <ImportedChip source={existing?.source} />
        {importedNoticeOpen && importProvider && (
          <Alert
            severity="success"
            sx={{ alignItems: 'flex-start' }}
            action={
              <IconButton aria-label="Dismiss" onClick={() => setImportedNoticeOpen(false)} sx={{ width: 44, height: 44, mt: -0.5, mr: -0.5 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            }
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span>Draft created from the import. Nothing is published yet: check the names marked Guess, then review and publish.</span>
              {tossIncomplete(draft) && (
                <span data-testid="import-toss-notice">
                  <strong>The toss was not in the file.</strong> Check who batted first on the Toss step: a wrong order changes whether the win is by runs or by wickets.
                </span>
              )}
              <ImportNotesList notes={otherNotes} />
            </Box>
          </Alert>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
            {subtitle}
          </Typography>
          <Typography variant="caption" color="text.secondary" aria-live="polite">
            {savedAt ? `Draft saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not saved yet'}
          </Typography>
        </Box>

        <ResultStepper
          steps={visibleSteps.map(({ id, label, shortLabel, optional }) => ({ id, label, shortLabel, optional }))}
          activeId={current.id}
          onSelect={(id) => void goTo(id)}
          disabled={busy}
        />

        {problems.length > 0 && (
          <Alert severity="error">
            {problems.length === 1 ? (
              problems[0]
            ) : (
              <Box component="ul" sx={{ m: 0, pl: 2 }}>
                {problems.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </Box>
            )}
          </Alert>
        )}

        {current.render(context)}
      </Box>

      <ConfirmDialog
        open={confirmOpen}
        title="Publish this result?"
        description="Players will be able to see this result."
        confirmLabel="Publish"
        pendingLabel="Publishing…"
        pending={publishMutation.isPending}
        onConfirm={() => void onPublish()}
        onClose={() => setConfirmOpen(false)}
      />
    </RecordFormScreen>
    </ImportReviewContext.Provider>
  )
}

// docs/specs/100-match-results-core.md: the capture wizard at /manage/results/:matchId/capture. Loads the match and any
// stored draft, then hands them to CaptureWizard, which owns the one ResultDraft form state.
export default function ResultCapturePage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  useDocumentTitle('Capture result')

  const matchQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId],
    queryFn: () => getMatch(clubId as string, matchId as string),
    enabled: Boolean(clubId && matchId),
  })
  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })
  // 404 is the normal "nothing captured yet" answer, not an error.
  const resultQuery = useQuery({
    queryKey: resultKeys.detail(clubId ?? '', matchId ?? ''),
    queryFn: async () => {
      try {
        return await getMatchResult(clubId as string, matchId as string)
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
    enabled: Boolean(clubId && matchId),
    // The wizard owns the form once it has loaded; a background refetch must not replace what the manager is typing.
    staleTime: Infinity,
    gcTime: 0,
  })

  const leagueId = matchQuery.data?.leagueId ?? null
  const conditionsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'playing-conditions', leagueId, matchQuery.data?.seasonId],
    queryFn: () => getPlayingConditions(clubId as string, leagueId as string, matchQuery.data?.seasonId as string),
    enabled: Boolean(clubId && leagueId && matchQuery.data),
    staleTime: Infinity,
    gcTime: 0,
  })

  // Whether the result had a scorecard when the page opened. Fixed once known: a later refetch (every save invalidates the
  // results) must not put the loading state back and unmount the wizard that owns the form.
  const [hasScorecard, setHasScorecard] = useState<boolean | null>(null)
  if (hasScorecard === null && resultQuery.data !== undefined) setHasScorecard(Boolean(resultQuery.data?.hasScorecard))
  // The stored scorecard is the wizard's starting point, so a failure to read it blocks (saving would overwrite it).
  const scorecardQuery = useQuery({
    queryKey: resultKeys.scorecard(clubId ?? '', matchId ?? ''),
    queryFn: () => getScorecard(clubId as string, matchId as string),
    enabled: Boolean(clubId && matchId && hasScorecard === true),
    staleTime: Infinity,
    gcTime: 0,
  })
  // The team selection's proposed line-ups; the scorecard steps wait for them but the wizard never does, and a failure
  // only means the grids start empty.
  const prefillQuery = useQuery({
    queryKey: resultKeys.scorecardPrefill(clubId ?? '', matchId ?? ''),
    queryFn: () => getScorecardPrefill(clubId as string, matchId as string),
    enabled: Boolean(clubId && matchId),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }
  // The scorecard query only counts while it is enabled: it shares its key with the result page, whose refetch after a delete
  // leaves a cached 404 behind, and a disabled query still reports that old error.
  if (matchQuery.isError || resultQuery.isError || teamsQuery.isError || (hasScorecard === true && scorecardQuery.isError)) {
    return <EmptyState title="Couldn't load this match" description="Something went wrong loading the match. Please try again." />
  }
  // A league's playing conditions that fail to load only lose the pre-filled overs, so they never block the wizard.
  if (!matchQuery.data || !teamsQuery.data || resultQuery.data === undefined || (leagueId && conditionsQuery.isPending) || (hasScorecard === null || (hasScorecard && !scorecardQuery.data))) {
    return null
  }

  const existing = resultQuery.data
  if (existing?.status === 'PUBLISHED') {
    return (
      <EmptyState
        title="This result is published"
        description="Unpublish it to edit."
        action={
          <Button onClick={() => navigate(resultViewTo(matchId as string))}>
            View result
          </Button>
        }
      />
    )
  }

  return (
    <CaptureWizard
      clubId={clubId}
      match={matchQuery.data}
      teams={teamsQuery.data}
      existing={existing}
      initialScorecard={scorecardQuery.data ? normalizeLoaded(scorecardQuery.data) : null}
      prefill={prefillQuery.data ?? null}
      prefillState={prefillQuery.isPending ? 'loading' : prefillQuery.isError ? 'unavailable' : 'ready'}
      justImported={searchParams.get('imported') === '1'}
      leagueScheduledBalls={
        conditionsQuery.data?.maxOversPerInnings ? conditionsQuery.data.maxOversPerInnings * (existing?.ballsPerOver ?? 6) : null
      }
    />
  )
}
