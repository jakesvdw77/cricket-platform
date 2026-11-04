import { useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Chip, Typography } from '@mui/material'
import { ManageMenu } from '../../components/ManageMenu'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { badgeSx } from '../../components/RecordCard'
import { SectionAvailabilityShareDialog } from '../../components/SectionAvailabilityShareDialog'
import { getRoundMatches, getRoundResponses, listRounds, setRoundPlayerStatus } from '../../api/sectionAvailabilityApi'
import type { SectionAvailabilityRoundResponses } from '../../api/sectionAvailabilityApi'
import type { AvailabilityStatus } from '../../api/matchAvailabilityApi'
import { errorDetail } from '../../utils/errorDetail'
import { PollMatchesDialog } from './availability/PollMatchesDialog'
import { closesRowText } from './availability/pollHelpers'
import { usePollActions } from './availability/usePollActions'
import type { OverrideProps, ResponseRow } from './availability/responses/responseHelpers'
import { ResponsesPageShell } from './availability/responses/ResponsesPageShell'
import { invalidateAvailabilityCounters } from '../../api/availabilitySummaryApi'

// docs/specs/065-group-poll-responses-view.md: one group poll's responses on their own page (the
// poll card's Responses button lands here), in three views behind a switch. The round's own
// details (close time, share dialog) come from listRounds + find-by-id since there is no
// single-round GET, the same shape ClubContactDetailPage uses.
export default function GroupPollResponsesPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { roundId } = useParams<{ roundId?: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const roundsKey = ['managed-club', clubId, 'section-availability-rounds']
  const responsesKey = [...roundsKey, roundId, 'responses']

  const roundQuery = useQuery({
    // An unfiltered list-and-find cache (no single-round GET), kept apart from the dashboard's filtered lists.
    queryKey: [...roundsKey, 'detail'],
    queryFn: () => listRounds(clubId as string),
    enabled: Boolean(clubId),
    select: (rounds) => rounds.find((candidate) => candidate.id === roundId),
  })
  const responsesQuery = useQuery({
    queryKey: responsesKey,
    queryFn: () => getRoundResponses(clubId as string, roundId as string),
    enabled: Boolean(clubId && roundId),
  })
  const matchesQuery = useQuery({
    queryKey: [...roundsKey, roundId, 'matches'],
    queryFn: () => getRoundMatches(clubId as string, roundId as string),
    enabled: Boolean(clubId && roundId),
  })

  const overrideMutation = useMutation({
    mutationFn: ({ row, windowId, status }: { row: ResponseRow; windowId: string; status: AvailabilityStatus }) =>
      setRoundPlayerStatus(clubId as string, roundId as string, row.playerProfileId, windowId, status),
    onSuccess: (payload: SectionAvailabilityRoundResponses) => {
      queryClient.setQueryData(responsesKey, payload)
      // So the dashboard cards' per-slot counts refresh too.
      queryClient.invalidateQueries({ queryKey: roundsKey })
      invalidateAvailabilityCounters(queryClient, clubId)
    },
    onSettled: () => setPendingKey(null),
  })

  const responses = responsesQuery.data
  // docs/specs/136: every action of this poll (Edit Description, Edit Close Time or Reopen Poll, Close Poll, Matches Covered, Delete Poll,
  // Share Invite last) is ONE Manage Poll menu, built by the same hook as the list's row kebab so the two cannot drift. Delete leaves
  // for the list first, so this page never refetches the deleted poll. The hook is called before the loading returns below.
  const round = roundQuery.data
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: roundsKey })
    invalidateAvailabilityCounters(queryClient, clubId)
  }
  const actions = usePollActions({
    clubId: clubId as string,
    target: { kind: 'GROUP', roundId: roundId as string },
    title: round?.description ?? '',
    open: responses?.open ?? true,
    autoClose: round?.autoClose ?? true,
    scheduledCloseAt: round?.scheduledCloseAt ?? null,
    kickoff: round?.firstMatchKickoff ?? '',
    canReopen: round?.canReopen ?? false,
    description: { roundId: roundId as string, text: round?.description ?? '' },
    onChanged: refresh,
    onDeleted: () => {
      navigate('/manage/availability')
      refresh()
    },
    placement: 'page',
    renderMatches: (open, onClose) =>
      round ? <PollMatchesDialog open={open} onClose={onClose} clubId={clubId as string} item={{ kind: 'GROUP', round }} teamsById={new Map()} /> : null,
    renderShare: (open, onClose) => (round ? <SectionAvailabilityShareDialog open={open} onClose={onClose} round={round} /> : null),
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (roundQuery.isLoading || responsesQuery.isLoading) {
    return null
  }

  if (roundQuery.isError || responsesQuery.isError || !round || !responses) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <ManageScreenHeader title="Group Poll" backTo="/manage/availability" backLabel="Back to Availability" />
        <EmptyState title="Couldn't load this poll" description="It may have been deleted, or something went wrong. Please try again." />
      </Box>
    )
  }

  const override: OverrideProps = {
    pendingKey,
    onOverride: async (row, windowId, status) => {
      setPendingKey(`${row.playerProfileId}:${windowId}`)
      try {
        await overrideMutation.mutateAsync({ row, windowId, status })
        return true
      } catch {
        // Surfaced through overrideMutation.isError below.
        return false
      }
    },
  }

  return (
    <ResponsesPageShell
      title={responses.description}
      backTo="/manage/availability"
      backLabel="Back to Availability"
      // Badges inline beside the title (page-anatomy section 1).
      titleAdornment={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label="Group Poll" variant="filled" sx={badgeSx('groupPoll')} />
          <Chip size="small" label={responses.open ? 'Open' : 'Closed'} variant="filled" sx={badgeSx(responses.open ? 'open' : 'closed')} />
        </Box>
      }
      headerAction={<ManageMenu label="Manage Poll" fixedWidth testId="manage-poll" groups={[{ id: 'poll', heading: 'Poll', items: actions.items }]} />}
      meta={
        <Typography variant="subtitle1" fontWeight={600} color="text.primary">
          {responses.sectionName} · {closesRowText(responses.open, round.autoClose, round.scheduledCloseAt)}
        </Typography>
      }
      open={responses.open}
      responses={{ brackets: responses.brackets, rows: responses.responses }}
      matches={matchesQuery.data ?? []}
      override={override}
      overrideError={
        actions.errorMessage ??
        (overrideMutation.isError ? errorDetail(overrideMutation.error, 'Something went wrong saving that answer. Please try again.') : null)
      }
      emptyText="No eligible players for this section yet."
    >
      {actions.dialogs}
    </ResponsesPageShell>
  )
}
