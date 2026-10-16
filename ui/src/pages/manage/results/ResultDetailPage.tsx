import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link as RouterLink, Navigate, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button as MuiButton, Chip, Stack, Typography } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import ScoreboardOutlinedIcon from '@mui/icons-material/ScoreboardOutlined'
import SportsCricketOutlinedIcon from '@mui/icons-material/SportsCricketOutlined'
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState } from '../../../components/EmptyState'
import { KeyFigureTile } from '../../../components/KeyFigureTile'
import { PageHeaderBand } from '../../../components/PageHeaderBand'
import { ResultScoreLine } from '../../../components/ResultScoreLine'
import { badgeSx } from '../../../components/RecordCard'
import { getMatch } from '../../../api/matchApi'
import { deleteResultDraft, getMatchResult, resultKeys, resultsKey, unpublishResult } from '../../../api/matchResultApi'
import type { Innings, MatchResult } from '../../../api/matchResultApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { listLeagues } from '../../../api/leagueApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { isNotFound } from '../../../utils/errorDetail'
import { ballsToOvers } from '../../../utils/oversFormat'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { inningsFor, resultLine, resultPerspective } from '../../../utils/resultLine'
import { TeamLogo } from '../matches/TeamLogo'
import {
  ownSidesOf,
  PERSPECTIVE_COLOR,
  resultCaptureTo,
  resultEditTo,
  resultSides,
  tossLine,
  UNPUBLISH_TO_EDIT_REASON,
} from './resultListHelpers'
import { ImportedChip } from './import/ImportedChip'
import { ResultScorecard } from './ResultScorecard'
import { ResultSection } from './ResultSection'
import { usePublishResult } from './usePublishResult'

const RESULTS_PATH = '/manage/results'
const MATCHES_PATH = '/manage/fixtures/matches'
const NOT_RECORDED = 'Not recorded'

const OUTCOME_LABEL: Record<string, string> = {
  WON: 'Won',
  TIE: 'Tied',
  DRAW: 'Draw',
  NO_RESULT: 'No result',
  ABANDONED: 'Abandoned',
  FORFEIT: 'Forfeit',
}
const DECIDED_BY_LABEL: Record<string, string> = {
  REGULAR: 'Normal play',
  DLS: 'DLS method',
  SUPER_OVER: 'Super over',
}

// docs/specs/100-match-results-core.md, Result page: the read page of one match's result, on PageHeaderBand like the
// Match page. Draft: Edit (the wizard), Publish, Delete draft. Published: Unpublish, and Edit disabled until then.
export default function ResultDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId } = useParams<{ matchId?: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  useDocumentTitle('Result')

  const enabled = Boolean(clubId) && Boolean(matchId)

  const matchQuery = useQuery({
    queryKey: ['managed-club', clubId, 'matches', matchId],
    queryFn: () => getMatch(clubId as string, matchId as string),
    enabled,
  })
  // 404 is the normal "no result captured yet" answer.
  const resultQuery = useQuery({
    queryKey: resultKeys.detail(clubId as string, matchId as string),
    queryFn: async () => {
      try {
        return await getMatchResult(clubId as string, matchId as string)
      } catch (error) {
        if (isNotFound(error)) return null
        throw error
      }
    },
    enabled,
  })
  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })
  const leaguesQuery = useQuery({
    queryKey: ['managed-club', clubId, 'leagues'],
    queryFn: () => listLeagues(clubId as string),
    enabled: Boolean(clubId),
  })

  const teamsById = useMemo(() => new Map<string, Team>((teamsQuery.data ?? []).map((team) => [team.id, team])), [teamsQuery.data])

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: resultsKey(clubId as string) })
    void queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
  }

  const { publish, dialogs: publishDialogs } = usePublishResult(clubId ?? '')
  const [confirm, setConfirm] = useState<'unpublish' | 'delete' | null>(null)
  const [failed, setFailed] = useState(false)

  const unpublishMutation = useMutation({
    mutationFn: () => unpublishResult(clubId as string, matchId as string),
    onSuccess: () => {
      setConfirm(null)
      refresh()
    },
    onError: () => {
      setConfirm(null)
      setFailed(true)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => deleteResultDraft(clubId as string, matchId as string),
    onSuccess: () => {
      setConfirm(null)
      // The scorecard of a deleted draft is gone: leave no cached 404 behind for the wizard that is opened next.
      queryClient.removeQueries({ queryKey: resultKeys.scorecard(clubId as string, matchId as string) })
      navigate(RESULTS_PATH)
      refresh()
    },
    onError: () => {
      setConfirm(null)
      setFailed(true)
    },
  })

  if (!clubId || !matchId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }
  if (matchQuery.isLoading || resultQuery.isLoading) return null

  if (matchQuery.isError || resultQuery.isError || !matchQuery.data) {
    const notFound = isNotFound(matchQuery.error)
    return (
      <EmptyState
        title={notFound ? 'Match not found' : "Couldn't load this result"}
        description={notFound ? 'This match does not exist or is no longer available.' : 'Something went wrong loading this result. Please try again.'}
        action={
          <MuiButton component={RouterLink} to={RESULTS_PATH} variant="outlined">
            Back to Results
          </MuiButton>
        }
      />
    )
  }

  const match = matchQuery.data
  const result = resultQuery.data
  if (!result) {
    // Nothing captured yet: send the manager to the wizard (an inactive match cannot take a result).
    if (match.active === false) {
      return (
        <EmptyState
          title="No result for this match"
          description="This match is inactive, so a result can't be captured."
          action={
            <MuiButton component={RouterLink} to={RESULTS_PATH} variant="outlined">
              Back to Results
            </MuiButton>
          }
        />
      )
    }
    return <Navigate to={resultCaptureTo(match.id)} replace />
  }

  const [home, away] = resultSides(match, teamsById)
  const names = { home: home.name, away: away.name }
  const draft = result.status === 'DRAFT'
  const perspective = resultPerspective(result, ownSidesOf(match, teamsById))
  const title = `${names.home} vs ${names.away}`
  const line = result.outcomeType ? resultLine(result, names) : 'Result not entered yet'
  const toss = tossLine(result, names)
  const field = result.playingAreaName ?? match.playingAreaName ?? match.venue
  const leagueName = match.leagueId ? (leaguesQuery.data?.find((league) => league.id === match.leagueId)?.name ?? null) : null
  const statusLabel = draft ? 'Draft' : 'Published'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <MuiButton
              component={RouterLink}
              to={RESULTS_PATH}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ ml: -1, color: 'text.secondary' }}
            >
              Back to Results
            </MuiButton>
            <MuiButton component={RouterLink} to={`${MATCHES_PATH}/${match.id}`} variant="text" size="small">
              View match
            </MuiButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            {[home, away].map((side) => (
              <TeamLogo key={side.side} logo={side.logo} testId={`result-logo-${side.side.toLowerCase()}`} />
            ))}
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h4"
                component="h1"
                aria-label={title}
                sx={{ fontWeight: 700, lineHeight: 1.2, fontSize: { xs: '1.4rem', md: '1.75rem' }, overflowWrap: 'anywhere' }}
              >
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {[formatMatchDateTime(match.matchDate), leagueName, field].filter(Boolean).join(' · ')}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="h6"
              component="p"
              data-testid="result-line"
              data-perspective={perspective}
              sx={{ fontWeight: 700, color: PERSPECTIVE_COLOR[perspective], mr: 0.5 }}
            >
              {line}
            </Typography>
            <Chip
              size="small"
              label={statusLabel}
              sx={badgeSx(draft ? 'warning' : 'active')}
              data-testid="result-status-chip"
            />
            <ImportedChip source={result.source} />
          </Box>

          {failed && (
            <Typography color="error" variant="body2" role="alert">
              That didn&apos;t work. Please try again.
            </Typography>
          )}

          <Box
            data-testid="result-actions"
            sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, auto)' }, justifyContent: { sm: 'start' }, alignItems: 'start' }}
          >
            {draft ? (
              <>
                <MuiButton component={RouterLink} to={resultEditTo(match.id)} variant="contained" startIcon={<EditOutlinedIcon fontSize="small" />}>
                  Edit
                </MuiButton>
                <MuiButton
                  variant="outlined"
                  startIcon={<CloudUploadOutlinedIcon fontSize="small" />}
                  onClick={() => {
                    setFailed(false)
                    publish(match.id)
                  }}
                >
                  Publish
                </MuiButton>
                <MuiButton
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteOutlineIcon fontSize="small" />}
                  onClick={() => setConfirm('delete')}
                >
                  Delete draft
                </MuiButton>
              </>
            ) : (
              <>
                <MuiButton
                  variant="contained"
                  disabled
                  aria-describedby="unpublish-to-edit-reason"
                  startIcon={<EditOutlinedIcon fontSize="small" />}
                >
                  Edit
                </MuiButton>
                <MuiButton
                  variant="outlined"
                  startIcon={<UnpublishedOutlinedIcon fontSize="small" />}
                  onClick={() => {
                    setFailed(false)
                    setConfirm('unpublish')
                  }}
                >
                  Unpublish
                </MuiButton>
                {/* One line under both buttons, so neither button is stretched to hold it. */}
                <Typography id="unpublish-to-edit-reason" variant="caption" color="text.secondary" sx={{ gridColumn: '1 / -1' }}>
                  {UNPUBLISH_TO_EDIT_REASON}
                </Typography>
              </>
            )}
          </Box>
        </Stack>
      </PageHeaderBand>

      <KeyFigures result={result} names={names} toss={toss} />

      <ResultSection title="Innings">
        <InningsTable result={result} names={names} />
      </ResultSection>

      {result.hasScorecard && (
        <ResultScorecard clubId={clubId} match={match} result={result} names={names} ours={ownSidesOf(match, teamsById)} toss={toss} />
      )}

      <ResultSection title="Details">
        <Details result={result} toss={toss} field={field} />
      </ResultSection>

      <ConfirmDialog
        open={confirm === 'unpublish'}
        title="Unpublish this result?"
        description="It goes back to a draft that only managers can see, and the match is no longer shown as completed. You can edit and publish it again."
        confirmLabel="Unpublish"
        pendingLabel="Unpublishing…"
        pending={unpublishMutation.isPending}
        onConfirm={() => unpublishMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Delete this draft?"
        description="The draft result and its scores are removed. The match stays and you can capture a new result."
        confirmLabel="Delete draft"
        pendingLabel="Deleting…"
        destructive
        pending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => setConfirm(null)}
      />
      {publishDialogs}
    </Box>
  )
}

interface Names {
  home: string
  away: string
}

function KeyFigures({ result, names, toss }: { result: MatchResult; names: Names; toss: string | null }) {
  const scoreFor = (side: 'HOME' | 'AWAY') => (
    <ResultScoreLine innings={inningsFor(result.innings, side)} ballsPerOver={result.ballsPerOver} />
  )
  const margin =
    result.marginValue === null || !result.marginType
      ? '–'
      : `${result.marginValue} ${result.marginType === 'RUNS' ? 'runs' : 'wickets'}`
  const oversText = result.scheduledBalls ? ballsToOvers(result.scheduledBalls, result.ballsPerOver) : '–'
  return (
    <Box
      data-testid="result-key-figures"
      sx={{ display: 'grid', gap: { xs: 1, md: 1.5 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}
    >
      <KeyFigureTile
        testId="result-figure-home"
        icon={<ScoreboardOutlinedIcon />}
        value={scoreFor('HOME')}
        label={names.home}
        textValue
      />
      <KeyFigureTile
        testId="result-figure-away"
        icon={<ScoreboardOutlinedIcon />}
        value={scoreFor('AWAY')}
        label={names.away}
        textValue
      />
      <KeyFigureTile testId="result-figure-margin" icon={<EmojiEventsOutlinedIcon />} value={margin} label="Margin" textValue />
      <KeyFigureTile
        testId="result-figure-toss"
        icon={<SportsCricketOutlinedIcon />}
        value={toss ?? '–'}
        label={`Toss · ${oversText === '–' ? 'overs not set' : `${oversText} overs`}`}
        textValue
      />
    </Box>
  )
}

const TABLE_COLUMNS = { xs: 'minmax(0, 1fr) 64px 40px 64px', sm: 'minmax(0, 1.6fr) 90px 90px 90px 90px' }

function inningsLabel(innings: Innings, regularIndex: number, superIndex: number): string {
  return innings.kind === 'SUPER_OVER' ? `Super over ${superIndex}` : `Innings ${regularIndex}`
}

function InningsTable({ result, names }: { result: MatchResult; names: Names }) {
  const ordered = [...result.innings].sort((a, b) => {
    const kindOrder = (a.kind === 'SUPER_OVER' ? 1 : 0) - (b.kind === 'SUPER_OVER' ? 1 : 0)
    return kindOrder || (a.sequence ?? 0) - (b.sequence ?? 0)
  })
  if (ordered.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No scores entered.
      </Typography>
    )
  }
  let regular = 0
  let superOvers = 0
  const rowSx = {
    display: 'grid',
    gridTemplateColumns: TABLE_COLUMNS,
    columnGap: 1,
    alignItems: 'center',
    px: 1.5,
    minHeight: 44,
    fontVariantNumeric: 'tabular-nums',
  } as const
  const extrasSx = { display: { xs: 'none', sm: 'block' } } as const
  return (
    <Box role="table" aria-label="Innings" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'clip' }}>
      <Box
        role="row"
        sx={{ ...rowSx, minHeight: 36, bgcolor: 'action.hover', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}
      >
        <Box role="columnheader">Innings</Box>
        <Box role="columnheader">Runs</Box>
        <Box role="columnheader">Wkts</Box>
        <Box role="columnheader">Overs</Box>
        <Box role="columnheader" sx={extrasSx}>Extras</Box>
      </Box>
      {ordered.map((innings, index) => {
        if (innings.kind === 'SUPER_OVER') superOvers += 1
        else regular += 1
        const batting = innings.battingSide === 'HOME' ? names.home : innings.battingSide === 'AWAY' ? names.away : '–'
        const dash = (value: number | null | undefined) => (value === null || value === undefined ? '–' : value)
        return (
          <Box
            key={`${innings.sequence ?? index}-${innings.kind ?? 'REGULAR'}`}
            role="row"
            data-testid="innings-row"
            sx={{
              ...rowSx,
              ...(innings.kind === 'SUPER_OVER' ? { bgcolor: 'action.selected' } : index % 2 === 0 ? { bgcolor: 'action.hover' } : {}),
            }}
          >
            <Box role="cell" sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>
                {batting}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {inningsLabel(innings, regular, superOvers)}
              </Typography>
            </Box>
            <Box role="cell">{dash(innings.runs)}</Box>
            <Box role="cell">{dash(innings.wickets)}</Box>
            <Box role="cell">{ballsToOvers(innings.balls, result.ballsPerOver) || '–'}</Box>
            <Box role="cell" sx={extrasSx}>{dash(innings.extras)}</Box>
          </Box>
        )
      })}
    </Box>
  )
}

function DetailRow({ label, value, icon }: { label: string; value: ReactNode; icon?: ReactNode }) {
  const empty = value === NOT_RECORDED
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 'none' }}>
        {icon}
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', overflowWrap: 'anywhere', color: empty ? 'text.secondary' : 'text.primary' }}>
        {value}
      </Typography>
    </Box>
  )
}

function Details({ result, toss, field }: { result: MatchResult; toss: string | null; field: string | null | undefined }) {
  const dls = result.decidedBy === 'DLS'
  return (
    <Box data-testid="result-details" sx={{ display: 'grid', columnGap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
      <DetailRow label="Outcome" value={result.outcomeType ? OUTCOME_LABEL[result.outcomeType] : NOT_RECORDED} icon={<EmojiEventsOutlinedIcon fontSize="small" />} />
      <DetailRow label="Decided by" value={DECIDED_BY_LABEL[result.decidedBy] ?? result.decidedBy} />
      {dls && <DetailRow label="DLS target" value={result.dlsTarget ?? NOT_RECORDED} />}
      {dls && (
        <DetailRow
          label="DLS revised overs"
          value={result.dlsRevisedBalls ? ballsToOvers(result.dlsRevisedBalls, result.ballsPerOver) : NOT_RECORDED}
        />
      )}
      <DetailRow label="Toss" value={toss ?? NOT_RECORDED} icon={<SportsCricketOutlinedIcon fontSize="small" />} />
      <DetailRow label="Field" value={field ?? NOT_RECORDED} icon={<PlaceOutlinedIcon fontSize="small" />} />
      <DetailRow
        label="Scheduled overs"
        value={result.scheduledBalls ? ballsToOvers(result.scheduledBalls, result.ballsPerOver) : NOT_RECORDED}
        icon={<EventOutlinedIcon fontSize="small" />}
      />
      <DetailRow label="Note" value={result.note?.trim() ? result.note : NOT_RECORDED} />
    </Box>
  )
}
