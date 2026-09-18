import { Alert, Box, Chip, Container, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { getPoll, setAvailability } from '../../api/publicPollApi'
import type { AvailabilityStatus, PlayerAvailabilityRow } from '../../api/matchAvailabilityApi'

const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'UNAVAILABLE', label: 'Unavailable' },
  { value: 'UNSURE', label: 'Unsure' },
]

function squadDisplayName(row: PlayerAvailabilityRow): string {
  const name = `${row.firstName} ${row.lastName}`
  return row.squadJerseyNumber != null ? `#${row.squadJerseyNumber} ${name}` : name
}

// docs/specs/032-match-availability-polls.md's public, no-login, self-select response page — a
// new top-level route with zero shell (no AppShell/GridNavShell/BottomTabShell, since it must be
// reachable pre-login), matching UpcomingMatches.tsx's existing no-shell public-page precedent
// rather than the phone-frame chrome from the approved Claude Design mockup (presentational only).
// Anyone holding the link sees every squad member's name and current status, and sets their own
// status by tapping their own row — no "who are you" step, per the spec's own deliberate,
// documented trust tradeoff.
export default function PublicAvailabilityPoll() {
  const { pollId } = useParams<{ pollId: string }>()
  const queryClient = useQueryClient()

  const pollQuery = useQuery({
    queryKey: ['public-poll', pollId],
    queryFn: () => getPoll(pollId as string),
    enabled: Boolean(pollId),
    retry: false,
  })

  // A real server round-trip per row tap, not optimistic UI — matches this codebase's default
  // mutation pattern elsewhere (invalidate on success, let the refetch reflect the new state).
  const setAvailabilityMutation = useMutation({
    mutationFn: ({ playerProfileId, status }: { playerProfileId: string; status: AvailabilityStatus }) =>
      setAvailability(pollId as string, playerProfileId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-poll', pollId] })
    },
  })

  const notFound = isAxiosError(pollQuery.error) && pollQuery.error.response?.status === 404

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      {pollQuery.isLoading && (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      )}

      {!pollQuery.isLoading && notFound && (
        <EmptyState
          title="Poll not found"
          description="This availability poll link isn't valid, or the poll no longer exists."
        />
      )}

      {!pollQuery.isLoading && !notFound && pollQuery.isError && (
        <EmptyState
          title="Couldn't load this poll"
          description="Something went wrong loading this poll. Please try again."
        />
      )}

      {pollQuery.data && (
        <>
          <Chip
            label={pollQuery.data.open ? 'Open' : 'Closed'}
            color={pollQuery.data.open ? 'primary' : 'default'}
            variant="outlined"
            size="small"
          />
          <Typography variant="h5" component="h1" sx={{ mt: 1.5, fontWeight: 600 }}>
            {pollQuery.data.homeTeamName ?? 'Home'} vs {pollQuery.data.awayTeamName ?? 'Away'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {new Date(pollQuery.data.matchDate).toLocaleString()}
            {pollQuery.data.venue ? ` — ${pollQuery.data.venue}` : ''}
          </Typography>
          {(pollQuery.data.leagueName || pollQuery.data.seasonLabel) && (
            <Typography variant="body2" color="text.secondary">
              {[pollQuery.data.leagueName, pollQuery.data.seasonLabel].filter(Boolean).join(' — ')}
            </Typography>
          )}
          {pollQuery.data.teamName && (
            <Typography variant="body2" color="text.secondary">
              Availability for {pollQuery.data.teamName}
            </Typography>
          )}

          {!pollQuery.data.open && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              This poll is closed — responses are read-only.
            </Alert>
          )}

          <Stack spacing={1.5} sx={{ mt: 3 }}>
            {pollQuery.data.responses.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No squad members to poll yet.
              </Typography>
            )}

            {pollQuery.data.responses.map((row) => (
              <Box
                key={row.playerProfileId}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                  p: 1.5,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" fontWeight={600} noWrap>
                  {squadDisplayName(row)}
                </Typography>
                <ToggleButtonGroup
                  value={row.status}
                  exclusive
                  fullWidth
                  size="small"
                  disabled={!pollQuery.data.open}
                  onChange={(_event, next: AvailabilityStatus | null) => {
                    if (next) {
                      setAvailabilityMutation.mutate({ playerProfileId: row.playerProfileId, status: next })
                    }
                  }}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <ToggleButton key={option.value} value={option.value} aria-label={`${squadDisplayName(row)}: ${option.label}`}>
                      {option.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            ))}
          </Stack>

          {setAvailabilityMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Something went wrong saving your response. Please try again.
            </Alert>
          )}
        </>
      )}
    </Container>
  )
}
