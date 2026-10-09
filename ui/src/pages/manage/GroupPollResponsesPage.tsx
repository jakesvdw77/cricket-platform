import { useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button as MuiButton, Chip, IconButton, Stack, Typography } from '@mui/material'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { badgeSx } from '../../components/RecordCard'
import { SectionAvailabilityShareDialog } from '../../components/SectionAvailabilityShareDialog'
import { getRoundMatches, getRoundResponses, listRounds, setRoundPlayerStatus } from '../../api/sectionAvailabilityApi'
import type { SectionAvailabilityRoundResponses } from '../../api/sectionAvailabilityApi'
import type { AvailabilityStatus } from '../../api/matchAvailabilityApi'
import { errorDetail } from '../../utils/errorDetail'
import { usePollClose } from '../../hooks/usePollClose'
import { usePollDelete } from '../../hooks/usePollDelete'
import { usePollDescription } from './availability/usePollDescription'
import { EditCloseTimeDialog } from './availability/EditCloseTimeDialog'
import { REOPEN_PAST_REASON, SHARE_CLOSED_REASON, closesRowText } from './availability/pollHelpers'
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
  const [shareOpen, setShareOpen] = useState(false)
  const [closeTimeOpen, setCloseTimeOpen] = useState(false)
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
  // docs/specs/090: Delete poll and Edit description from this page (hooks are called before the loading returns below).
  // Delete leaves for the list first, so this page never refetches the deleted poll.
  const pollDelete = usePollDelete({
    clubId: clubId as string,
    target: { kind: 'GROUP', roundId: roundId as string },
    title: roundQuery.data?.description ?? '',
    onDeleted: () => {
      navigate('/manage/availability')
      queryClient.invalidateQueries({ queryKey: roundsKey })
      invalidateAvailabilityCounters(queryClient, clubId)
    },
  })
  const pollDescription = usePollDescription({
    clubId: clubId as string,
    roundId: roundId as string,
    description: roundQuery.data?.description ?? '',
    onSaved: () => queryClient.invalidateQueries({ queryKey: roundsKey }),
  })
  // docs/specs/090: Close poll from this page (the hook is called before the loading returns below).
  const pollClose = usePollClose({
    clubId: clubId as string,
    target: { kind: 'GROUP', roundId: roundId as string },
    autoClose: roundQuery.data?.autoClose ?? true,
    onClosed: () => {
      queryClient.invalidateQueries({ queryKey: roundsKey })
      invalidateAvailabilityCounters(queryClient, clubId)
    },
  })

  if (!clubId) {
    return <EmptyState title="Not authorized" description="No club is associated with your account." />
  }

  if (roundQuery.isLoading || responsesQuery.isLoading) {
    return null
  }

  const round = roundQuery.data
  if (roundQuery.isError || responsesQuery.isError || !round || !responses) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <ManageScreenHeader title="Group poll" backTo="/manage/availability" backLabel="Back to Availability Polls" />
        <EmptyState title="Couldn't load this poll" description="It may have been deleted, or something went wrong. Please try again." />
      </Box>
    )
  }

  const closed = !responses.open
  const reopenBlocked = closed && !round.canReopen
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
      backLabel="Back to Availability Polls"
      titleAdornment={
        <IconButton size="small" aria-label="Edit description" title="Edit description" onClick={pollDescription.openEditor}>
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      }
      headerAction={
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
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
          <MuiButton
            variant="outlined"
            color="error"
            size="small"
            startIcon={<DeleteOutlineIcon fontSize="small" />}
            disabled={pollDelete.deleting}
            onClick={pollDelete.requestDelete}
          >
            Delete poll
          </MuiButton>
        </Stack>
      }
      meta={
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip size="small" label="Group poll" variant="filled" sx={badgeSx('groupPoll')} />
          <Chip
            size="small"
            label={responses.open ? 'Open' : 'Closed'}
            variant="filled"
            sx={badgeSx(responses.open ? 'open' : 'closed')}
          />
          <Typography variant="body2" color="text.secondary">
            {responses.sectionName} · {closesRowText(responses.open, round.autoClose, round.scheduledCloseAt)}
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
      }
      open={responses.open}
      responses={{ brackets: responses.brackets, rows: responses.responses }}
      matches={matchesQuery.data ?? []}
      override={override}
      overrideError={
        pollClose.closeError
          ? errorDetail(pollClose.closeError, 'Something went wrong closing this poll. Please try again.')
          : pollDelete.deleteError
            ? errorDetail(pollDelete.deleteError, 'Something went wrong deleting this poll. Please try again.')
            : overrideMutation.isError
            ? errorDetail(overrideMutation.error, "Something went wrong saving that answer. Please try again.")
            : null
      }
      emptyText="No eligible players for this section yet."
    >
      {pollClose.confirmDialog}
      {pollDelete.dialogs}
      {pollDescription.dialog}

      <EditCloseTimeDialog
        open={closeTimeOpen}
        onClose={() => setCloseTimeOpen(false)}
        clubId={clubId}
        target={{ kind: 'GROUP', roundId: round.id }}
        autoClose={round.autoClose}
        scheduledCloseAt={round.scheduledCloseAt}
        kickoff={round.firstMatchKickoff}
        reopen={closed}
      />

      <SectionAvailabilityShareDialog open={shareOpen} onClose={() => setShareOpen(false)} round={round} />
    </ResponsesPageShell>
  )
}
