import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Chip, Stack, Typography } from '@mui/material'
import { ManageMenu } from '../../components/ManageMenu'
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
import { usePollActions } from './availability/usePollActions'
import { currentOrigin, withReturnTo } from '../../utils/returnTo'
import {
  closesRowText,
  formatMatchDateTime,
  squadPollHref,
  squadPollSideLabel,
  squadPollTeamName,
  squadPollTitle,
} from './availability/pollHelpers'
import type { OverrideProps, ResponseRow } from './availability/responses/responseHelpers'
import { ResponsesPageShell } from './availability/responses/ResponsesPageShell'
import { toSquadResponsesModel } from './availability/responses/squadResponsesAdapter'
import { invalidateAvailabilityCounters } from '../../api/availabilitySummaryApi'

const BACK_TO = '/manage/availability'
const BACK_LABEL = 'Back to Availability'

// docs/specs/067-squad-poll-responses-page.md: a squad poll's responses on the same page and views
// a group poll uses (as a poll with one time slot). The poll's own details come from listPolls +
// find-by-id (no single-poll GET), the match from getMatch, the team names from the club's teams.
export default function SquadPollResponsesPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { matchId, pollId } = useParams<{ matchId?: string; pollId?: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
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
  const match = matchQuery.data
  const teams = teamsQuery.data
  const teamsById = useMemo(() => new Map<string, Team>((teams ?? []).map((team) => [team.id, team])), [teams])
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: matchKey })
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'availability-polls'] })
    queryClient.invalidateQueries({ queryKey: ['managed-club', clubId, 'matches'] })
    invalidateAvailabilityCounters(queryClient, clubId)
  }
  // docs/specs/136: every action of this poll (Edit Close Time or Reopen Poll, Close Poll, Open Match, Delete Poll, Share Invite last)
  // is ONE Manage Poll menu, built by the hook the list's row kebab uses. Delete leaves for the list first, so this page never
  // refetches the deleted poll. The hook is called before the loading returns below.
  const sidesForShare = { teamId: poll?.teamId ?? '', homeTeamId: match?.homeTeamId, homeTeamName: match?.homeTeamName, awayTeamId: match?.awayTeamId, awayTeamName: match?.awayTeamName }
  const actions = usePollActions({
    clubId: clubId as string,
    target: { kind: 'SQUAD', matchId: matchId as string, pollId: pollId as string },
    title: poll && match ? squadPollTitle(match, teamsById) : '',
    open: responses?.open ?? true,
    autoClose: poll?.autoClose ?? true,
    scheduledCloseAt: poll?.scheduledCloseAt ?? null,
    kickoff: match?.matchDate ?? '',
    canReopen: poll?.canReopen ?? false,
    onChanged: refresh,
    onDeleted: () => {
      navigate(BACK_TO)
      refresh()
    },
    placement: 'page',
    openMatchTo: match ? withReturnTo(squadPollHref({ matchId: match.id }), currentOrigin(location), 'Poll Responses') : undefined,
    renderShare: (open, onClose) =>
      match && poll ? (
        <PollShareDialog
          open={open}
          onClose={onClose}
          match={match}
          teamName={squadPollTeamName(sidesForShare, teamsById)}
          pollId={poll.id}
          autoClose={poll.autoClose}
          scheduledCloseAt={poll.scheduledCloseAt}
        />
      ) : null,
  })
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
        <ManageScreenHeader title="Squad Poll" backTo={BACK_TO} backLabel={BACK_LABEL} />
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
      titleAdornment={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label="Squad Poll" variant="filled" sx={badgeSx('squadPoll')} />
          <Chip size="small" label={responses.open ? 'Open' : 'Closed'} variant="filled" sx={badgeSx(responses.open ? 'open' : 'closed')} />
          <Chip size="small" label={squadPollSideLabel(sides)} variant="filled" sx={badgeSx('side')} />
        </Box>
      }
      headerAction={<ManageMenu label="Manage Poll" fixedWidth testId="manage-poll" groups={[{ id: 'poll', heading: 'Poll', items: actions.items }]} />}
      meta={
        <Stack spacing={0.5}>
          <Typography variant="subtitle1" fontWeight={600} color="text.primary">
            {formatMatchDateTime(match.matchDate)} · {match.venue ?? 'Venue TBC'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {closesRowText(responses.open, poll.autoClose, poll.scheduledCloseAt)}
          </Typography>
        </Stack>
      }
      open={responses.open}
      responses={{ brackets: model.brackets, rows: model.rows }}
      matches={model.matches}
      override={override}
      overrideError={
        actions.errorMessage ??
        (overrideMutation.isError ? errorDetail(overrideMutation.error, 'Something went wrong saving that answer. Please try again.') : null)
      }
      emptyText="No players in this squad yet."
    >
      {actions.dialogs}
    </ResponsesPageShell>
  )
}
