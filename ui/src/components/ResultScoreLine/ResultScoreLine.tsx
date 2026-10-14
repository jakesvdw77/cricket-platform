import { Typography } from '@mui/material'
import type { Innings } from '../../api/matchResultApi'
import { DEFAULT_BALLS_PER_OVER } from '../../utils/oversFormat'
import { inningsScoreText } from '../../utils/resultLine'

export interface ResultScoreLineProps {
  // The innings this side batted, in sequence order: the regular innings first, then any super overs.
  innings: Innings[]
  ballsPerOver?: number
  // The side that won reads bold.
  winner?: boolean
}

// docs/specs/100-match-results-core.md: one side's score as "212/6 (40.0)", with each super over after it as
// "SO 12/1 (1.0)". "–" (muted) while no score is entered. Figures use tabular numerals so a column of them lines up.
export function ResultScoreLine({ innings, ballsPerOver = DEFAULT_BALLS_PER_OVER, winner = false }: ResultScoreLineProps) {
  const regular = innings.filter((item) => item.kind !== 'SUPER_OVER')
  const superOvers = innings.filter((item) => item.kind === 'SUPER_OVER')
  const parts = [
    ...regular.map((item) => inningsScoreText(item, ballsPerOver)),
    ...superOvers.map((item) => `SO ${inningsScoreText(item, ballsPerOver)}`),
  ].filter((text) => text && text !== 'SO ')

  if (parts.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" component="span">
        –
      </Typography>
    )
  }

  return (
    <Typography
      variant="body2"
      component="span"
      sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: winner ? 700 : 500, whiteSpace: 'nowrap' }}
    >
      {parts.join(' · ')}
    </Typography>
  )
}
