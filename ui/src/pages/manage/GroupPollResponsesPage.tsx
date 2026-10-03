import { useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Chip, IconButton, Stack, Typography } from '@mui/material'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
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
import { EditCloseTimeDialog } from './availability/EditCloseTimeDialog'
import { SHARE_CLOSED_REASON, closesRowText } from './availability/pollHelpers'
import type { OverrideProps, ResponseRow } from './availability/responses/responseHelpers'
import { ResponsesPageShell } from './availability/responses/ResponsesPageShell'

// docs/specs/065-group-poll-responses-view.md: one group poll's responses on their own page (the
// poll card's Responses button lands here), in three views behind a switch. The round's own
// details (close time, share dialog) come from listRounds + find-by-id since there is no
// single-round GET, the same shape ClubContactDetailPage uses.
export default function GroupPollResponsesPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { roundId } = useParams<{ roundId?: string }>()
  const queryClient = useQueryClient()
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
    },
    onSettled: () => setPendingKey(null),
  })

  const responses = responsesQuery.data

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
      headerAction={
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
      }
      meta={
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label={responses.open ? 'Open' : 'Closed'}
            variant="filled"
            sx={badgeSx(responses.open ? 'positive' : 'muted')}
          />
          <Typography variant="body2" color="text.secondary">
            {responses.sectionName} · {closesRowText(responses.open, round.autoClose, round.scheduledCloseAt)}
          </Typography>
          <IconButton size="small" aria-label="Edit close time" title="Edit close time" onClick={() => setCloseTimeOpen(true)}>
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Stack>
      }
      open={responses.open}
      responses={{ brackets: responses.brackets, rows: responses.responses }}
      matches={matchesQuery.data ?? []}
      override={override}
      overrideError={
        overrideMutation.isError ? errorDetail(overrideMutation.error, "Something went wrong saving that answer. Please try again.") : null
      }
      emptyText="No eligible players for this section yet."
    >
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
