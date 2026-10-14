import { useState } from 'react'
import type { ReactNode } from 'react'
import { Divider, ListItemIcon, MenuItem } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LinkIcon from '@mui/icons-material/Link'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import type { Scorecard } from '../../../../api/matchResultApi'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { PlayerRowMenu } from '../../../../components/PlayerRowMenu'
import { PlayerSlotPicker } from '../../../../components/PlayerSlotPicker'
import type { PickedPlayer } from '../../../../components/PlayerSlotPicker'
import { usePlayerLabeler } from '../../../../hooks/usePlayerLabeler'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { playerRowKey } from '../../../../utils/scorecardPrefill'
import { linkGuest, swapPlayer } from '../scorecardDraft'
import type { PlayerIdentity } from '../scorecardDraft'
import type { OurSide } from '../steps/stepTypes'

export interface PlayerActionsOptions {
  clubId: string
  seasonId: string
  ours: OurSide
  scorecard: Scorecard
  onScorecard: (next: Scorecard) => void
  // The listed rows' player keys in their current order (the reorder menu works on these).
  ids: string[]
  positionLabel: string
  // Everyone shown together in the view (for first-name tags in the menu and the dialogs).
  view: PersonName[]
  // Squad hints shown under a player in the picker ("12th man").
  hints?: Record<string, string>
  onReorder: (ids: string[]) => void
  // Remove: the row's confirm text and what it does.
  removeLabel: string
  removeDescription: (name: string) => string
  onRemove: (key: string) => void
  // Add player: which players and guests cannot be chosen again here, and what choosing one does.
  addTitle?: string
  addTakenPlayers?: Record<string, string>
  addTakenGuests?: string[]
  onAdd: (identity: PlayerIdentity) => void
  disabled?: boolean
}

const identityOfPicked = (player: PickedPlayer): PlayerIdentity => ({
  playerProfileId: player.playerProfileId,
  firstName: player.firstName,
  lastName: player.lastName,
})

// docs/specs/101-match-results-our-side-scorecard.md (Our batting item 6, PlayerSlotPicker): everything behind a scorecard
// row's name and the Add player button, shared by Our batting and Our bowling and fielding: the name popup (Move up, Move
// down, position field, Swap player..., Link to a registered player... on a guest, Remove), the picker for swapping,
// linking and adding, and the Remove confirm. Returns `openMenu` (the name button), `openAdd` (the Add player button) and
// `host`, which the step renders once.
export function usePlayerActions(options: PlayerActionsOptions) {
  const { clubId, seasonId, ours, scorecard, onScorecard, ids, positionLabel, view, hints = {}, onReorder } = options
  const label = usePlayerLabeler(view)
  const [menu, setMenu] = useState<{ key: string; anchor: HTMLElement } | null>(null)
  const [picker, setPicker] = useState<{ mode: 'swap' | 'link' | 'add'; key: string } | null>(null)
  const [removeKey, setRemoveKey] = useState<string | null>(null)

  const player = (key: string | null) => (key ? scorecard.players.find((candidate) => playerRowKey(candidate) === key) : undefined)
  const nameOf = (key: string | null): string => {
    const found = player(key)
    return found ? label(scorecardPersonName(found)) : ''
  }

  const menuPlayer = player(menu?.key ?? null)
  const closeMenu = () => setMenu(null)

  // Swapping needs a person who is not already a (non-substitute) player of the side; the 12th man may step in.
  const sidePlayers = scorecard.players.filter((candidate) => candidate.side === ours.side)
  const swapTaken: Record<string, string> = {}
  const swapTakenGuests: string[] = []
  for (const candidate of sidePlayers) {
    if (playerRowKey(candidate) === picker?.key || candidate.substitute) continue
    if (candidate.playerProfileId) swapTaken[candidate.playerProfileId] = 'Already on this side'
    else if (candidate.displayName) swapTakenGuests.push(candidate.displayName)
  }

  const closePicker = () => setPicker(null)
  const pickerKey = picker?.key ?? ''

  const host: ReactNode = (
    <>
      <PlayerRowMenu
        anchor={menu?.anchor ?? null}
        onClose={closeMenu}
        playerId={menu?.key ?? ''}
        playerName={nameOf(menu?.key ?? null)}
        ids={ids}
        onReorder={onReorder}
        positionLabel={positionLabel}
        after={
          menu && menuPlayer
            ? [
                <Divider key="divider" />,
                <MenuItem
                  key="swap"
                  disabled={options.disabled}
                  onClick={() => {
                    setPicker({ mode: 'swap', key: menu.key })
                    closeMenu()
                  }}
                >
                  <ListItemIcon>
                    <SwapHorizIcon fontSize="small" />
                  </ListItemIcon>
                  Swap player...
                </MenuItem>,
                ...(menuPlayer.playerProfileId
                  ? []
                  : [
                      <MenuItem
                        key="link"
                        disabled={options.disabled}
                        onClick={() => {
                          setPicker({ mode: 'link', key: menu.key })
                          closeMenu()
                        }}
                      >
                        <ListItemIcon>
                          <LinkIcon fontSize="small" />
                        </ListItemIcon>
                        Link to a registered player...
                      </MenuItem>,
                    ]),
                <MenuItem
                  key="remove"
                  disabled={options.disabled}
                  onClick={() => {
                    setRemoveKey(menu.key)
                    closeMenu()
                  }}
                  sx={{ color: 'error.main' }}
                >
                  <ListItemIcon sx={{ color: 'inherit' }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </ListItemIcon>
                  {options.removeLabel}
                </MenuItem>,
              ]
            : []
        }
      />

      <PlayerSlotPicker
        open={picker !== null}
        onClose={closePicker}
        clubId={clubId}
        teamId={ours.teamId}
        seasonId={seasonId}
        title={picker?.mode === 'swap' ? `Swap ${nameOf(pickerKey)}` : picker?.mode === 'link' ? 'Link to a registered player' : (options.addTitle ?? 'Add player')}
        takenPlayers={picker?.mode === 'add' ? (options.addTakenPlayers ?? {}) : swapTaken}
        takenGuests={picker?.mode === 'add' ? (options.addTakenGuests ?? []) : swapTakenGuests}
        hints={hints}
        allowGuest={picker?.mode !== 'link'}
        onPickPlayer={(picked) => {
          const identity = identityOfPicked(picked)
          if (picker?.mode === 'swap') onScorecard(swapPlayer(scorecard, pickerKey, identity))
          else if (picker?.mode === 'link') onScorecard(linkGuest(scorecard, pickerKey, identity))
          else options.onAdd(identity)
          closePicker()
        }}
        onPickGuest={(displayName) => {
          const identity: PlayerIdentity = { playerProfileId: null, displayName }
          if (picker?.mode === 'swap') onScorecard(swapPlayer(scorecard, pickerKey, identity))
          else options.onAdd(identity)
          closePicker()
        }}
      />

      <ConfirmDialog
        open={removeKey !== null}
        title={options.removeLabel}
        description={options.removeDescription(nameOf(removeKey))}
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (removeKey) options.onRemove(removeKey)
          setRemoveKey(null)
        }}
        onClose={() => setRemoveKey(null)}
      />
    </>
  )

  return {
    openMenu: (key: string, anchor: HTMLElement) => setMenu({ key, anchor }),
    openSwap: (key: string) => setPicker({ mode: 'swap', key }),
    openAdd: () => setPicker({ mode: 'add', key: '' }),
    host,
  }
}
