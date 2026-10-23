import { useMemo, useState } from 'react'
import { Link as RouterLink, Navigate, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { alpha, Box, Button as MuiButton, Chip, Stack, Tooltip, Typography } from '@mui/material'
import type { Theme } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined'
import { compactButtonSx } from '../../../components/Button'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState } from '../../../components/EmptyState'
import { PageHeaderBand } from '../../../components/PageHeaderBand'
import { ShareResultDialog } from '../../../components/ShareResultDialog'
import { badgeSx } from '../../../components/RecordCard'
import { getMatch } from '../../../api/matchApi'
import { deleteResultDraft, getMatchResult, resultKeys, resultsKey, unpublishResult } from '../../../api/matchResultApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { listLeagues } from '../../../api/leagueApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { isNotFound } from '../../../utils/errorDetail'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { resultLine, resultPerspective } from '../../../utils/resultLine'
import { TeamLogo } from '../matches/TeamLogo'
import {
  ownSidesOf,
  resultCaptureTo,
  resultEditTo,
  resultSides,
  UNPUBLISH_TO_EDIT_REASON,
} from './resultListHelpers'
import { ImportedChip } from './import/ImportedChip'
import { ResultBody } from './ResultBody'
import { usePublishResult } from './usePublishResult'
import { backTarget } from '../../../utils/backTarget'

const RESULTS_PATH = '/manage/results'
const MATCHES_PATH = '/manage/fixtures/matches'

// The result label and the status chip are the same pill: same height, type size and radius.
const pillSx = { height: 32, borderRadius: 16, px: 1.5, fontSize: '0.9375rem', display: 'inline-flex', alignItems: 'center', lineHeight: 1.2 } as const

type ResultTone = 'success' | 'error' | 'primary' | 'neutral'

// Tinted by outcome with theme tokens: won green and lost red from the club team's point of view; a decided result
// with no club side (or one that is not the club's) primary; a tie, draw or no result neutral.
function resultPillSx(tone: ResultTone) {
  if (tone === 'neutral') {
    return { bgcolor: (theme: Theme) => alpha(theme.palette.text.secondary, 0.12), color: 'text.primary' }
  }
  return { bgcolor: (theme: Theme) => alpha(theme.palette[tone].main, 0.14), color: `${tone}.dark` }
}

const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

const DEFAULT_BACK = { to: RESULTS_PATH, label: 'Results' }

// docs/specs/100-match-results-core.md, Result page: the read page of one match's result, on PageHeaderBand like the
// Match page. Draft: Edit (the wizard), Publish, Delete draft. Published: Unpublish, and Edit disabled until then.
export default function ResultDetailPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId } = useParams<{ matchId?: string }>()
  const navigate = useNavigate()
  const back = backTarget(useLocation().state, DEFAULT_BACK)
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
  const [shareOpen, setShareOpen] = useState(false)

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
          <MuiButton component={RouterLink} to={back.to} variant="outlined">
            Back to {back.label}
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
            <MuiButton component={RouterLink} to={back.to} variant="outlined">
              Back to {back.label}
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
  const field = result.playingAreaName ?? match.playingAreaName ?? match.venue
  const leagueName = match.leagueId ? (leaguesQuery.data?.find((league) => league.id === match.leagueId)?.name ?? null) : null
  const resultTone: ResultTone =
    perspective === 'won' ? 'success' : perspective === 'lost' ? 'error' : result.outcomeType === 'WON' ? 'primary' : 'neutral'
  const statusLabel = draft ? 'Draft' : 'Published'
  // docs/specs/114: Share is a filled primary button like Edit, offered on a published result only (as Publish is on a draft).
  const sharePair = draft ? null : (
    <MuiButton variant="contained" size="small" sx={compactButtonSx} startIcon={<ShareOutlinedIcon />} onClick={() => setShareOpen(true)}>
      Share
    </MuiButton>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
      <PageHeaderBand>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <MuiButton
              component={RouterLink}
              to={back.to}
              variant="text"
              color="inherit"
              size="small"
              startIcon={<ArrowBackIcon fontSize="small" />}
              sx={{ ml: -1, color: 'text.secondary' }}
            >
              Back to {back.label}
            </MuiButton>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
              <MuiButton component={RouterLink} to={`${MATCHES_PATH}/${match.id}`} variant="text" size="small">
                View match
              </MuiButton>
              <ImportedChip source={result.source} />
            </Box>
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h4"
              component="h1"
              aria-label={title}
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: 1,
                rowGap: 0.75,
                fontWeight: 700,
                lineHeight: 1.2,
                fontSize: { xs: '1.4rem', md: '1.75rem' },
              }}
            >
              {[home, away].map((side, index) => (
                <Box key={side.side} component="span" sx={{ display: 'contents' }} aria-hidden>
                  {index === 1 && <Box component="span">vs</Box>}
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <TeamLogo logo={side.logo} testId={`result-logo-${side.side.toLowerCase()}`} />
                    <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      {side.name}
                    </Box>
                  </Box>
                </Box>
              ))}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {[formatMatchDateTime(match.matchDate), leagueName, field].filter(Boolean).join(' · ')}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Box
                component="p"
                data-testid="result-line"
                data-perspective={perspective}
                sx={[pillSx, resultPillSx(resultTone), { m: 0, fontWeight: 700 }]}
              >
                {line}
              </Box>
              <Chip
                label={statusLabel}
                sx={[badgeSx(draft ? 'warning' : 'active'), pillSx]}
                data-testid="result-status-chip"
              />
            </Box>
            <Box
              data-testid="result-actions"
              sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: 1, width: { xs: '100%', sm: 'auto' }, justifyContent: { sm: 'flex-end' } }}
            >
              {draft ? (
                <>
                  <MuiButton component={RouterLink} to={resultEditTo(match.id)} variant="contained" size="small" sx={compactButtonSx} startIcon={<EditOutlinedIcon />}>
                    Edit
                  </MuiButton>
                  <MuiButton
                    variant="outlined"
                    size="small"
                    sx={compactButtonSx}
                    startIcon={<CloudUploadOutlinedIcon />}
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
                    size="small"
                    sx={compactButtonSx}
                    startIcon={<DeleteOutlineIcon />}
                    onClick={() => setConfirm('delete')}
                  >
                    Delete draft
                  </MuiButton>
                  {sharePair}
                </>
              ) : (
                <>
                  {/* A disabled button takes no hover, so the tooltip sits on a wrapper; the reason is also its description. */}
                  <Tooltip title={UNPUBLISH_TO_EDIT_REASON}>
                    <Box component="span" sx={{ display: 'flex' }}>
                      <MuiButton
                        variant="contained"
                        size="small"
                        disabled
                        aria-describedby="unpublish-to-edit-reason"
                        sx={[compactButtonSx, { flex: 1 }]}
                        startIcon={<EditOutlinedIcon />}
                      >
                        Edit
                      </MuiButton>
                    </Box>
                  </Tooltip>
                  <Box component="span" id="unpublish-to-edit-reason" sx={visuallyHidden}>
                    {UNPUBLISH_TO_EDIT_REASON}
                  </Box>
                  <MuiButton
                    variant="outlined"
                    size="small"
                    sx={compactButtonSx}
                    startIcon={<UnpublishedOutlinedIcon />}
                    onClick={() => {
                      setFailed(false)
                      setConfirm('unpublish')
                    }}
                  >
                    Unpublish
                  </MuiButton>
                  {sharePair}
                </>
              )}
            </Box>
          </Box>

          {failed && (
            <Typography color="error" variant="body2" role="alert">
              That didn&apos;t work. Please try again.
            </Typography>
          )}
        </Stack>
      </PageHeaderBand>

      <ResultBody clubId={clubId} match={match} result={result} teamsById={teamsById} />

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
      <ShareResultDialog open={shareOpen} onClose={() => setShareOpen(false)} clubId={clubId} match={match} result={result} teamsById={teamsById} />
    </Box>
  )
}
