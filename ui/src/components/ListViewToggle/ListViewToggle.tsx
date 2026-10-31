import { ToggleButton } from '@mui/material'
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined'
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined'
import { CompactToggleGroup } from '../CompactToggleGroup'
import type { ListView } from '../../hooks/useListViewPreference'

export interface ListViewToggleProps {
  value: ListView
  onChange: (view: ListView) => void
  // The Filters sheet on a phone: two equal parts across the full width with 44 px tap targets.
  fullWidth?: boolean
  // docs/standards/page-anatomy.md section 3: the 36 px toolbar look, for the toggle inside a ToolbarCard. Omitted, unchanged.
  variant?: 'default' | 'toolbar'
}

// docs/specs/088-players-polls-alignment.md: the Cards | List switch of a list page, the standard for Players now and
// Matches and Polls later. Controlled; pair it with useListViewPreference so the choice is remembered per page.
export function ListViewToggle({ value, onChange, fullWidth = false, variant = 'default' }: ListViewToggleProps) {
  return (
    <CompactToggleGroup value={value} onChange={onChange} ariaLabel="View" fullWidth={fullWidth} toolbar={variant === 'toolbar'}>
      <ToggleButton value="cards" aria-label="Cards">
        <GridViewOutlinedIcon sx={{ fontSize: 16 }} />
        Cards
      </ToggleButton>
      <ToggleButton value="list" aria-label="List">
        <ViewListOutlinedIcon sx={{ fontSize: 16 }} />
        List
      </ToggleButton>
    </CompactToggleGroup>
  )
}
