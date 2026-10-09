import { ToggleButton, ToggleButtonGroup } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined'
import { alpha } from '@mui/material/styles'
import type { ListView } from '../../hooks/useListViewPreference'

export interface ListViewToggleProps {
  value: ListView
  onChange: (view: ListView) => void
  // The Filters sheet on a phone: two equal parts across the full width with 44 px tap targets.
  fullWidth?: boolean
}

const compactSx: SxProps<Theme> = {
  flex: 'none',
  bgcolor: 'background.paper',
  '& .MuiToggleButton-root': {
    height: 28,
    px: 1.25,
    gap: 0.75,
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'none',
    color: 'text.secondary',
    borderColor: 'divider',
  },
  // The selected view is a light primary tint (the content line is quiet; the Availability switch keeps its solid fill).
  '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
    bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.12),
    color: 'primary.dark',
    fontWeight: 700,
  },
}

const fullWidthSx: SxProps<Theme> = {
  ...compactSx,
  width: '100%',
  '& .MuiToggleButton-root': {
    ...(compactSx as Record<string, Record<string, unknown>>)['& .MuiToggleButton-root'],
    flex: 1,
    height: 44,
    fontSize: '0.875rem',
  },
  '& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover': {
    bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.12),
    color: 'primary.dark',
    fontWeight: 700,
  },
}

// docs/specs/088-players-polls-alignment.md: the Cards | List switch of a list page, the standard for Players now and
// Matches and Polls later. Controlled; pair it with useListViewPreference so the choice is remembered per page.
export function ListViewToggle({ value, onChange, fullWidth = false }: ListViewToggleProps) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      aria-label="View"
      onChange={(_event, next: ListView | null) => {
        // exclusive groups report null when the selected button is clicked again: keep the current view
        if (next) onChange(next)
      }}
      sx={fullWidth ? fullWidthSx : compactSx}
    >
      <ToggleButton value="cards" aria-label="Cards">
        <GridViewOutlinedIcon sx={{ fontSize: 16 }} />
        Cards
      </ToggleButton>
      <ToggleButton value="list" aria-label="List">
        <ViewListOutlinedIcon sx={{ fontSize: 16 }} />
        List
      </ToggleButton>
    </ToggleButtonGroup>
  )
}
