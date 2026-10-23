import type { SxProps, Theme } from '@mui/material'
import { displayLabelSx } from '../theme'

// docs/specs/073-availability-hub.md: the one segmented-switch look (green fill when selected,
// equal parts full width on a phone), shared by the Responses page's view switch and the
// Availability hub's Polls | Players switch. Style only, applied to a ToggleButtonGroup.
export const segmentedSwitchSx: SxProps<Theme> = {
  flex: 'none',
  alignSelf: { xs: 'stretch', sm: 'center' },
  // docs/specs/120: the option text is in the display face (uppercase).
  '& .MuiToggleButton-root': { ...displayLabelSx, fontSize: 15, flex: { xs: 1, sm: 'none' }, px: 2, whiteSpace: 'nowrap' },
  // The selected view is the green fill (primary main + white text), not MUI's faint grey.
  '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
    bgcolor: 'primary.main',
    color: 'primary.contrastText',
    borderColor: 'primary.main',
    fontWeight: 600,
  },
  '& .MuiToggleButton-root.Mui-selected:hover': { bgcolor: 'primary.dark' },
}
