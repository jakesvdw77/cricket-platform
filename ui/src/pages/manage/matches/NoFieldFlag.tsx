import { Chip, Tooltip } from '@mui/material'
import { badgeSx } from '../../../components/RecordCard'

// docs/specs/151 slice I: a match with venue text but no linked field has no map position, so the Player Hub shows no Get Directions
// and no weather. Managers see this small amber tag beside the venue so those matches stand out. A match with no venue at all
// (it reads "TBC") and a linked match show nothing.
export function showsNoFieldFlag(match: { venue?: string | null; playingAreaId?: string | null }): boolean {
  return Boolean(match.venue?.trim()) && !match.playingAreaId
}

export function NoFieldFlag() {
  return (
    <Tooltip title="Link a field to get directions and weather">
      <Chip size="small" label="No Field" data-testid="match-no-field-flag" sx={{ ...badgeSx('warning'), height: 20, fontSize: '0.6875rem', ml: 0.75 }} />
    </Tooltip>
  )
}
