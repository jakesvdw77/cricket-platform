import { Alert, Box, Chip, Container, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useParams } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { getRound, setAvailability } from '../../api/publicSectionAvailabilityApi'
import type { AvailabilityStatus } from '../../api/matchAvailabilityApi'
import type { SectionAvailabilityRoundResponseRow, SectionAvailabilityRoundStatus } from '../../api/sectionAvailabilityApi'
import { formatBracketLabel } from '../../utils/dayPart'

const STATUS_OPTIONS: { value: AvailabilityStatus; label: string }[] = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'UNAVAILABLE', label: 'Unavailable' },
  { value: 'UNSURE', label: 'Unsure' },
]

function playerDisplayName(row: SectionAvailabilityRoundResponseRow): string {
  const name = `${row.firstName} ${row.lastName}`
  return row.jerseyNumber != null ? `#${row.jerseyNumber} ${name}` : name
}

function bracketLabel(status: SectionAvailabilityRoundStatus): string {
  return formatBracketLabel(status.windowDate, status.dayPart)
}

// docs/specs/063-section-availability-and-flexible-squads.md's public, no-login, self-select
// response page for a SectionAvailabilityRound - mirrors PublicAvailabilityPoll.tsx's exact
// no-shell shape (a new top-level route, reachable pre-login), one shared link per admin-selected
// set of fixtures. Anyone holding the link sees every eligible player's name and, for each bracket
// the round owns, one small toggle group - however many that is, since a bracket only exists at
// all if a real, admin-selected match put it there (no more hiding a zero-match bracket) - and
// sets their own status by tapping their own row, the same deliberate, documented trust tradeoff
// 032 already established.
export default function PublicSectionAvailabilityRound() {
  const { roundId } = useParams<{ roundId: string }>()
  const queryClient = useQueryClient()

  const roundQuery = useQuery({
    queryKey: ['public-section-availability-round', roundId],
    queryFn: () => getRound(roundId as string),
    enabled: Boolean(roundId),
    retry: false,
  })

  const setAvailabilityMutation = useMutation({
    mutationFn: ({ playerProfileId, windowId, status }: { playerProfileId: string; windowId: string; status: AvailabilityStatus }) =>
      setAvailability(roundId as string, playerProfileId, windowId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-section-availability-round', roundId] })
    },
  })

  const notFound = isAxiosError(roundQuery.error) && roundQuery.error.response?.status === 404

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      {roundQuery.isLoading && (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      )}

      {!roundQuery.isLoading && notFound && (
        <EmptyState
          title="Round not found"
          description="This section availability link isn't valid, or the round no longer exists."
        />
      )}

      {!roundQuery.isLoading && !notFound && roundQuery.isError && (
        <EmptyState
          title="Couldn't load this round"
          description="Something went wrong loading this round. Please try again."
        />
      )}

      {roundQuery.data && (
        <>
          <Chip
            label={roundQuery.data.open ? 'Open' : 'Closed'}
            color={roundQuery.data.open ? 'primary' : 'default'}
            variant="outlined"
            size="small"
          />
          <Typography variant="h5" component="h1" sx={{ mt: 1.5, fontWeight: 600 }}>
            {roundQuery.data.description}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {roundQuery.data.sectionName}
          </Typography>

          {!roundQuery.data.open && (
            <Alert severity="warning" sx={{ mt: 3 }}>
              This round is closed - responses are read-only.
            </Alert>
          )}

          <Stack spacing={1.5} sx={{ mt: 3 }}>
            {roundQuery.data.responses.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No eligible players to ask yet.
              </Typography>
            )}

            {roundQuery.data.responses.map((row) => (
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
                  {playerDisplayName(row)}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap', gap: 1.5 }}>
                  {row.statuses.map((status) => (
                    <Box key={status.windowId} sx={{ flex: '1 1 auto', minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {bracketLabel(status)}
                      </Typography>
                      <ToggleButtonGroup
                        value={status.status}
                        exclusive
                        fullWidth
                        size="small"
                        disabled={!roundQuery.data.open}
                        onChange={(_event, next: AvailabilityStatus | null) => {
                          if (next) {
                            setAvailabilityMutation.mutate({
                              playerProfileId: row.playerProfileId,
                              windowId: status.windowId,
                              status: next,
                            })
                          }
                        }}
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <ToggleButton
                            key={option.value}
                            value={option.value}
                            aria-label={`${playerDisplayName(row)} ${bracketLabel(status)}: ${option.label}`}
                          >
                            {option.label}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                    </Box>
                  ))}
                </Box>
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
