import type { ReactNode } from 'react'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EqualizerOutlinedIcon from '@mui/icons-material/EqualizerOutlined'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import type { ManageMenuItem } from '../components/ManageMenu'
import { PLAYER_STATUS_ACTIONS } from './playerStatus'
import type { PlayerStatus, PlayerStatusAction } from './playerStatus'

export interface PlayerMenuOptions {
  status: PlayerStatus
  // Where Open Player, Edit Player and View Stats lead (already carrying returnTo). Omit `openTo` on the Player page itself.
  openTo?: string
  editTo: string
  statsTo: string
  onStatusAction: (action: PlayerStatusAction) => void
}

// docs/specs/141: Title Case menu labels (the status actions keep their short names in `playerStatus.ts` for the banner and dialogs).
const STATUS_ITEM_TITLE: Record<PlayerStatusAction, string> = {
  verify: 'Verify Player',
  reject: 'Reject Player',
  suspend: 'Suspend Player',
  reactivate: 'Reactivate Player',
}

const STATUS_ITEM_ICON: Record<PlayerStatusAction, ReactNode> = {
  verify: <CheckCircleOutlineIcon fontSize="small" />,
  reject: <HighlightOffIcon fontSize="small" />,
  suspend: <PauseCircleOutlineIcon fontSize="small" />,
  reactivate: <PlayCircleOutlineIcon fontSize="small" />,
}

// Reject and Suspend are the changes a manager can regret, so they read in the error colour (they also ask first).
const CAUTIOUS: PlayerStatusAction[] = ['reject', 'suspend']

// docs/specs/141: the ordered actions of one player, built in ONE place for the card, the table row and the Player page so they cannot
// drift: Open Player (not on the Player page), Edit Player, View Stats, then only the status changes valid from the player's status.
export function playerMenuItems({ status, openTo, editTo, statsTo, onStatusAction }: PlayerMenuOptions): ManageMenuItem[] {
  return [
    ...(openTo ? [{ id: 'open', title: 'Open Player', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: openTo }] : []),
    { id: 'edit', title: 'Edit Player', icon: <EditOutlinedIcon fontSize="small" />, to: editTo },
    { id: 'stats', title: 'View Stats', icon: <EqualizerOutlinedIcon fontSize="small" />, to: statsTo },
    ...PLAYER_STATUS_ACTIONS[status].map((action) => ({
      id: action,
      title: STATUS_ITEM_TITLE[action],
      icon: STATUS_ITEM_ICON[action],
      onClick: () => onStatusAction(action),
      ...(CAUTIOUS.includes(action) && { tone: 'error' as const }),
    })),
  ]
}
