import type { SxProps, Theme } from '@mui/material'

// docs/specs/074-availability-coverage.md: the bordered, shadowed filter surface of the Players
// availability view (docs/specs/068), shared with the Coverage view so there is one copy. Same
// surface as ListToolbar, but a column of rows (ListToolbar only supports a single search row).
export const filterPanelSx: SxProps<Theme> = {
  border: 1,
  borderColor: 'divider',
  borderRadius: 2,
  bgcolor: 'background.paper',
  boxShadow: 1,
  p: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
}

// docs/specs/085 (I): the compact density of the same surface - 8 px padding and row gap instead of 16 - used only by the
// Availability pages' toolbars (FilterBar density="compact", the Responses pages' toolbar panel). Other pages keep
// filterPanelSx until the user decides to roll it out.
export const compactFilterPanelSx: SxProps<Theme> = {
  ...(filterPanelSx as object),
  p: 1,
  gap: 1,
}

export type ToolbarDensity = 'comfortable' | 'compact'

export const filterPanelSxFor = (density: ToolbarDensity = 'comfortable'): SxProps<Theme> =>
  density === 'compact' ? compactFilterPanelSx : filterPanelSx

// The height of a toolbar field in the compact density (the default small input is 40 px).
export const COMPACT_FIELD_HEIGHT = 36

// Compact desktop fields: a 36 px outlined input (label and text re-centred), instead of the default small 40 px.
export const compactFieldsSx = {
  '& .MuiOutlinedInput-root': { height: COMPACT_FIELD_HEIGHT, boxSizing: 'border-box' },
  '& .MuiOutlinedInput-input': { py: 0, height: '100%', boxSizing: 'border-box' },
  // The Select-based fields (League, Team) render their value in a div with its own padding, min-height and block
  // layout; centre it in the 36 px box like the text inputs, so the value never rides up into the floated label.
  '& .MuiSelect-select.MuiOutlinedInput-input': { py: 0, minHeight: 0, height: '100%', display: 'flex', alignItems: 'center' },
  '& .MuiInputLabel-outlined:not(.MuiInputLabel-shrink)': { transform: 'translate(14px, 7px) scale(1)' },
}
