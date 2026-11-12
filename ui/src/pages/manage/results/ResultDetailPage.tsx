import { useMemo, useState } from 'react'
import { Link as RouterLink, Navigate, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button as MuiButton, Chip, Typography } from '@mui/material'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import UnpublishedOutlinedIcon from '@mui/icons-material/UnpublishedOutlined'
import { HeaderActions, HeaderShareButton } from '../../../components/HeaderShareButton'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { EmptyState } from '../../../components/EmptyState'
import { ManageScreenHeader } from '../../../components/ManageScreenHeader'
import { ManageMenu } from '../../../components/ManageMenu'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import { ShareResultDialog } from '../../../components/ShareResultDialog'
import { badgeSx } from '../../../components/RecordCard'
import { getMatch } from '../../../api/matchApi'
import { deleteResultDraft, getMatchResult, hideResultFromPlayers, resultKeys, resultsKey, showResultToPlayers, unpublishResult } from '../../../api/matchResultApi'
import { listTeamsForClub } from '../../../api/teamApi'
import type { Team } from '../../../api/teamApi'
import { listLeagues } from '../../../api/leagueApi'
import { useDocumentTitle } from '../../../hooks/useDocumentTitle'
import { isNotFound } from '../../../utils/errorDetail'
import { formatMatchDateTime } from '../../../utils/matchDateTime'
import { TeamLogo } from '../matches/TeamLogo'
import {
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
  // docs/specs/145: show or hide a published result in the Player Hub.
  const visibilityMutation = useMutation({
    mutationFn: (show: boolean) => (show ? showResultToPlayers(clubId as string, matchId as string) : hideResultFromPlayers(clubId as string, matchId as string)),
    onSuccess: refresh,
    onError: () => setFailed(true),
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
  const title = `${names.home} vs ${names.away}`
  const field = result.playingAreaName ?? match.playingAreaName ?? match.venue
  const leagueName = match.leagueId ? (leaguesQuery.data?.find((league) => league.id === match.leagueId)?.name ?? null) : null
  const statusLabel = draft ? 'Draft' : 'Published'
  // docs/specs/138 (owner, 2026-11-05): the page header is the one every detail page has (ManageScreenHeader): Back alone, the title with the
  // logos, the result and the status beside it, the date, league and field as the sub-header, ONE filled Manage Result menu with Share last.
  const manageItems: ManageMenuItem[] = [
    {
      id: 'edit',
      title: 'Edit Result',
      icon: <EditOutlinedIcon fontSize="small" />,
      to: draft ? resultEditTo(match.id) : undefined,
      disabled: !draft,
      reason: UNPUBLISH_TO_EDIT_REASON,
    },
    draft
      ? {
          id: 'publish',
          title: 'Publish Result',
          icon: <CloudUploadOutlinedIcon fontSize="small" />,
          onClick: () => {
            setFailed(false)
            publish(match.id)
          },
        }
      : {
          id: 'unpublish',
          title: 'Unpublish Result',
          icon: <UnpublishedOutlinedIcon fontSize="small" />,
          onClick: () => {
            setFailed(false)
            setConfirm('unpublish')
          },
        },
    {
      id: 'player-hub',
      title: result.visibleToPlayers ? 'Hide From Player Hub' : 'Show In Player Hub',
      description: result.visibleToPlayers ? 'Remove this result from the Player Hub' : 'Parents and players can see this result in the Player Hub',
      icon: result.visibleToPlayers ? <VisibilityOffOutlinedIcon fontSize="small" /> : <GroupsOutlinedIcon fontSize="small" />,
      onClick: () => {
        setFailed(false)
        visibilityMutation.mutate(!result.visibleToPlayers)
      },
      disabled: draft,
      reason: 'Publish the result first',
    },
    { id: 'match', title: 'View Match', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: `${MATCHES_PATH}/${match.id}` },
    ...(draft
      ? [{ id: 'delete', title: 'Delete Draft', icon: <DeleteOutlineIcon fontSize="small" />, tone: 'error' as const, onClick: () => setConfirm('delete') }]
      : []),
    {
      id: 'share',
      title: 'Share Result',
      icon: <ShareOutlinedIcon fontSize="small" />,
      onClick: () => setShareOpen(true),
      disabled: draft,
      reason: 'Publish the result to share it',
    },
  ]

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.75, md: 2 } }}>
      <ManageScreenHeader
        title={title}
        backTo={back.to}
        backLabel={`Back to ${back.label}`}
        titleAdornment={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', gap: 0.5, flex: 'none' }}>
              <TeamLogo logo={home.logo} testId="result-logo-home" />
              <TeamLogo logo={away.logo} testId="result-logo-away" />
            </Box>
            <Chip size="small" label={statusLabel} variant="filled" sx={badgeSx(draft ? 'warning' : 'active')} data-testid="result-status-chip" />
            {result.visibleToPlayers && <Chip size="small" label="In Player Hub" variant="filled" sx={badgeSx('positive')} data-testid="result-hub-chip" />}
          </Box>
        }
        subtitle={
          <Box>
            <Typography variant="subtitle1" fontWeight={600} color="text.primary" component="span">
              {[formatMatchDateTime(match.matchDate), leagueName, field].filter(Boolean).join(' · ')}
            </Typography>
            {failed && (
              <Typography color="error" variant="body2" role="alert">
                That didn&apos;t work. Please try again.
              </Typography>
            )}
          </Box>
        }
        // The Imported badge sits above the Manage Result button, at the right.
        action={
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'flex-start', sm: 'flex-end' }, gap: 1 }}>
            <ImportedChip source={result.source} matchButton />
            {/* docs/specs/138 (owner, 2026-11-05): the one exception to a single header button: a published result shows Share beside the menu. */}
            <HeaderActions beside={!draft ? <HeaderShareButton onClick={() => setShareOpen(true)} testId="result-share" /> : null}>
              <ManageMenu label="Manage Result" fixedWidth testId="manage-result" groups={[{ id: 'result', heading: 'Result', items: manageItems }]} />
            </HeaderActions>
          </Box>
        }
      />

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
