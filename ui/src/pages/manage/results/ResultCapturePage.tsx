import { useState } from 'react'
import type { ReactNode } from 'react'
import { Alert, Box, Typography } from '@mui/material'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
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
import { applySuggestion, draftFromResult, isBlankDraft, scorecardStepsApplicable, toPayload } from './resultDraftHelpers'
import { ownSidesOf, resultSides, resultViewTo } from './resultListHelpers'
import { mergeSuggestions, normalizeLoaded } from './scorecardDraft'
import { AwardsStep } from './steps/AwardsStep'
import { OurBattingStep } from './steps/OurBattingStep'
import { OurBowlingStep } from './steps/OurBowlingStep'
import { OutcomeStep } from './steps/OutcomeStep'
import { ReviewStep } from './steps/ReviewStep'
import { ScoresStep } from './steps/ScoresStep'
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

// docs/specs/100-match-results-core.md: the wizard's steps as a registration list. Slices 101 and 102 add their steps
// (Our batting, Our bowling and fielding, ...) here, after "scores" and before "review", without touching the page or
// stepper. Toss comes before scores because the toss decides who batted first.
const RESULT_STEPS: StepRegistration[] = [
  { id: 'outcome', label: 'Result', render: (context) => <OutcomeStep {...context} /> },
  { id: 'toss', label: 'Toss & field', shortLabel: 'Toss', render: (context) => <TossFieldStep {...context} /> },
  { id: 'scores', label: 'Scores', render: (context) => <ScoresStep {...context} /> },
  // docs/specs/101: the optional scorecard steps, only once an innings has runs and the match was played.
  { id: 'our-batting', label: 'Our batting', optional: true, isApplicable: scorecardApplicable, render: (context) => <OurBattingStep {...context} /> },
  {
    id: 'our-bowling',
    label: 'Our bowling and fielding',
    shortLabel: 'Bowling',
    optional: true,
    isApplicable: scorecardApplicable,
    render: (context) => <OurBowlingStep {...context} />,
  },
  { id: 'awards', label: 'Awards', optional: true, isApplicable: scorecardApplicable, render: (context) => <AwardsStep {...context} /> },
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
  TOSS: 'Toss & field',
  SCORES: 'Scores',
  OUR_BATTING: 'Our batting',
  OUR_BOWLING: 'Our bowling and fielding',
  AWARDS: 'Awards',
}

// A refused save or publish, one line per issue naming the step (and, in a derby, the team) it concerns.
function problemLines(error: unknown, fallback: string, teamNames: Record<string, string> = {}, derby = false): string[] {
  const issues = errorIssues(error).filter((issue) => issue.severity !== 'INFO')
  if (issues.length > 0) {
    return issues.map((issue) => {
      const where = [issue.step ? STEP_LABEL[issue.step] : null, derby && issue.side ? teamNames[issue.side] : null].filter(Boolean).join(', ')
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
  const [scorecardSide, setScorecardSide] = useState<ResultSide>(oursSides[0]?.side ?? 'HOME')
  const [savedAt, setSavedAt] = useState<Date | null>(existing ? new Date(existing.updatedAt) : null)
  const [problems, setProblems] = useState<string[]>([])
  const [validation, setValidation] = useState<ResultValidation | null>(null)
  const [validationFailed, setValidationFailed] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: resultsKey(clubId) })
    void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
  }

  const saveMutation = useMutation({ mutationFn: (next: ResultDraft) => saveResultDraft(clubId, matchId, toPayload(next)) })
  const validateMutation = useMutation({ mutationFn: (next: ResultDraft) => validateResult(clubId, matchId, toPayload(next)) })
  const publishMutation = useMutation({ mutationFn: () => publishResult(clubId, matchId, acknowledged) })

  const update = (patch: Partial<ResultDraft>) => setDraft((current) => ({ ...current, ...patch }))

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
      setProblems(problemLines(error, "The draft couldn't be saved. Please try again.", { HOME: names.home, AWAY: names.away }, oursSides.length > 1))
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

  // Only the steps that apply to this draft (the scorecard steps wait for an innings with runs).
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

  const goTo = async (id: string, side?: ResultSide) => {
    if (!visibleSteps.some((step) => step.id === id)) return
    if (id === stepId) {
      if (side) setScorecardSide(side)
      return
    }
    const next = withSuggestedMargin(draft, names)
    if (next !== draft) setDraft(next)
    if (!(await save(next))) return
    if (side) setScorecardSide(side)
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
      setProblems(problemLines(error, "The result couldn't be published. Please try again.", { HOME: names.home, AWAY: names.away }, oursSides.length > 1))
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
    onReplace: setDraft,
    sides,
    disabled: busy,
    leagueScheduledBalls,
    onGoToStep: (id, side) => void goTo(id, side),
    scorecardAvailable: scorecardApplicable(draft, stepEnv),
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
  }

  const subtitle = [`${sides[0].name} v ${sides[1].name}`, formatMatchDateTime(match.matchDate), field?.name ?? match.venue]
    .filter(Boolean)
    .join(' · ')

  return (
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
  )
}

// docs/specs/100-match-results-core.md: the capture wizard at /manage/results/:matchId/capture. Loads the match and any
// stored draft, then hands them to CaptureWizard, which owns the one ResultDraft form state.
export default function ResultCapturePage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId } = useParams<{ matchId: string }>()
  const navigate = useNavigate()
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
  if (matchQuery.isError || resultQuery.isError || teamsQuery.isError || scorecardQuery.isError) {
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
      leagueScheduledBalls={
        conditionsQuery.data?.maxOversPerInnings ? conditionsQuery.data.maxOversPerInnings * (existing?.ballsPerOver ?? 6) : null
      }
    />
  )
}
