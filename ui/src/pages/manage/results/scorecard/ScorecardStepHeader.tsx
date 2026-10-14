import { Box, Typography } from '@mui/material'
import type { ResultSide } from '../../../../api/matchResultApi'
import { NameModeToggle } from '../../../../components/NameModeToggle'
import { SidePicker } from '../../../../components/SidePicker'
import type { ResultSideInfo } from '../resultListHelpers'
import { sidePickerOptions } from '../steps/sidePickerOptions'

export interface ScorecardStepHeaderProps {
  sides: [ResultSideInfo, ResultSideInfo]
  scorecardSide: ResultSide
  onSideChange: (side: ResultSide) => void
  // The sides with entries that are missing or unsaved: a small dot on their tile.
  incomplete?: Partial<Record<ResultSide, boolean>>
  // The small heading above the toggle ("Who is playing?"); omitted, the toggle is named for assistive technology only.
  label?: string
  // The accessible name of the toggle when there is no visible label.
  ariaLabel?: string
  // One line under the toggles ("From the announced team").
  note?: string
}

// docs/specs/101-match-results-our-side-scorecard.md (Side toggle, Player name display toggle): the top of every scorecard
// step. The side toggle (the Who-won tiles, each side's logo and team name) shows in every match, our side or the
// opposition, with a dot on a side that is incomplete; beside it the Full name | First name toggle.
export function ScorecardStepHeader({ sides, scorecardSide, onSideChange, incomplete = {}, label, ariaLabel, note }: ScorecardStepHeaderProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
          {label && (
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.75 }}>
              {label}
            </Typography>
          )}
          <SidePicker
            label={label ?? ariaLabel ?? 'Team'}
            options={sidePickerOptions(sides)}
            value={scorecardSide}
            onChange={onSideChange}
            marked={incomplete}
            dense
          />
        </Box>
        <NameModeToggle />
      </Box>
      {note && (
        <Typography variant="caption" color="text.secondary">
          {note}
        </Typography>
      )}
    </Box>
  )
}
