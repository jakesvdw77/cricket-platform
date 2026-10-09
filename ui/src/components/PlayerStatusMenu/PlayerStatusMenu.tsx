import type { ReactNode } from 'react'
import { ListItemIcon, ListSubheader, Menu, MenuItem } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import { PLAYER_STATUS_ACTIONS, PLAYER_STATUS_ACTION_LABEL, PLAYER_STATUS_LABEL } from '../../utils/playerStatus'
import type { PlayerStatus, PlayerStatusAction } from '../../utils/playerStatus'

export interface PlayerStatusMenuProps {
  status: PlayerStatus
  anchorEl: HTMLElement | null
  onClose: () => void
  onAction: (action: PlayerStatusAction) => void
}

const ACTION_ICON: Record<PlayerStatusAction, ReactNode> = {
  verify: <CheckCircleOutlineIcon fontSize="small" />,
  reject: <HighlightOffIcon fontSize="small" />,
  suspend: <PauseCircleOutlineIcon fontSize="small" />,
  reactivate: <PlayCircleOutlineIcon fontSize="small" />,
}

// Reject and Suspend are the changes a manager can regret, so they read in the error colour (they also ask first).
const CAUTIOUS: PlayerStatusAction[] = ['reject', 'suspend']

// docs/specs/088-players-polls-alignment.md: the menu behind a player's one Status button. Headed "Status: <current>",
// then only the changes that are valid from that status (so no item ever appears greyed out). Purely presentational: the
// caller does the work and the confirmations (usePlayerStatusActions).
export function PlayerStatusMenu({ status, anchorEl, onClose, onAction }: PlayerStatusMenuProps) {
  return (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
      MenuListProps={{ 'aria-label': 'Change status', dense: false }}
    >
      <ListSubheader component="div" sx={{ lineHeight: 2.25, fontSize: '0.75rem' }}>
        Status: <b>{PLAYER_STATUS_LABEL[status]}</b>
      </ListSubheader>
      {PLAYER_STATUS_ACTIONS[status].map((action) => (
        <MenuItem
          key={action}
          onClick={() => {
            onClose()
            onAction(action)
          }}
          sx={{ minHeight: 44, color: CAUTIOUS.includes(action) ? 'error.dark' : undefined }}
        >
          <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>{ACTION_ICON[action]}</ListItemIcon>
          {PLAYER_STATUS_ACTION_LABEL[action]}
        </MenuItem>
      ))}
    </Menu>
  )
}
