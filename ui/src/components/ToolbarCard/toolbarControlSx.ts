import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import { COMPACT_FIELD_HEIGHT } from '../../utils/filterPanel'

// docs/standards/page-anatomy.md section 3: every control in a toolbar card (select, search, sort button, segmented toggle, toggle
// chips) is a 36 px sibling. Edge colour, radius, height, font and hover are defined ONCE here and used by ToolbarSortButton,
// ToolbarToggleChip and the toolbar variant of CompactToggleGroup (ListViewToggle).
export const TOOLBAR_CONTROL_HEIGHT = COMPACT_FIELD_HEIGHT
export const TOOLBAR_CONTROL_RADIUS = '6px'
export const TOOLBAR_CONTROL_EDGE = 'divider'

const font = {
  fontSize: '0.8125rem',
  lineHeight: 1.2,
  fontWeight: 600,
  color: 'text.primary',
  textTransform: 'none',
  whiteSpace: 'nowrap',
} as const

// The soft green tint of a pressed or selected control, and of hover.
export const toolbarSelectedBg = (theme: Theme) => alpha(theme.palette.primary.main, 0.12)
export const toolbarHoverBg = (theme: Theme) => alpha(theme.palette.primary.main, 0.06)

// A stand-alone control (sort button, toggle chip): its own 1 px edge and 6 px corners.
export const toolbarControlSx = {
  ...font,
  height: TOOLBAR_CONTROL_HEIGHT,
  minHeight: TOOLBAR_CONTROL_HEIGHT,
  boxSizing: 'border-box',
  px: 1.25,
  gap: 0.75,
  bgcolor: 'background.paper',
  border: 1,
  borderColor: TOOLBAR_CONTROL_EDGE,
  borderRadius: TOOLBAR_CONTROL_RADIUS,
  boxShadow: 0,
  '&:hover': { bgcolor: toolbarHoverBg },
} as const

// The segmented Cards | List control: ONE outer edge (same colour and radius as above), a single divider before the second
// segment, no per-button borders, text and icons in the same ink for both segments (the selected one is only tinted).
export const toolbarSegmentedSx = {
  boxSizing: 'border-box',
  height: TOOLBAR_CONTROL_HEIGHT,
  bgcolor: 'background.paper',
  border: 1,
  borderColor: TOOLBAR_CONTROL_EDGE,
  borderRadius: TOOLBAR_CONTROL_RADIUS,
  boxShadow: 0,
  overflow: 'hidden',
  '& .MuiToggleButtonGroup-grouped': {
    ...font,
    height: '100%',
    boxSizing: 'border-box',
    px: 1.25,
    gap: 0.75,
    m: 0,
    border: 0,
    borderRadius: 0,
    boxShadow: 0,
    outlineOffset: -2,
    '& svg': { fontSize: 16, color: 'inherit' },
    '&:hover': { bgcolor: toolbarHoverBg },
    '&.Mui-selected, &.Mui-selected:hover': { bgcolor: toolbarSelectedBg, color: 'text.primary', fontWeight: 600 },
  },
  '& .MuiToggleButtonGroup-grouped:not(:first-of-type)': {
    m: 0,
    borderLeft: 1,
    borderLeftColor: TOOLBAR_CONTROL_EDGE,
    borderRadius: 0,
  },
} as const

// The inputs of a toolbar (selects and search, via FilterBar `bare`): the same white fill, edge token and radius, 13 px text (select
// values weight 600) and 20 px / 16 px icons, so they read as siblings of the buttons above. The 36 px height comes from compactFieldsSx.
export const toolbarFieldsSx = {
  '& .MuiOutlinedInput-root': { bgcolor: 'background.paper', borderRadius: TOOLBAR_CONTROL_RADIUS, fontSize: '0.8125rem' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: TOOLBAR_CONTROL_EDGE },
  '& .MuiSelect-select': { fontSize: '0.8125rem', fontWeight: 600, color: 'text.primary' },
  '& .MuiSelect-icon': { fontSize: 20 },
  '& .MuiInputAdornment-root .MuiSvgIcon-root': { fontSize: 16 },
} as const
