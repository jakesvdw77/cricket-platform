import { Link as RouterLink } from 'react-router-dom'
import { Typography } from '@mui/material'
import type { SectionAvailabilityFixtureMatch } from '../../../api/sectionAvailabilityApi'
import { coveredPollHref } from './pollHelpers'

// The 'Already covered by <poll>' line under a match row in either NewPollPage branch (docs/specs/064).
export function CoveredByNote({ match }: { match: SectionAvailabilityFixtureMatch }) {
  if (!match.alreadyPolled) {
    return null
  }
  return (
    <Typography variant="caption" color="text.secondary">
      Already covered by{' '}
      <RouterLink to={coveredPollHref(match)}>{match.existingPollLabel ?? 'an existing poll'}</RouterLink>
    </Typography>
  )
}
