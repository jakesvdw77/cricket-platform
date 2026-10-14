import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Box, Menu, MenuItem, TextField, Typography } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import { maxPositionFor, moveId, placeAtPosition } from '../../utils/reorderRows'

export interface PlayerRowMenuProps {
  // The element the menu opens from; null keeps it closed.
  anchor: HTMLElement | null
  onClose: () => void
  playerId: string
  // For the position field's accessible name ("Batting position for Ann Ash").
  playerName: string
  // The listed rows in their current order, and the most the list may hold.
  ids: string[]
  maxPlaces?: number | null
  // The full new order.
  onReorder: (ids: string[]) => void
  // "Batting position" for batters, "Bowling position" for bowlers.
  positionLabel?: string
  // Shown in the field's placeholder while the row is listed; defaults to its place in `ids`.
  currentPosition?: number | null
  // Why the position field is unavailable (the list is full and this row is not in it); the field is disabled and the
  // reason shown under it.
  positionDisabledReason?: string | null
  // False for a row that is not in the numbered list (the 12th man, a holding-area row): no Move up / Move down.
  movable?: boolean
  // Extra menu items, each with a key: above the position field, between the field and Move up / Move down, and below
  // Move down. MUI's Menu does not accept a Fragment, so they are arrays.
  before?: ReactNode[]
  afterPosition?: ReactNode[]
  after?: ReactNode[]
}

// MenuList hands its first item `autoFocus` and `tabIndex`, so the position row forwards what it is given.
function PositionItem({
  playerName,
  ids,
  playerId,
  maxPlaces,
  onReorder,
  onClose,
  label,
  placeholder,
  disabledReason,
  ...menuItemProps
}: {
  playerName: string
  ids: string[]
  playerId: string
  maxPlaces?: number | null
  onReorder: (ids: string[]) => void
  onClose: () => void
  label: string
  placeholder: string
  disabledReason: string | null
} & { autoFocus?: boolean; tabIndex?: number }) {
  const inputId = useId()
  const reasonId = useId()
  const [draft, setDraft] = useState('')
  // Enter commits and closes; the blur that follows must not commit a second time.
  const committedRef = useRef(false)

  const commit = (text: string) => {
    if (committedRef.current) return
    const next = placeAtPosition(ids, playerId, text, maxPlaces)
    if (!next) return
    committedRef.current = true
    onReorder(next)
  }

  const disabled = disabledReason !== null
  return (
    <MenuItem
      {...menuItemProps}
      component="div"
      disableRipple
      onClick={(event) => event.stopPropagation()}
      sx={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 0.5, '&:hover': { bgcolor: 'transparent' } }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" component="label" htmlFor={inputId}>
          {label}
        </Typography>
        <TextField
          id={inputId}
          type="number"
          size="small"
          value={draft}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation()
            if (event.key === 'Enter') {
              event.preventDefault()
              commit(draft)
              onClose()
            }
          }}
          onBlur={() => commit(draft)}
          inputProps={{
            min: 1,
            max: maxPositionFor(ids, playerId, maxPlaces),
            step: 1,
            'aria-label': `${label} for ${playerName}`,
            'aria-describedby': disabled ? reasonId : undefined,
          }}
          sx={{ width: 84, flex: 'none' }}
        />
      </Box>
      {disabledReason && (
        <Typography id={reasonId} variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal' }}>
          {disabledReason}
        </Typography>
      )}
    </MenuItem>
  )
}

// docs/specs/076-team-selection.md, extracted from TeamSelectionList for docs/specs/101: the tap-a-name menu of a
// reorderable row - a position number field (type 3 and the row moves to 3), Move up and Move down - with slots for the
// items that differ per screen (Make captain, Swap player..., Remove). Reordering from here is the route on a phone and
// for the keyboard; dragging (hooks/useReorderableRows) is the desktop shortcut to the same result. Opens fresh each
// time: the field's draft lives inside the open menu.
export function PlayerRowMenu({
  anchor,
  onClose,
  playerId,
  playerName,
  ids,
  maxPlaces = null,
  onReorder,
  positionLabel = 'Batting position',
  currentPosition,
  positionDisabledReason = null,
  movable,
  before = [],
  afterPosition = [],
  after = [],
}: PlayerRowMenuProps) {
  const index = ids.indexOf(playerId)
  // An empty playerId means nothing is selected (the menu is closing): its items are gone at once, as they always were.
  const active = playerId !== ''
  const listed = active && (movable ?? index !== -1)
  const placeholder = listed ? String(currentPosition ?? index + 1) : '–'

  const move = (direction: -1 | 1) => {
    const next = moveId(ids, playerId, direction)
    if (next) onReorder(next)
    onClose()
  }

  return (
    <Menu
      anchorEl={anchor}
      open={Boolean(anchor)}
      onClose={onClose}
      slotProps={{ paper: { sx: { minWidth: 240, maxWidth: 'calc(100vw - 32px)' } } }}
    >
      {before}
      {active && (
        <PositionItem
          playerName={playerName}
          ids={ids}
          playerId={playerId}
          maxPlaces={maxPlaces}
          onReorder={onReorder}
          onClose={onClose}
          label={positionLabel}
          placeholder={placeholder}
          disabledReason={positionDisabledReason}
        />
      )}
      {afterPosition}
      {listed && (
        <MenuItem disabled={index <= 0} onClick={() => move(-1)}>
          <KeyboardArrowUpIcon fontSize="small" sx={{ mr: 1 }} />
          Move up
        </MenuItem>
      )}
      {listed && (
        <MenuItem disabled={index === ids.length - 1} onClick={() => move(1)}>
          <KeyboardArrowDownIcon fontSize="small" sx={{ mr: 1 }} />
          Move down
        </MenuItem>
      )}
      {after}
    </Menu>
  )
}
