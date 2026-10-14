import { Box, Typography } from '@mui/material'
import { SidePicker } from '../../../../components/SidePicker'
import type { ResultSide } from '../../../../api/matchResultApi'
import type { ResultSideInfo } from '../resultListHelpers'
import { sidePickerOptions } from '../steps/sidePickerOptions'

// docs/specs/101-match-results-our-side-scorecard.md (decision 20): the scorecard steps now come before Scores and margin,
// so with no toss recorded the innings order is not known yet. This asks who batted first (the same question the Scores
// step asks), which fixes which innings is whose.
export function BattingOrderPrompt({
  sides,
  onChoose,
  disabled,
}: {
  sides: [ResultSideInfo, ResultSideInfo]
  onChoose: (first: ResultSide) => void
  disabled?: boolean
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
        Who batted first?
      </Typography>
      <SidePicker label="Who batted first?" options={sidePickerOptions(sides)} value={null} onChange={onChoose} disabled={disabled} />
    </Box>
  )
}
