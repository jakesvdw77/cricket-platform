import { useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import { KeyFigureTile } from '../../../components/KeyFigureTile'

export interface RolePlayer {
  playerId: string
  name: string
}

// The Captain and Wicketkeeper tiles of the Select team page strip: a KeyFigureTile that opens a menu of the picked
// players (the caller leaves out the 12th man) with the current one ticked and a None entry.
export function RolePickerTile({
  testId,
  icon,
  label,
  currentId,
  currentName,
  players,
  disabled,
  onChange,
}: {
  testId: string
  icon: ReactNode
  label: string
  currentId: string | null
  currentName: string | null
  players: RolePlayer[]
  disabled: boolean
  onChange: (playerId: string | null) => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const close = () => setAnchor(null)
  const choose = (playerId: string | null) => {
    close()
    if (playerId !== currentId) {
      onChange(playerId)
    }
  }
  const item = (playerId: string | null, name: string) => {
    const checked = playerId === currentId
    return (
      <MenuItem key={playerId ?? 'none'} role="menuitemradio" aria-checked={checked} selected={checked} onClick={() => choose(playerId)}>
        <ListItemText>{name}</ListItemText>
        {checked && (
          <ListItemIcon sx={{ minWidth: 0, ml: 2 }}>
            <CheckIcon fontSize="small" />
          </ListItemIcon>
        )}
      </MenuItem>
    )
  }
  return (
    <>
      <KeyFigureTile
        testId={testId}
        icon={icon}
        value={currentName ?? '–'}
        label={label}
        textValue
        onClick={(event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget)}
        ariaLabel={`${label}: ${currentName ?? 'none'}, change`}
        expanded={Boolean(anchor)}
        disabled={disabled}
      />
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close} MenuListProps={{ 'aria-label': label }}>
        {item(null, 'None')}
        {players.map((player) => item(player.playerId, player.name))}
      </Menu>
    </>
  )
}
