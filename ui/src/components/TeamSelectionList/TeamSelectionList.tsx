import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { ButtonBase, Box, Card, Chip, Divider, Menu, MenuItem, TextField, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { Theme } from '@mui/material/styles'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CheckIcon from '@mui/icons-material/Check'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import type { PlayingRole, SelectionLimits } from '../../api/matchSideApi'
import type { SelectionAvailability } from '../../api/matchSelectionApi'

const ROLE_LABEL: Record<PlayingRole, string> = {
  BATSMAN: 'Batsman',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
}
const ROLE_OPTIONS: PlayingRole[] = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER']

type BadgeTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'

// Same tinted-outline chips the mockup draws: the tone is a tint plus a word, never colour alone.
function toneSx(tone: BadgeTone) {
  if (tone === 'neutral') {
    return { color: 'text.secondary', fontWeight: 600 }
  }
  return {
    color: `${tone}.dark`,
    borderColor: `${tone}.main`,
    bgcolor: (theme: Theme) => alpha(theme.palette[tone].main, 0.12),
    fontWeight: 600,
  }
}

const AVAILABILITY_BADGE: Record<SelectionAvailability, { label: string; tone: BadgeTone }> = {
  AVAILABLE: { label: 'Available', tone: 'success' },
  UNSURE: { label: 'Unsure', tone: 'warning' },
  NO_RESPONSE: { label: 'No response', tone: 'neutral' },
  NOT_POLLED: { label: 'Not polled', tone: 'neutral' },
  UNAVAILABLE: { label: 'Said unavailable', tone: 'error' },
}

// One availability word badge, shared with SelectPlayersDialog.
export function AvailabilityBadge({ availability }: { availability: SelectionAvailability }) {
  const badge = AVAILABILITY_BADGE[availability]
  return <Chip size="small" variant="outlined" label={badge.label} sx={toneSx(badge.tone)} />
}

export interface TeamSelectionPlayer {
  playerProfileId: string
  name: string
  // null = waiting in the holding area (and always null for the 12th man).
  battingOrder: number | null
  role: PlayingRole
  // null draws no availability badge (no poll covers the match, or the pool has not loaded).
  availability: SelectionAvailability | null
  // The other team he is also selected for (a duplicate that pre-dates 076), drawn as "Also in X".
  alsoIn: string | null
}

export interface TeamSelectionListProps {
  // Every selected player, the 12th man included, in any order.
  players: TeamSelectionPlayer[]
  captainPlayerId: string | null
  wicketKeeperPlayerId: string | null
  twelfthManPlayerId: string | null
  limits: SelectionLimits
  // Dragging is off while the side is announced; the menu keeps working.
  dragDisabled?: boolean
  // The full new batting order: listed players get positions 1..k, the rest have none.
  onReorder: (playerProfileIds: string[]) => void
  onSetCaptain: (playerProfileId: string | null) => void
  onSetWicketKeeper: (playerProfileId: string | null) => void
  onMakeTwelfthMan: (playerProfileId: string) => void
  onChangeRole: (playerProfileId: string, role: PlayingRole) => void
  onRemove: (playerProfileId: string) => void
}

const SECTION_LABEL_SX = {
  borderTop: '1px dashed',
  borderColor: 'divider',
  mt: 1,
  pt: 0.75,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'text.secondary',
} as const

type RowKind = 'positioned' | 'waiting' | 'twelfth'

// docs/specs/076-team-selection.md section 2: the one selection list of a team - the holding area
// for players without a batting position, the numbered places, the optional 12th man, and the
// tap-a-name menu. Presentational: every change is a callback (the page owns the mutations and the
// optimistic cache updates). Drag and drop is the browser's native HTML5 drag events (as the legacy
// TeamSidePanel did); touch and keyboard reach the same result through the Batting position spinner
// and Move up / Move down in the menu.
export function TeamSelectionList({
  players,
  captainPlayerId,
  wicketKeeperPlayerId,
  twelfthManPlayerId,
  limits,
  dragDisabled = false,
  onReorder,
  onSetCaptain,
  onSetWicketKeeper,
  onMakeTwelfthMan,
  onChangeRole,
  onRemove,
}: TeamSelectionListProps) {
  const [menu, setMenu] = useState<{ anchor: HTMLElement; playerId: string } | null>(null)
  const [roleAnchor, setRoleAnchor] = useState<HTMLElement | null>(null)
  const [positionDraft, setPositionDraft] = useState('')
  const positionCommittedRef = useRef(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [holdingOver, setHoldingOver] = useState(false)

  const twelfthMan = players.find((player) => player.playerProfileId === twelfthManPlayerId) ?? null
  const rest = players.filter((player) => player.playerProfileId !== twelfthManPlayerId)
  const positioned = rest
    .filter((player) => player.battingOrder != null)
    .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
  const waiting = rest
    .filter((player) => player.battingOrder == null)
    .sort((a, b) => a.name.localeCompare(b.name))
  const positionedIds = positioned.map((player) => player.playerProfileId)
  const placesFull = positioned.length >= limits.battingPlaces
  const showTwelfthRow = limits.twelfthManAllowed || twelfthMan !== null

  const menuPlayer = menu ? (players.find((player) => player.playerProfileId === menu.playerId) ?? null) : null

  const closeMenu = () => {
    setMenu(null)
    setRoleAnchor(null)
  }

  const openMenu = (anchor: HTMLElement, player: TeamSelectionPlayer) => {
    positionCommittedRef.current = false
    setPositionDraft('')
    setRoleAnchor(null)
    setMenu({ anchor, playerId: player.playerProfileId })
  }

  const commitPosition = (player: TeamSelectionPlayer, text: string) => {
    if (positionCommittedRef.current) {
      return
    }
    const parsed = Number(text)
    if (text.trim() === '' || !Number.isFinite(parsed)) {
      return
    }
    const isPositioned = player.battingOrder != null && player.playerProfileId !== twelfthManPlayerId
    const maxPosition = Math.min(limits.battingPlaces, positioned.length + (isPositioned ? 0 : 1))
    const target = Math.min(Math.max(Math.trunc(parsed), 1), Math.max(maxPosition, 1))
    if (isPositioned && positionedIds.indexOf(player.playerProfileId) === target - 1) {
      return
    }
    positionCommittedRef.current = true
    const ids = positionedIds.filter((id) => id !== player.playerProfileId)
    ids.splice(target - 1, 0, player.playerProfileId)
    onReorder(ids)
  }

  const move = (playerId: string, direction: -1 | 1) => {
    const index = positionedIds.indexOf(playerId)
    const target = index + direction
    if (index === -1 || target < 0 || target >= positionedIds.length) {
      return
    }
    const ids = [...positionedIds]
    ids.splice(index, 1)
    ids.splice(target, 0, playerId)
    onReorder(ids)
  }

  const resetDrag = () => {
    setDragId(null)
    setDropIndex(null)
    setHoldingOver(false)
  }

  // index is the target slot among the numbered places as drawn (0..positioned.length).
  const dropAt = (index: number) => {
    if (!dragId) {
      return
    }
    const from = positionedIds.indexOf(dragId)
    if (from === -1 && placesFull) {
      resetDrag()
      return
    }
    const target = from !== -1 && from < index ? index - 1 : index
    resetDrag()
    if (from === target) {
      return
    }
    const ids = positionedIds.filter((id) => id !== dragId)
    ids.splice(target, 0, dragId)
    onReorder(ids)
  }

  const dropIntoHolding = () => {
    const id = dragId
    resetDrag()
    if (id && positionedIds.includes(id)) {
      onReorder(positionedIds.filter((candidate) => candidate !== id))
    }
  }

  const renderRow = (player: TeamSelectionPlayer, kind: RowKind, index: number) => {
    const isCaptain = player.playerProfileId === captainPlayerId
    const isKeeper = player.playerProfileId === wicketKeeperPlayerId
    const availability = player.availability
    const showAvailability =
      availability === 'UNSURE' ||
      availability === 'NO_RESPONSE' ||
      availability === 'NOT_POLLED' ||
      availability === 'UNAVAILABLE'
    const indicatorTop = kind === 'positioned' && dragId !== null && dropIndex === index
    const indicatorBottom =
      kind === 'positioned' && dragId !== null && dropIndex === positioned.length && index === positioned.length - 1

    return (
      <Box
        key={player.playerProfileId}
        data-testid={`selection-row-${player.playerProfileId}`}
        draggable={!dragDisabled}
        onDragStart={(event: DragEvent<HTMLElement>) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', player.playerProfileId)
          setDragId(player.playerProfileId)
        }}
        onDragEnd={resetDrag}
        onDragOver={(event: DragEvent<HTMLElement>) => {
          if (!dragId || kind !== 'positioned') {
            return
          }
          event.preventDefault()
          const rect = event.currentTarget.getBoundingClientRect()
          setHoldingOver(false)
          setDropIndex(event.clientY < rect.top + rect.height / 2 ? index : index + 1)
        }}
        onDrop={(event: DragEvent<HTMLElement>) => {
          if (!dragId || kind !== 'positioned') {
            return
          }
          event.preventDefault()
          event.stopPropagation()
          dropAt(dropIndex ?? index)
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          '&:last-of-type': { borderBottom: 0 },
          opacity: dragId === player.playerProfileId ? 0.5 : 1,
          boxShadow: (theme: Theme) =>
            indicatorTop
              ? `inset 0 2px 0 0 ${theme.palette.primary.main}`
              : indicatorBottom
                ? `inset 0 -2px 0 0 ${theme.palette.primary.main}`
                : 'none',
        }}
      >
        <Box
          aria-hidden
          data-testid="drag-handle"
          sx={{
            width: 44,
            height: 44,
            flex: 'none',
            display: 'grid',
            placeItems: 'center',
            color: dragDisabled ? 'action.disabled' : 'text.secondary',
            cursor: dragDisabled ? 'default' : 'grab',
          }}
        >
          <DragIndicatorIcon fontSize="small" />
        </Box>

        <Typography
          component="span"
          variant="body2"
          color="text.secondary"
          sx={{ width: 22, flex: 'none', fontVariantNumeric: 'tabular-nums' }}
        >
          {kind === 'twelfth' ? '' : (player.battingOrder ?? '–')}
        </Typography>

        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 1, rowGap: 0.25 }}>
          <ButtonBase
            aria-haspopup="menu"
            aria-expanded={menu?.playerId === player.playerProfileId}
            aria-label={`${player.name}, open menu`}
            onClick={(event) => openMenu(event.currentTarget, player)}
            sx={{
              minHeight: 36,
              px: 0.5,
              borderRadius: 1,
              fontSize: 14,
              fontWeight: 600,
              textAlign: 'left',
              fontFamily: 'inherit',
              overflowWrap: 'anywhere',
              '&:hover': { bgcolor: (theme: Theme) => alpha(theme.palette.primary.main, 0.08) },
            }}
          >
            {player.name}
            <ArrowDropDownIcon fontSize="small" aria-hidden />
          </ButtonBase>
          <Box sx={{ ml: 'auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', columnGap: 0.75, rowGap: 0.25, pr: 0.5 }}>
            <Typography component="span" variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {ROLE_LABEL[player.role]}
            </Typography>
            {isCaptain && <Chip size="small" variant="outlined" color="primary" label="Captain" />}
            {isKeeper && <Chip size="small" variant="outlined" color="primary" label="Wicketkeeper" />}
            {showAvailability && availability && <AvailabilityBadge availability={availability} />}
            {player.alsoIn && (
              <Chip size="small" variant="outlined" label={`Also in ${player.alsoIn}`} sx={toneSx('info')} />
            )}
          </Box>
        </Box>
      </Box>
    )
  }

  const menuIsTwelfth = menuPlayer?.playerProfileId === twelfthManPlayerId
  const menuIsPositioned = Boolean(menuPlayer) && !menuIsTwelfth && menuPlayer?.battingOrder != null
  const menuIndex = menuPlayer ? positionedIds.indexOf(menuPlayer.playerProfileId) : -1
  const spinnerDisabled = Boolean(menuPlayer) && !menuIsPositioned && placesFull
  const spinnerMax = Math.max(1, Math.min(limits.battingPlaces, positioned.length + (menuIsPositioned ? 0 : 1)))
  const fullReason = limits.twelfthManAllowed
    ? `All ${limits.battingPlaces} places are filled. Remove a player or make someone 12th man first.`
    : `All ${limits.battingPlaces} places are filled. Remove a player first.`

  return (
    <Card
      variant="outlined"
      sx={{ bgcolor: 'background.paper', boxShadow: 2, px: 1, py: 1, minWidth: 0 }}
      data-testid="team-selection-list"
    >
      {players.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
          No players selected yet.
        </Typography>
      ) : (
        <>
          <Box data-testid="batting-places" sx={{ mt: waiting.length > 0 ? 1 : 0 }}>
            {positioned.map((player, index) => renderRow(player, 'positioned', index))}
            {dragId !== null && !(placesFull && !positionedIds.includes(dragId)) && (
              // The drop zone at the very end of the numbered places (and the only target when the
              // batting order is still empty), visible while a drag is in progress.
              <Box
                data-testid="batting-end-drop"
                onDragOver={(event: DragEvent<HTMLElement>) => {
                  event.preventDefault()
                  setHoldingOver(false)
                  setDropIndex(positioned.length)
                }}
                onDrop={(event: DragEvent<HTMLElement>) => {
                  event.preventDefault()
                  event.stopPropagation()
                  dropAt(positioned.length)
                }}
                sx={{
                  mt: 0.5,
                  minHeight: 44,
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px dashed',
                  borderColor: dropIndex === positioned.length ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  fontSize: 12,
                  color: 'text.secondary',
                  bgcolor: dropIndex === positioned.length ? (theme: Theme) => alpha(theme.palette.primary.main, 0.08) : undefined,
                }}
              >
                {positioned.length === 0 ? 'Drop here to start the batting order' : 'Drop here to place last'}
              </Box>
            )}
          </Box>

          {showTwelfthRow && (
            <Box>
              <Box sx={SECTION_LABEL_SX}>12th man</Box>
              {twelfthMan ? (
                renderRow(twelfthMan, 'twelfth', 0)
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1, px: 0.5 }}>
                  None chosen. Open a player's menu and choose Make 12th man.
                </Typography>
              )}
            </Box>
          )}

          {waiting.length > 0 && (
            <Box
              data-testid="holding-area"
              onDragOver={(event: DragEvent<HTMLElement>) => {
                if (dragId && positionedIds.includes(dragId)) {
                  event.preventDefault()
                  setHoldingOver(true)
                  setDropIndex(null)
                }
              }}
              onDragLeave={() => setHoldingOver(false)}
              onDrop={(event: DragEvent<HTMLElement>) => {
                if (dragId && positionedIds.includes(dragId)) {
                  event.preventDefault()
                  dropIntoHolding()
                }
              }}
              sx={{
                borderRadius: 1,
                bgcolor: holdingOver ? (theme: Theme) => alpha(theme.palette.primary.main, 0.08) : undefined,
              }}
            >
              <Box sx={SECTION_LABEL_SX}>{`Not in the batting order yet (${waiting.length})`}</Box>
              {waiting.map((player, index) => renderRow(player, 'waiting', index))}
            </Box>
          )}
        </>
      )}

      <Menu
        anchorEl={menu?.anchor ?? null}
        open={Boolean(menu && menuPlayer)}
        onClose={closeMenu}
        slotProps={{ paper: { sx: { minWidth: 240, maxWidth: 'calc(100vw - 32px)' } } }}
      >
        {menuPlayer && !menuIsTwelfth && (
          <MenuItem
            onClick={() => {
              onSetCaptain(menuPlayer.playerProfileId === captainPlayerId ? null : menuPlayer.playerProfileId)
              closeMenu()
            }}
          >
            {menuPlayer.playerProfileId === captainPlayerId ? 'Remove as captain' : 'Make captain'}
          </MenuItem>
        )}
        {menuPlayer && !menuIsTwelfth && (
          <MenuItem
            role="menuitemcheckbox"
            aria-checked={menuPlayer.playerProfileId === wicketKeeperPlayerId}
            onClick={() => {
              onSetWicketKeeper(menuPlayer.playerProfileId === wicketKeeperPlayerId ? null : menuPlayer.playerProfileId)
              closeMenu()
            }}
            sx={{ justifyContent: 'space-between', gap: 2 }}
          >
            Wicketkeeper
            {menuPlayer.playerProfileId === wicketKeeperPlayerId && <CheckIcon fontSize="small" />}
          </MenuItem>
        )}
        {menuPlayer && (
          <MenuItem
            component="div"
            disableRipple
            onClick={(event) => event.stopPropagation()}
            sx={{ cursor: 'default', flexDirection: 'column', alignItems: 'stretch', gap: 0.5, '&:hover': { bgcolor: 'transparent' } }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
              <Typography variant="body2" component="label" htmlFor="batting-position-input">
                Batting position
              </Typography>
              <TextField
                id="batting-position-input"
                type="number"
                size="small"
                value={positionDraft}
                placeholder={menuIsPositioned ? String((menuPlayer.battingOrder as number) ?? '') : '–'}
                disabled={spinnerDisabled}
                onChange={(event) => setPositionDraft(event.target.value)}
                onKeyDown={(event) => {
                  event.stopPropagation()
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitPosition(menuPlayer, positionDraft)
                    closeMenu()
                  }
                }}
                onBlur={() => commitPosition(menuPlayer, positionDraft)}
                inputProps={{
                  min: 1,
                  max: spinnerMax,
                  step: 1,
                  'aria-label': `Batting position for ${menuPlayer.name}`,
                  'aria-describedby': spinnerDisabled ? 'batting-position-full' : undefined,
                }}
                sx={{ width: 84, flex: 'none' }}
              />
            </Box>
            {spinnerDisabled && (
              <Typography id="batting-position-full" variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal' }}>
                {fullReason}
              </Typography>
            )}
          </MenuItem>
        )}
        {menuPlayer && limits.twelfthManAllowed && !menuIsTwelfth && (
          <MenuItem
            onClick={() => {
              onMakeTwelfthMan(menuPlayer.playerProfileId)
              closeMenu()
            }}
          >
            Make 12th man
          </MenuItem>
        )}
        {menuPlayer && menuIsTwelfth && (
          <MenuItem
            disabled={placesFull}
            onClick={() => {
              onReorder([...positionedIds, menuPlayer.playerProfileId])
              closeMenu()
            }}
          >
            <Box>
              <Typography variant="body2">Move into the batting order</Typography>
              {placesFull && (
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'normal', display: 'block' }}>
                  {fullReason}
                </Typography>
              )}
            </Box>
          </MenuItem>
        )}
        {menuPlayer && (
          <MenuItem
            aria-haspopup="menu"
            onClick={(event) => setRoleAnchor(event.currentTarget)}
            sx={{ justifyContent: 'space-between', gap: 2 }}
          >
            {`Role: ${ROLE_LABEL[menuPlayer.role]}`}
            <ChevronRightIcon fontSize="small" />
          </MenuItem>
        )}
        {menuPlayer && menuIsPositioned && (
          <MenuItem disabled={menuIndex <= 0} onClick={() => { move(menuPlayer.playerProfileId, -1); closeMenu() }}>
            <KeyboardArrowUpIcon fontSize="small" sx={{ mr: 1 }} />
            Move up
          </MenuItem>
        )}
        {menuPlayer && menuIsPositioned && (
          <MenuItem
            disabled={menuIndex === positionedIds.length - 1}
            onClick={() => { move(menuPlayer.playerProfileId, 1); closeMenu() }}
          >
            <KeyboardArrowDownIcon fontSize="small" sx={{ mr: 1 }} />
            Move down
          </MenuItem>
        )}
        {menuPlayer && <Divider />}
        {menuPlayer && (
          <MenuItem
            onClick={() => {
              onRemove(menuPlayer.playerProfileId)
              closeMenu()
            }}
            sx={{ color: 'error.main' }}
          >
            Remove from team
          </MenuItem>
        )}
      </Menu>

      <Menu anchorEl={roleAnchor} open={Boolean(roleAnchor && menuPlayer)} onClose={() => setRoleAnchor(null)}>
        {ROLE_OPTIONS.map((role) => (
          <MenuItem
            key={role}
            selected={menuPlayer?.role === role}
            onClick={() => {
              if (menuPlayer) {
                onChangeRole(menuPlayer.playerProfileId, role)
              }
              closeMenu()
            }}
          >
            {ROLE_LABEL[role]}
          </MenuItem>
        ))}
      </Menu>
    </Card>
  )
}
