import type { ReactNode } from 'react'
import { ListItemIcon, ListSubheader, Menu, MenuItem } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import ReplayIcon from '@mui/icons-material/Replay'
import { FIELD_STATUS_ACTIONS, FIELD_STATUS_ACTION_LABEL, FIELD_STATUS_LABEL } from '../../utils/fieldStatus'
import type { FieldStatus, FieldStatusAction } from '../../utils/fieldStatus'

export interface FieldStatusMenuProps {
  status: FieldStatus
  anchorEl: HTMLElement | null
  onClose: () => void
  onAction: (action: FieldStatusAction) => void
}

const ACTION_ICON: Record<FieldStatusAction, ReactNode> = {
  verify: <CheckCircleOutlineIcon fontSize="small" />,
  reject: <HighlightOffIcon fontSize="small" />,
  reopen: <ReplayIcon fontSize="small" />,
}

// Reject is the change an admin can regret, so it reads in the error colour (it also asks for a reason first).
const CAUTIOUS: FieldStatusAction[] = ['reject']

// docs/specs/099-fields-directory.md: the menu behind a field's one Status button (the platform admin's card, list row and
// field page), the shape of PlayerStatusMenu. Headed "Status: <current>", then only the changes valid from that status
// (Unverified: Verify, Reject; Verified: none; Rejected: Reopen). A Verified field has nothing to list, so its caller
// disables the button instead of opening an empty menu. Purely presentational: useFieldStatusActions does the work.
export function FieldStatusMenu({ status, anchorEl, onClose, onAction }: FieldStatusMenuProps) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      MenuListProps={{ 'aria-label': 'Change status', dense: false }}
    >
      <ListSubheader component="div" sx={{ lineHeight: 2.25, fontSize: '0.75rem' }}>
        Status: <b>{FIELD_STATUS_LABEL[status]}</b>
      </ListSubheader>
      {FIELD_STATUS_ACTIONS[status].map((action) => (
        <MenuItem
          key={action}
          onClick={() => {
            onClose()
            onAction(action)
          }}
          sx={{ minHeight: 44, color: CAUTIOUS.includes(action) ? 'error.dark' : undefined }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>{ACTION_ICON[action]}</ListItemIcon>
          {FIELD_STATUS_ACTION_LABEL[action]}
          {action === 'reject' ? '…' : ''}
        </MenuItem>
      ))}
    </Menu>
  )
}
