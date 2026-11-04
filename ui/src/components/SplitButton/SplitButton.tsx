import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ButtonGroup, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import { Button } from '../Button'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

export interface SplitButtonItem {
  id: string
  label: string
  icon?: ReactNode
  onClick: () => void
}

export interface SplitButtonProps {
  // The main action: the text on the left half, run by a click on it.
  label: string
  onClick: () => void
  // The related actions offered by the caret half. Do not repeat the main action: the menu lists it first by itself.
  items: SplitButtonItem[]
  testId?: string
}

// docs/standards/page-anatomy.md (owner, 2026-11-05): a title-row primary that has one obvious action and a close relative (Capture New Result
// and Import Result). A filled compact button joined to a caret that opens the list of related actions. Both halves are 32 px high.
export function SplitButton({ label, onClick, items, testId = 'split-button' }: SplitButtonProps) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  return (
    <>
      <ButtonGroup variant="contained" sx={{ flex: 'none', boxShadow: 0 }}>
        <Button size="compact" onClick={onClick} data-testid={testId}>
          {label}
        </Button>
        <Button
          ref={anchor}
          size="compact"
          aria-label={`More options for ${label}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen(true)}
          data-testid={`${testId}-more`}
          sx={{ px: '6px', minWidth: { xs: 44, sm: 0 } }}
        >
          <ArrowDropDownIcon fontSize="small" />
        </Button>
      </ButtonGroup>
      <Menu id={menuId} anchorEl={anchor.current} open={open} onClose={() => setOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {[{ id: 'main', label, onClick }, ...items].map((item: SplitButtonItem) => (
          <MenuItem
            key={item.id}
            onClick={() => {
              setOpen(false)
              item.onClick()
            }}
            sx={{ minHeight: 44 }}
          >
            {'icon' in item && item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}
