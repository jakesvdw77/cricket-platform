import { useMemo, useState } from 'react'
import { useOutletContext, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Chip, InputAdornment, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { Input } from '../../components/Input'
import { ManageScreenHeader } from '../../components/ManageScreenHeader'
import { badgeSx } from '../../components/RecordCard'
import { SectionAvailabilityShareDialog } from '../../components/SectionAvailabilityShareDialog'
import { getRoundMatches, getRoundResponses, listRounds, setRoundPlayerStatus } from '../../api/sectionAvailabilityApi'
import type { SectionAvailabilityRoundResponses } from '../../api/sectionAvailabilityApi'
import type { AvailabilityStatus } from '../../api/matchAvailabilityApi'
import { errorDetail } from '../../utils/errorDetail'
import { closesValue } from './availability/pollHelpers'
import { filterPlayers, groupBySlot } from './availability/responses/responseHelpers'
import type { OverrideProps, ResponseRow } from './availability/responses/responseHelpers'
import { ResponsesByTimeSlot } from './availability/responses/ResponsesByTimeSlot'
import { ResponsesByPlayer } from './availability/responses/ResponsesByPlayer'
import { ResponsesSummary } from './availability/responses/ResponsesSummary'

type View = 'slot' | 'player' | 'summary'

// docs/specs/065-group-poll-responses-view.md: one group poll's responses on their own page (the
// poll card's Responses button lands here), in three views behind a switch. The round's own
// details (close time, share dialog) come from listRounds + find-by-id since there is no
// single-round GET, the same shape ClubContactDetailPage uses.
export default function GroupPollResponsesPage() {
  const { clubId } = useOutletContext<{ clubId?: string }>()
  const { roundId } = useParams<{ roundId?: string }>()
  const queryClient = useQueryClient()
  // Neither the view nor the search is persisted: a fresh visit starts on By time slot.
  const [view, setView] = useState<View>('slot')
  const [search, setSearch] = useState('')
  const [shareOpen, setShareOpen] = useState(false)
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
  const filteredRows = useMemo(() => filterPlayers(responses?.responses ?? [], search), [responses, search])
  const slots = useMemo(
    () => (responses ? groupBySlot({ brackets: responses.brackets, responses: filteredRows }, matchesQuery.data ?? []) : []),
    [responses, filteredRows, matchesQuery.data],
  )
  // Summary always shows the full totals, whatever the search says.
  const summarySlots = useMemo(
    () => (responses ? groupBySlot(responses, matchesQuery.data ?? []) : []),
    [responses, matchesQuery.data],
  )

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

  const closes = closesValue(round.autoClose, round.scheduledCloseAt)
  const closed = !responses.open
  const override: OverrideProps = {
    disabled: closed,
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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ManageScreenHeader
        title={responses.description}
        backTo="/manage/availability"
        backLabel="Back to Availability Polls"
        action={
          <Button variant="secondary" size="sm" startIcon={<ShareOutlinedIcon fontSize="small" />} onClick={() => setShareOpen(true)}>
            Share invite
          </Button>
        }
      />

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Chip
          size="small"
          label={responses.open ? 'Open' : 'Closed'}
          variant="filled"
          sx={badgeSx(responses.open ? 'positive' : 'muted')}
        />
        <Typography variant="body2" color="text.secondary">
          {responses.sectionName} · {closes === 'Manually' ? 'Closes manually' : `Closes ${closes}`}
        </Typography>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <ToggleButtonGroup
          value={view}
          exclusive
          size="small"
          aria-label="Responses view"
          onChange={(_event, next: View | null) => next && setView(next)}
        >
          <ToggleButton value="slot">Time slot</ToggleButton>
          <ToggleButton value="player">Player</ToggleButton>
          <ToggleButton value="summary">Summary</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1, maxWidth: { sm: 360 } }}>
          <Input
            label="Search players"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </Stack>

      {closed && (
        <Typography variant="body2" color="text.secondary">
          This poll is closed, so answers can't be changed.
        </Typography>
      )}
      {overrideMutation.isError && (
        <Typography variant="body2" color="error.main" role="alert">
          {errorDetail(overrideMutation.error, "Something went wrong saving that answer. Please try again.")}
        </Typography>
      )}

      {responses.responses.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No eligible players for this section yet.
        </Typography>
      )}

      {view === 'slot' && (
        <ResponsesByTimeSlot
          slots={slots}
          override={override}
        />
      )}
      {view === 'player' && responses.responses.length > 0 && (
        <ResponsesByPlayer
          rows={filteredRows}
          brackets={slots.map((slot) => slot.bracket)}
          override={override}
        />
      )}
      {view === 'summary' && <ResponsesSummary slots={summarySlots} />}

      <SectionAvailabilityShareDialog open={shareOpen} onClose={() => setShareOpen(false)} round={round} />
    </Box>
  )
}
