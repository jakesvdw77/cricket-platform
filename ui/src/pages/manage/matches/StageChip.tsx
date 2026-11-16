import { Chip } from '@mui/material'
import type { Match } from '../../../api/matchApi'
import { stageOf } from '../../../utils/matchStages'

// docs/specs/155: a staged match (Playoff, Semi-final, Final, any text) carries its stage as a small outlined chip; a pool match shows nothing.
export function StageChip({ match }: { match: Pick<Match, 'stage'> }) {
  const stage = stageOf(match)
  if (!stage) return null
  return <Chip size="small" variant="outlined" color="primary" label={stage} data-testid="match-stage-chip" sx={{ height: 20, fontSize: '0.6875rem', fontWeight: 700, ml: 0.75 }} />
}
