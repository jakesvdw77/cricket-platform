import { useMemo, useState } from 'react'
import { Link as RouterLink, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button as MuiButton, Chip, IconButton, Stack, Typography } from '@mui/material'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { PollShareDialog } from '../../components/PollShareDialog'
import { badgeSx } from '../../components/RecordCard'
import { getPollResponses, listPolls, setPlayerStatus } from '../../api/matchAvailabilityApi'
import type { AvailabilityStatus, MatchAvailabilityPollResponses } from '../../api/matchAvailabilityApi'
import { getMatch } from '../../api/matchApi'
import { listTeamsForClub } from '../../api/teamApi'
import type { Team } from '../../api/teamApi'
import { errorDetail } from '../../utils/errorDetail'
import { usePollClose } from '../../hooks/usePollClose'
import { EditCloseTimeDialog } from './availability/EditCloseTimeDialog'
import {
  closesRowText,
  formatMatchDateTime,
  squadPollHref,
  squadPollSideLabel,
  squadPollTeamName,
  squadPollTitle,
  REOPEN_PAST_REASON, SHARE_CLOSED_REASON,
} from './availability/pollHelpers'
import type { OverrideProps, ResponseRow } from './availability/responses/responseHelpers'
import { ResponsesPageShell } from './availability/responses/ResponsesPageShell'
import { toSquadResponsesModel } from './availability/responses/squadResponsesAdapter'
import { invalidateAvailabilityCounters } from '../../api/availabilitySummaryApi'

const BACK_TO = '/manage/availability'
const BACK_LABEL = 'Back to Availability Polls'

// docs/specs/067-squad-poll-responses-page.md: a squad poll's responses on the same page and views
// a group poll uses (as a poll with one time slot). The poll's own details come from listPolls +
// find-by-id (no single-poll GET), the match from getMatch, the team names from the club's teams.
export default function SquadPollResponsesPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId, pollId } = useParams<{ matchId?: string; pollId?: string }>()
  const queryClient = useQueryClient()
  const [shareOpen, setShareOpen] = useState(false)
  const [closeTimeOpen, setCloseTimeOpen] = useState(false)
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const matchKey = ['managed-club', clubId, 'matches', matchId]
  const pollsKey = [...matchKey, 'polls']
  const responsesKey = [...pollsKey, pollId, 'responses']

  const pollQuery = useQuery({
    queryKey: pollsKey,
    queryFn: () => listPolls(clubId as string, matchId as string),
    enabled: Boolean(clubId && matchId),
    select: (polls) => polls.find((candidate) => candidate.id === pollId),
  })
  const responsesQuery = useQuery({
    queryKey: responsesKey,
    queryFn: () => getPollResponses(clubId as string, matchId as string, pollId as string),
    enabled: Boolean(clubId && matchId && pollId),
  })
  const matchQuery = useQuery({
    queryKey: matchKey,
    queryFn: () => getMatch(clubId as string, matchId as string),
    enabled: Boolean(clubId && matchId),
  })
  const teamsQuery = useQuery({
    queryKey: ['managed-club', clubId, 'teams'],
    queryFn: () => listTeamsForClub(clubId as string),
    enabled: Boolean(clubId),
  })

  const overrideMutation = useMutation({
    mutationFn: ({ row, status }: { row: ResponseRow; status: AvailabilityStatus }) =>
      setPlayerStatus(clubId as string, matchId as string, pollId as string, row.playerProfileId, status),
    onSuccess: (payload: MatchAvailabilityPollResponses) => {
      queryClient.setQueryData(responsesKey, payload)
      // So the dashboard cards' counts (and the match's Availability tab) refresh too.
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'availability-polls'] })
      invalidateAvailabilityCounters(queryClient, clubId)
      queryClient.invalidateQueries({ queryKey: pollsKey })
    },
    onSettled: () => setPendingKey(null),
  })

  const responses = responsesQuery.data
  const poll = pollQuery.data
  // docs/specs/090: Close poll from this page (the hook is called before the loading returns below).
  const pollClose = usePollClose({
    clubId: clubId as string,
    target: { kind: 'SQUAD', matchId: matchId as string, pollId: pollId as string },
    autoClose: poll?.autoClose ?? true,
    onClosed: () => {
      // The match key covers this poll, its responses and the match; the dashboard cards, the counters follow.
      queryClient.invalidateQueries({ queryKey: matchKey })
      queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'availability-polls'] })
      invalidateAvailabilityCounters(queryClient, clubId)
    },
  })
  const match = matchQuery.data
  const teams = teamsQuery.data
  const teamsById = useMemo(() => new Map<string, Team>((teams ?? []).map((team) => [team.id, team])), [teams])
  const model = useMemo(
    () => (responses && poll && match ? toSquadResponsesModel({ responses, poll, match, teamsById }) : null),
    [responses, poll, match, teamsById],
  )

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  // Teams are awaited too (so a club-owned side never first-paints as 'Unknown team'); a teams error stays non-blocking.
  if (pollQuery.isLoading || responsesQuery.isLoading || matchQuery.isLoading || teamsQuery.isLoading) {
    return null
  }

  if (pollQuery.isError || responsesQuery.isError || matchQuery.isError || !poll || !responses || !match || !model) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <ManageScreenHeader title="Squad poll" backTo={BACK_TO} backLabel={BACK_LABEL} />
        <EmptyState title="Couldn't load this poll" description="It may have been deleted, or something went wrong. Please try again." />
      </Box>
    )
  }

  const sides = {
    teamId: poll.teamId,
    homeTeamId: match.homeTeamId,
    homeTeamName: match.homeTeamName,
    awayTeamId: match.awayTeamId,
    awayTeamName: match.awayTeamName,
  }
  const closed = !responses.open
  const reopenBlocked = closed && !poll.canReopen
  const override: OverrideProps = {
    pendingKey,
    onOverride: async (row, _windowId, status) => {
      setPendingKey(`${row.playerProfileId}:${poll.id}`)
      try {
        await overrideMutation.mutateAsync({ row, status })
        return true
      } catch {
        // Surfaced through overrideMutation.isError below.
        return false
      }
    },
  }

  return (
    <ResponsesPageShell
      title={squadPollTitle(sides, teamsById)}
      backTo={BACK_TO}
      backLabel={BACK_LABEL}
      headerAction={
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <MuiButton
            component={RouterLink}
            to={squadPollHref({ matchId: match.id })}
            variant="outlined"
            color="primary"
            size="small"
            startIcon={<EventNoteOutlinedIcon fontSize="small" />}
          >
            Open match
          </MuiButton>
          {closed ? (
            <span title={reopenBlocked ? REOPEN_PAST_REASON : undefined}>
              <Button
                variant="secondary"
                size="sm"
                startIcon={<LockOpenOutlinedIcon fontSize="small" />}
                disabled={reopenBlocked}
                onClick={() => setCloseTimeOpen(true)}
              >
                Reopen poll
              </Button>
            </span>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              startIcon={<LockOutlinedIcon fontSize="small" />}
              disabled={pollClose.closing}
              onClick={pollClose.requestClose}
            >
              Close poll
            </Button>
          )}
          <span title={closed ? SHARE_CLOSED_REASON : undefined}>
            <Button
                      variant="secondary"
                      size="sm"
                      startIcon={<ShareOutlinedIcon fontSize="small" />}
                      disabled={closed}
                      aria-label={closed ? SHARE_CLOSED_REASON : undefined}
                      title={closed ? SHARE_CLOSED_REASON : undefined}
                      onClick={() => setShareOpen(true)}
                    >
              Share invite
            </Button>
          </span>
        </Stack>
      }
      meta={
        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip size="small" label="Squad poll" variant="filled" sx={badgeSx('squadPoll')} />
            <Chip
              size="small"
              label={responses.open ? 'Open' : 'Closed'}
              variant="filled"
              sx={badgeSx(responses.open ? 'open' : 'closed')}
            />
            <Chip size="small" label={squadPollSideLabel(sides)} variant="filled" sx={badgeSx('side')} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {formatMatchDateTime(match.matchDate)} · {match.venue ?? 'Venue TBC'}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {closesRowText(responses.open, poll.autoClose, poll.scheduledCloseAt)}
            </Typography>
            {/* docs/specs/082: on a closed poll this pencil is the Reopen path, so it is disabled with the reason
                when the matches are in the past (the span carries the tooltip, a disabled button gets none). */}
            <span title={reopenBlocked ? REOPEN_PAST_REASON : undefined}>
              <IconButton
                size="small"
                aria-label={reopenBlocked ? REOPEN_PAST_REASON : 'Edit close time'}
                title={reopenBlocked ? REOPEN_PAST_REASON : 'Edit close time'}
                disabled={reopenBlocked}
                onClick={() => setCloseTimeOpen(true)}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Stack>
        </Stack>
      }
      open={responses.open}
      responses={{ brackets: model.brackets, rows: model.rows }}
      matches={model.matches}
      override={override}
      overrideError={
        pollClose.closeError ? errorDetail(pollClose.closeError, 'Something went wrong closing this poll. Please try again.') : overrideMutation.isError ? errorDetail(overrideMutation.error, 'Something went wrong saving that answer. Please try again.') : null
      }
      emptyText="No players in this squad yet."
    >
      {pollClose.confirmDialog}

      <EditCloseTimeDialog
        open={closeTimeOpen}
        onClose={() => setCloseTimeOpen(false)}
        clubId={clubId}
        target={{ kind: 'SQUAD', matchId: match.id, pollId: poll.id }}
        autoClose={poll.autoClose}
        scheduledCloseAt={poll.scheduledCloseAt}
        kickoff={match.matchDate}
        reopen={closed}
      />

      <PollShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        match={match}
        teamName={squadPollTeamName(sides, teamsById)}
        pollId={poll.id}
        autoClose={poll.autoClose}
        scheduledCloseAt={poll.scheduledCloseAt}
      />
    </ResponsesPageShell>
  )
}
