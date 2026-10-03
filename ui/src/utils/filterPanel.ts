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
