import { useState } from 'react'
import { ListItemIcon, Menu, MenuItem } from '@mui/material'
import { ButtonBase } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CheckIcon from '@mui/icons-material/Check'
import { toolbarControlSx } from './toolbarControlSx'

export interface ToolbarSortOption {
  value: string
  // The wording on the button and in the menu, e.g. "Name, A to Z".
  label: string
}

export interface ToolbarSortButtonProps {
  value: string
  options: ToolbarSortOption[]
  onChange: (value: string) => void
}

// docs/standards/page-anatomy.md section 3: the sort control of a toolbar card, a 36 px white outlined button reading
// "Sort: Name, A to Z" with a caret that opens the sort orders as a menu (the current one ticked). A real button: Enter, Space and
// the arrow keys work through the MUI menu. Outside a toolbar the quiet SortLink / SortMenu stay.
export function ToolbarSortButton({ value, options, onChange }: ToolbarSortButtonProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const current = options.find((option) => option.value === value) ?? options[0]
  return (
    <>
      <ButtonBase
        type="button"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
        sx={[toolbarControlSx, { pr: 0.5, justifyContent: 'center', '&.Mui-focusVisible': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main', outlineOffset: 1 } }]}
      >
        {`Sort: ${current.label}`}
        <ArrowDropDownIcon fontSize="small" aria-hidden />
      </ButtonBase>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} MenuListProps={{ 'aria-label': 'Sort order' }}>
        {options.map((option) => (
          <MenuItem
            key={option.value}
            selected={option.value === current.value}
            onClick={() => {
              setAnchor(null)
              onChange(option.value)
            }}
            sx={{ minHeight: 44 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>{option.value === current.value ? <CheckIcon fontSize="small" /> : null}</ListItemIcon>
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
