import { Box, Tooltip } from '@mui/material'
import StarBorderIcon from '@mui/icons-material/StarBorder'

export const STANDOUT_HELP = 'Standout: a star marks a standout performance shown on the result. Suggested from the scorecard. Tap a star to remove or add one.'

// docs/specs/118: the header over a column of StandoutToggle stars (Batting, Bowling and the fielding list), so the star is explained
// once. "Standout" in uppercase from sm; a star icon named "Standout" on a phone. The help is a tooltip (and the title).
export function StandoutHeader() {
  return (
    <Tooltip title={STANDOUT_HELP}>
      <Box component="span" title={STANDOUT_HELP} data-testid="standout-header" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          Standout
        </Box>
        <StarBorderIcon role="img" aria-label="Standout" sx={{ display: { xs: 'inline-block', sm: 'none' }, fontSize: 16 }} />
      </Box>
    </Tooltip>
  )
}
