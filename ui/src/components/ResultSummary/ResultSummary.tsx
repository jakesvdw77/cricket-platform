import { Box, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import type { Innings } from '../../api/matchResultApi'
import { ResultScoreLine } from '../ResultScoreLine'

export interface ResultSummarySide {
  key: string
  name: string
  // Optional team logo, drawn before the name.
  logo?: ReactNode
  innings: Innings[]
  // The winning side's name and score read bold.
  winner?: boolean
}

export interface ResultSummaryProps {
  sides: ResultSummarySide[]
  ballsPerOver?: number
  // The one-line result ("1st XI won by 5 wickets").
  resultLine: string
  // Any theme colour path for the result line; defaults to primary.dark.
  resultColor?: string
  // Written to data-perspective on the result line, for tests and styling hooks.
  perspective?: string
  // Detail rows (toss, date, field) drawn under the result line.
  children?: ReactNode
}

// docs/specs/100-match-results-core.md: the body shared by the Results card and the wizard's Review step - both sides
// with a score line each, then the result line, then any detail rows. The caller owns the frame (card, bordered panel).
export function ResultSummary({ sides, ballsPerOver, resultLine, resultColor = 'primary.dark', perspective, children }: ResultSummaryProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} data-testid="result-sides">
        {sides.map((side) => (
          <Box key={side.key} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            {side.logo}
            <Typography variant="body2" fontWeight={side.winner ? 700 : 500} noWrap sx={{ flex: 1, minWidth: 0 }}>
              {side.name}
            </Typography>
            <ResultScoreLine innings={side.innings} ballsPerOver={ballsPerOver} winner={side.winner} />
          </Box>
        ))}
      </Box>
      <Typography variant="body2" fontWeight={700} data-testid="result-line" data-perspective={perspective} sx={{ color: resultColor }}>
        {resultLine}
      </Typography>
      {children}
    </Box>
  )
}
