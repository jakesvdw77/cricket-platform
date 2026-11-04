import { useLocation } from 'react-router-dom'
import { ManageMenu } from '../ManageMenu'
import { currentOrigin, withReturnTo } from '../../utils/returnTo'
import { playerMenuItems } from '../../utils/playerMenuItems'
import { playerStatusOf } from '../../utils/playerStatus'
import type { PlayerStatusAction } from '../../utils/playerStatus'
import type { Player } from '../../api/playerApi'

export interface PlayerActionsMenuProps {
  player: Player
  // 'kebab' (default): the dense row and card kebab. 'button': the Player page's filled "Manage Player" menu.
  trigger?: 'kebab' | 'button'
  // The label the destinations' Back shows ("Players" on the list; the page's own name elsewhere).
  originLabel?: string
  onStatusAction: (action: PlayerStatusAction) => void
}

// docs/specs/141 and page-anatomy section 6: the ONE actions menu of a player, as a row/card kebab or the Player page's Manage Player
// button. Every destination returns to where the user is now (`returnTo`, docs/specs/127). It never navigates the row it sits in.
export function PlayerActionsMenu({ player, trigger = 'kebab', originLabel = 'Players', onStatusAction }: PlayerActionsMenuProps) {
  const location = useLocation()
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), originLabel)
  const name = `${player.firstName} ${player.lastName}`
  const items = playerMenuItems({
    status: playerStatusOf(player),
    openTo: trigger === 'kebab' ? leaveTo(`/manage/players/${player.id}`) : undefined,
    editTo: leaveTo(`/manage/players/${player.id}/edit`),
    statsTo: leaveTo(`/manage/players/${player.id}/stats`),
    onStatusAction,
  })
  const groups = [{ id: 'player', heading: 'Player', items }]
  return trigger === 'kebab' ? (
    <ManageMenu trigger="kebab" dense label={`Actions for ${name}`} testId={`player-actions-${player.id}`} groups={groups} />
  ) : (
    <ManageMenu label="Manage Player" fixedWidth testId="manage-player" groups={groups} />
  )
}
