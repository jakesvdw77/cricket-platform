import { useQuery } from '@tanstack/react-query'
import { Box, Chip, Container, Typography } from '@mui/material'
import { fetchUpcomingMatches } from '../../api/matchApi'
import { EmptyState } from '../../components/EmptyState'

export default function UpcomingMatches() {
  const { data, isLoading } = useQuery({
    queryKey: ['matches', 'upcoming'],
    queryFn: fetchUpcomingMatches,
  })

  return (
    <Container maxWidth="sm" sx={{ py: 5 }}>
      <Chip label="Upcoming" color="primary" variant="outlined" size="small" />
      <Typography variant="h5" component="h1" sx={{ mt: 1.5, fontWeight: 600 }}>
        Upcoming Matches
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        First feature spec: docs/specs/003-club-onboarding.md's rollout step — the
        deliberately small slice used to prove the spec-to-code pipeline.
      </Typography>

      {isLoading && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
          Loading…
        </Typography>
      )}
      {!isLoading && (data?.length ?? 0) === 0 && (
        <Box sx={{ mt: 3 }}>
          <EmptyState title="No matches scheduled yet" />
        </Box>
      )}
    </Container>
  )
}
