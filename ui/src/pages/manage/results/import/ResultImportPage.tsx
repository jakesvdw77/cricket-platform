import { useState } from 'react'
import { Box, CircularProgress, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { readImportProblem } from '../../../../api/importErrors'
import type { ImportProblem } from '../../../../api/importErrors'
import type { Match } from '../../../../api/matchApi'
import { resultsKey } from '../../../../api/matchResultApi'
import type { ResultSide } from '../../../../api/matchResultApi'
import { getImportCatalogue, importKeys, previewImport, resolveImport } from '../../../../api/resultImportApi'
import type { ImportCatalogue, ImportPreview, ImportResolved, MatchCandidate } from '../../../../api/resultImportApi'
import { Button } from '../../../../components/Button'
import { EmptyState } from '../../../../components/EmptyState'
import { ManageScreenHeader } from '../../../../components/ManageScreenHeader'
import { ResultStepper } from '../../../../components/ResultStepper'
import { useDocumentTitle } from '../../../../hooks/useDocumentTitle'
import { resultCaptureTo } from '../resultListHelpers'
import { IMPORT_STEPS } from './importSteps'
import { saveImportNotes } from './importNotesStore'
import { chosenInput } from './importSource'
import type { ImportStepContext, SourceState } from './importWizardTypes'

const RESULTS_PATH = '/manage/results'

const EMPTY_SOURCE: SourceState = { adaptorType: null, format: null, tab: 'upload', paste: '', file: null }

const opposite = (side: ResultSide): ResultSide => (side === 'HOME' ? 'AWAY' : 'HOME')

// A single source needs no choosing: it is selected from the start.
function withDefaultSource(source: SourceState, catalogue: ImportCatalogue | undefined): SourceState {
  if (source.adaptorType !== null || !catalogue || catalogue.adaptors.length !== 1) return source
  const only = catalogue.adaptors[0]
  return { ...source, adaptorType: only.type, format: only.inputs[0]?.format ?? null }
}

// The server's proposed side of each file team (none for a team it could not place).
function mappingFrom(preview: ImportPreview): Record<string, ResultSide | null> {
  const mapping: Record<string, ResultSide | null> = {}
  for (const team of preview.document.teams ?? []) mapping[team.key] = null
  for (const item of preview.teamMapping) mapping[item.fileKey] = item.side
  return mapping
}

// Nothing is chosen for the manager when there is more than one candidate. The match the wizard was opened from, or the only
// candidate, is pre-selected (never a published one: it cannot take a result).
function initialSelection(preview: ImportPreview, launchedMatchId: string | null): string | null {
  const open = preview.matchCandidates.filter((candidate) => candidate.existingResult?.status !== 'PUBLISHED')
  const launched = open.find((candidate) => candidate.matchId === launchedMatchId)
  if (launched) return launched.matchId
  return preview.matchCandidates.length === 1 && open.length === 1 ? open[0].matchId : null
}

// docs/specs/104-match-results-import-adaptors.md: the import wizard at /manage/results/import (Source, Match, Teams), the
// front of the capture wizard. Its state lives here (the document `preview` returned goes back with `resolve`; nothing is
// written before the last step, and a reload starts again). Steps are registered as data in IMPORT_STEPS; the page owns the
// stepper (later steps are not clickable), the "Step N of 3" caption on a phone and the three calls. On success it clears
// the cached results and opens the capture wizard on the draft it saved.
export default function ResultImportPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const [searchParams] = useSearchParams()
  const launchedMatchId = searchParams.get('matchId')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useDocumentTitle('Import result')

  const catalogueQuery = useQuery({
    queryKey: importKeys.adaptors(clubId ?? ''),
    queryFn: () => getImportCatalogue(clubId as string),
    enabled: Boolean(clubId),
    staleTime: Infinity,
  })

  const [stepId, setStepId] = useState(IMPORT_STEPS[0].id)
  const [sourceState, setSourceState] = useState<SourceState>(EMPTY_SOURCE)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  // The match the last preview was made for (what `?matchId=` asked for, else the server's strongest candidate).
  const [basisMatchId, setBasisMatchId] = useState<string | null>(null)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, ResultSide | null>>({})
  const [replaceAck, setReplaceAck] = useState(false)
  const [dateAck, setDateAck] = useState(false)
  const [resolved, setResolved] = useState<ImportResolved | null>(null)
  const [sourceProblem, setSourceProblem] = useState<ImportProblem | null>(null)
  const [matchProblem, setMatchProblem] = useState<ImportProblem | null>(null)
  const [createProblem, setCreateProblem] = useState<ImportProblem | null>(null)

  const catalogue = catalogueQuery.data
  const source = withDefaultSource(sourceState, catalogue)
  const adaptor = catalogue?.adaptors.find((candidate) => candidate.type === source.adaptorType)
  const input = chosenInput(adaptor, source.format)
  const pasting = Boolean(input?.acceptsPaste) && source.tab === 'paste'

  const previewMutation = useMutation({
    mutationFn: ({ forMatchId }: { forMatchId: string | null }) =>
      previewImport(
        clubId as string,
        {
          adaptor: source.adaptorType as string,
          format: (input?.format ?? source.format) as string,
          ...(pasting ? { content: source.paste } : {}),
          ...(forMatchId ? { matchId: forMatchId } : {}),
        },
        pasting ? null : source.file,
      ),
  })
  const resolveMutation = useMutation({ mutationFn: (request: Parameters<typeof resolveImport>[1]) => resolveImport(clubId as string, request) })

  if (!clubId) {
    return <EmptyState title="Not authorised" description="No club is associated with your account." />
  }

  const stepIndex = Math.max(0, IMPORT_STEPS.findIndex((step) => step.id === stepId))
  const step = IMPORT_STEPS[stepIndex]
  const busy = previewMutation.isPending || resolveMutation.isPending

  const canContinue = Boolean(adaptor && input && (pasting ? source.paste.trim() !== '' && source.paste.length <= (catalogue?.limits.maxPasteCharacters ?? 0) : source.file !== null))

  const onContinue = () => {
    setSourceProblem(null)
    previewMutation.mutate(
      { forMatchId: launchedMatchId },
      {
        onSuccess: (data) => {
          setPreview(data)
          setBasisMatchId(launchedMatchId)
          setMatchId(initialSelection(data, launchedMatchId))
          setMapping(mappingFrom(data))
          setReplaceAck(false)
          setDateAck(false)
          setResolved(null)
          setMatchProblem(null)
          setCreateProblem(null)
          setStepId('match')
        },
        onError: (error) => setSourceProblem(readImportProblem(error)),
      },
    )
  }

  // The proposed mapping belongs to one match: when the manager chose another, the server proposes again for it.
  const onMatchNext = () => {
    if (!preview || !matchId) return
    setMatchProblem(null)
    const proposedFor = basisMatchId ?? preview.matchCandidates[0]?.matchId ?? null
    if (matchId === proposedFor) {
      setStepId('teams')
      return
    }
    previewMutation.mutate(
      { forMatchId: matchId },
      {
        onSuccess: (data) => {
          // The candidate list stays as first ranked; the document and the proposed mapping are the new ones.
          setPreview({ ...data, matchCandidates: preview.matchCandidates })
          setBasisMatchId(matchId)
          setMapping(mappingFrom(data))
          setStepId('teams')
        },
        onError: (error) => setMatchProblem(readImportProblem(error)),
      },
    )
  }

  // A match added from the Match step's dialog: the preview is made again for it (the new proposed mapping), the candidates
  // are the server's, with the new match added when the server did not rank it, and it is chosen. The document is kept as it was.
  const onMatchCreated = (match: Match) => {
    if (!preview) return
    void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
    const added: MatchCandidate = {
      matchId: match.id,
      label: `${match.homeTeamName ?? ''} v ${match.awayTeamName ?? ''}`,
      matchDate: match.matchDate,
      homeName: match.homeTeamName ?? '',
      awayName: match.awayTeamName ?? '',
      homeIsClubTeam: Boolean(match.homeTeamId),
      awayIsClubTeam: Boolean(match.awayTeamId),
      leagueName: null,
      venue: match.venue,
      reasons: [],
      existingResult: null,
    }
    const choose = (data: ImportPreview | null) => {
      const ranked = data?.matchCandidates ?? preview.matchCandidates
      const candidates = ranked.some((item) => item.matchId === match.id) ? ranked : [...ranked, added]
      setPreview({ ...(data ?? preview), document: preview.document, matchCandidates: candidates })
      setBasisMatchId(match.id)
      setMatchId(match.id)
      setReplaceAck(false)
      setDateAck(false)
      setMatchProblem(null)
      if (data) setMapping(mappingFrom(data))
    }
    previewMutation.mutate({ forMatchId: match.id }, { onSuccess: choose, onError: () => choose(null) })
  }

  const onCreate = () => {
    if (!preview || !matchId) return
    const teams = preview.document.teams ?? []
    if (!teams.every((team) => mapping[team.key])) return
    const candidate = preview.matchCandidates.find((item) => item.matchId === matchId)
    setCreateProblem(null)
    resolveMutation.mutate(
      {
        document: preview.document,
        matchId,
        teamMapping: teams.map((team) => ({ fileKey: team.key, side: mapping[team.key] as ResultSide })),
        replaceExistingDraft: candidate?.existingResult?.status === 'DRAFT' && replaceAck,
      },
      {
        onSuccess: (data) => {
          setResolved(data)
          // What the import said about each name travels to the capture wizard for the Guess chips.
          saveImportNotes(clubId, data.matchId, data.notes)
        },
        onError: (error) => setCreateProblem(readImportProblem(error)),
      },
    )
  }

  const context: ImportStepContext = {
    clubId,
    catalogue: catalogue as ImportCatalogue,
    source,
    onSourceChange: (patch) => setSourceState({ ...source, ...patch }),
    previewing: previewMutation.isPending && stepId === 'source',
    sourceProblem,
    canContinue,
    onContinue,

    preview,
    launchedMatchId,
    matchId,
    onMatchChange: (next) => {
      setMatchId(next)
      setReplaceAck(false)
      setDateAck(false)
      setMatchProblem(null)
    },
    onMatchCreated,
    onMatchFound: onMatchCreated,
    matchPending: previewMutation.isPending && stepId === 'match',
    matchProblem,
    onMatchNext,
    dateAck,
    onDateAckChange: setDateAck,

    mapping,
    onMappingChange: (fileKey, side) => {
      const others = (preview?.document.teams ?? []).filter((team) => team.key !== fileKey)
      setMapping({ ...mapping, [fileKey]: side, ...Object.fromEntries(others.map((team) => [team.key, opposite(side)])) })
    },
    onSwap: () => {
      const [first, second] = preview?.document.teams ?? []
      if (first && second) setMapping({ ...mapping, [first.key]: mapping[second.key] ?? null, [second.key]: mapping[first.key] ?? null })
    },
    replaceAck,
    onReplaceAckChange: setReplaceAck,
    creating: resolveMutation.isPending,
    createProblem,
    resolved,
    onCreate,
    onReview: () => {
      // The capture wizard keeps a loaded result for good, so the draft this import just wrote must be read afresh.
      queryClient.removeQueries({ queryKey: resultsKey(clubId) })
      void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
      navigate(`${resultCaptureTo(resolved?.matchId ?? (matchId as string))}?imported=1`)
    },
    onBack: () => setStepId(IMPORT_STEPS[Math.max(0, stepIndex - 1)].id),
  }

  let body
  if (catalogueQuery.isPending) {
    body = (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} aria-label="Loading sources" />
      </Box>
    )
  } else if (catalogueQuery.isError || !catalogue) {
    body = (
      <EmptyState
        title="Couldn't load the sources"
        description="Something went wrong. Please try again."
        action={<Button onClick={() => void catalogueQuery.refetch()}>Try again</Button>}
      />
    )
  } else if (catalogue.adaptors.length === 0) {
    body = <EmptyState title="No sources to import from" description="No import sources are available for your club yet." />
  } else {
    body = step.render(context)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2.5 }, minWidth: 0 }}>
      <ManageScreenHeader
        title="Import result"
        subtitle="Bring a result in from another source"
        backTo={RESULTS_PATH}
        backLabel="Back to Results"
        action={
          <Button variant="secondary" onClick={() => navigate(RESULTS_PATH)} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            Cancel
          </Button>
        }
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <ResultStepper
          steps={IMPORT_STEPS.map(({ id, label }) => ({ id, label }))}
          activeId={step.id}
          // Only back: a later step is reached with the step's own button, once what it needs is there.
          onSelect={(id) => {
            if (IMPORT_STEPS.findIndex((candidate) => candidate.id === id) < stepIndex && !resolved) setStepId(id)
          }}
          disabled={busy}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' } }}>
          Step {stepIndex + 1} of {IMPORT_STEPS.length}
        </Typography>
      </Box>

      {body}
    </Box>
  )
}
