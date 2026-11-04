import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import IosShareOutlinedIcon from '@mui/icons-material/IosShareOutlined'
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import type { TeamSelectionSide } from '../../../api/teamSelectionApi'

export interface SideMenuOptions {
  side: Pick<TeamSelectionSide, 'status' | 'announced' | 'sideId'>
  // Where Select Players leads (the Select Team page of this side), or what it does on that page itself.
  selectTo?: string
  onSelectPlayers?: () => void
  selectDisabled?: boolean
  onAnnounce?: () => void
  announcing?: boolean
  // The Select Team page only: Un-announce Team once announced.
  onUnannounce?: () => void
  onShare?: () => void
  sharing?: boolean
  // The Select Team page only: Availability opens the availability menu.
  onAvailability?: () => void
  availabilityDisabled?: boolean
  // The Select Team page's own blocked reason, used instead of the generic one while Announce Team is disabled.
  announceBlockedReason?: string
  // Get Directions and Show Weather Forecast (each already hidden when there is nothing to show), listed before Share Team.
  locationItems?: ManageMenuItem[]
}

const NOT_READY_REASON: Record<string, string> = {
  NOT_STARTED: 'Pick the team first.',
  IN_PROGRESS: 'Pick the whole team first.',
}

// docs/specs/137: the ordered actions of one club side, built in ONE place for the Matches row and card, the Time Slots card and the Select Team
// page's Manage Team menu, so they cannot drift (like usePollActions). Select Players first, Availability (the page only), Announce
// Team or Un-announce Team, and Share Team always last (page-anatomy section 8).
export function sideMenuItems({ side, selectTo, onSelectPlayers, selectDisabled, onAnnounce, announcing, onUnannounce, onShare, sharing, onAvailability, availabilityDisabled, announceBlockedReason, locationItems }: SideMenuOptions): ManageMenuItem[] {
  const items: ManageMenuItem[] = [{ id: 'select-players', title: 'Select Players', description: 'Pick the players for this team.', icon: <GroupsOutlinedIcon fontSize="small" />, to: onSelectPlayers ? undefined : selectTo, onClick: onSelectPlayers, disabled: selectDisabled }]
  if (onAvailability) {
    items.push({ id: 'availability', title: 'Availability', description: "See and ask for this match's availability.", icon: <EventAvailableOutlinedIcon fontSize="small" />, onClick: onAvailability, disabled: availabilityDisabled })
  }
  if (side.announced) {
    if (onUnannounce) {
      items.push({ id: 'unannounce', title: 'Un-announce Team', description: 'Take the team back to selection.', icon: <UndoOutlinedIcon fontSize="small" />, onClick: onUnannounce })
    }
  } else if (onAnnounce || announceBlockedReason) {
    const ready = side.status === 'READY_TO_ANNOUNCE' && side.sideId !== null && !announceBlockedReason
    items.push({
      id: 'announce',
      title: 'Announce Team',
      description: 'Tell the players the team.',
      icon: <CampaignOutlinedIcon fontSize="small" />,
      onClick: onAnnounce,
      disabled: !ready || Boolean(announcing),
      reason: ready ? undefined : (announceBlockedReason ?? NOT_READY_REASON[side.status] ?? 'Pick the whole team first.'),
    })
  }
  if (locationItems?.length) items.push(...locationItems)
  if (onShare) {
    items.push({
      id: 'share',
      title: 'Share Team',
      description: 'Share the announced team sheet.',
      icon: <IosShareOutlinedIcon fontSize="small" />,
      onClick: onShare,
      disabled: !side.announced || Boolean(sharing),
      reason: side.announced ? undefined : 'Announce the team to share it.',
    })
  }
  return items
}
