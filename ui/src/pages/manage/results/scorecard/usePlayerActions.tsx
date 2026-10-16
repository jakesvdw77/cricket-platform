import { useState } from 'react'
import type { ReactNode } from 'react'
import { Divider, ListItemIcon, MenuItem } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LinkIcon from '@mui/icons-material/Link'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import type { ResultSide, Scorecard } from '../../../../api/matchResultApi'
import { ConfirmDialog } from '../../../../components/ConfirmDialog'
import { PlayerRowMenu } from '../../../../components/PlayerRowMenu'
import { PlayerSlotPicker } from '../../../../components/PlayerSlotPicker'
import type { PickedPlayer } from '../../../../components/PlayerSlotPicker'
import { usePlayerLabeler } from '../../../../hooks/usePlayerLabeler'
import { scorecardPersonName } from '../../../../utils/playerDisplayName'
import type { PersonName } from '../../../../utils/playerDisplayName'
import { playerRowKey } from '../../../../utils/scorecardPrefill'
import { useTeamSectionId } from '../../../../hooks/useTeamSectionId'
import { linkGuest, swapPlayer } from '../scorecardDraft'
import type { PlayerIdentity } from '../scorecardDraft'

// What the name popup offers for taking a player off the list: remove them, set them to Did not bat (they came from the
// selection or have other figures, so they must stay in the match squad), or explain why they cannot be removed yet.
export type RemoveKind = { kind: 'remove' } | { kind: 'dnb' } | { kind: 'blocked'; message: string }

export interface PlayerActionsOptions {
  clubId: string
  seasonId: string
  // The match's league (with seasonId): its age limits and the server's age reference date (docs/specs/110) guide the date of birth of a player created from Link to player.
  leagueId?: string | null
  // The side whose list the menu works on; `teamId` is null for the opposition (no squad, no Swap or Link).
  ours: { side: ResultSide; teamId: string | null }
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
  onAdd?: (identity: PlayerIdentity) => void
  // The match squad scope of the picker (see matchSquadFor).
  matchSquad?: PickedPlayer[]
  // Which items the name popup shows beyond the reorder controls (Our bowling keeps only Remove).
  menuSwap?: boolean
  menuLink?: boolean
  removeKind?: (key: string) => RemoveKind
  // Extra items for the name popup (Mark as 12th man...), above Swap player.
  extraItems?: (key: string, close: () => void) => ReactNode[]
  // The row cannot move (the 12th man is not in the numbered list).
  movable?: (key: string) => boolean
  positionDisabledReason?: (key: string) => string | null
  onSetDidNotBat?: (key: string) => void
  // Add player from the side's defined list only (Our bowling and fielding): no Team squad / Club / Guest scopes.
  addFromList?: {
    players: Array<{ key: string; firstName: string; lastName: string }>
    hints: Record<string, string>
    onPick: (key: string) => void
    onNotListed: () => void
  }
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
  const linkSectionId = useTeamSectionId(clubId, ours.teamId, picker?.mode === 'link')
  const [removeKey, setRemoveKey] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)

  const player = (key: string | null) => (key ? scorecard.players.find((candidate) => playerRowKey(candidate) === key) : undefined)
  const nameOf = (key: string | null): string => {
    const found = player(key)
    return found ? label(scorecardPersonName(found)) : ''
  }

  const menuPlayer = player(menu?.key ?? null)
  const removal: RemoveKind = menu && options.removeKind ? options.removeKind(menu.key) : { kind: 'remove' }
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
        positionDisabledReason={menu && options.positionDisabledReason ? options.positionDisabledReason(menu.key) : null}
        movable={menu && options.movable ? options.movable(menu.key) : undefined}
        after={
          menu && menuPlayer
            ? [
                <Divider key="divider" />,
                ...(options.extraItems?.(menu.key, closeMenu) ?? []),
                ...(options.menuSwap === false
                  ? []
                  : [
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
                    ]),
                ...(menuPlayer.playerProfileId || options.menuLink === false
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
                removal.kind === 'dnb' ? (
                  <MenuItem
                    key="dnb"
                    disabled={options.disabled}
                    onClick={() => {
                      options.onSetDidNotBat?.(menu.key)
                      closeMenu()
                    }}
                  >
                    <ListItemIcon>
                      <DeleteOutlineIcon fontSize="small" />
                    </ListItemIcon>
                    Set to Did not bat
                  </MenuItem>
                ) : (
                  <MenuItem
                    key="remove"
                    disabled={options.disabled}
                    onClick={() => {
                      if (removal.kind === 'blocked') setBlocked(removal.message)
                      else setRemoveKey(menu.key)
                      closeMenu()
                    }}
                    sx={{ color: 'error.main' }}
                  >
                    <ListItemIcon sx={{ color: 'inherit' }}>
                      <DeleteOutlineIcon fontSize="small" />
                    </ListItemIcon>
                    {options.removeLabel}
                  </MenuItem>
                ),
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
        hints={picker?.mode === 'add' && options.addFromList ? options.addFromList.hints : hints}
        allowGuest={picker?.mode !== 'link'}
        newPlayer={picker?.mode === 'link' && player(pickerKey)?.displayName ? { name: player(pickerKey)?.displayName as string, sectionId: linkSectionId, leagueId: options.leagueId, seasonId } : undefined}
        matchSquad={options.matchSquad}
        note={picker?.mode === 'swap' ? 'Swap player: the selected player did not play and this person played instead; all their figures move to them. If a player was replaced during the match, keep both and use Add player.' : undefined}
        matchOnly={picker?.mode === 'add' && Boolean(options.addFromList)}
        matchPlayers={options.addFromList?.players}
        onPickMatchPlayer={(key) => {
          options.addFromList?.onPick(key)
          closePicker()
        }}
        onNotListed={options.addFromList?.onNotListed}
        onPickPlayer={(picked) => {
          const identity = identityOfPicked(picked)
          if (picker?.mode === 'swap') onScorecard(swapPlayer(scorecard, pickerKey, identity))
          else if (picker?.mode === 'link') onScorecard(linkGuest(scorecard, pickerKey, identity))
          else options.onAdd?.(identity)
          closePicker()
        }}
        onPickGuest={(displayName) => {
          const identity: PlayerIdentity = { playerProfileId: null, displayName }
          if (picker?.mode === 'swap') onScorecard(swapPlayer(scorecard, pickerKey, identity))
          else options.onAdd?.(identity)
          closePicker()
        }}
      />

      <ConfirmDialog
        open={blocked !== null}
        title="Can't remove yet"
        description={blocked ?? ''}
        acknowledgeOnly
        confirmLabel="OK"
        onClose={() => setBlocked(null)}
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
