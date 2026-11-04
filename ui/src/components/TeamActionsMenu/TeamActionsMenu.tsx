import { useLocation } from 'react-router-dom'
import { ManageMenu } from '../ManageMenu'
import { currentOrigin, withReturnTo } from '../../utils/returnTo'
import { teamMenuItems } from '../../utils/teamMenuItems'

export interface TeamActionsMenuProps {
  teamName: string
  // 'kebab' (default): the dense row and card kebab. 'button': the Team page's filled "Manage Team" menu.
  trigger?: 'kebab' | 'button'
  // Where Open Team leads (without returnTo; added here). Omitted on the Team page.
  openTo?: string
  editTo: string
  statsTo: string
  originLabel?: string
}

// docs/specs/142 and page-anatomy section 6: the ONE actions menu of a team, a row/card kebab or the Team page's Manage Team button. Every
// destination returns to where the user is now (`returnTo`, docs/specs/127). It never navigates the row it sits in.
export function TeamActionsMenu({ teamName, trigger = 'kebab', openTo, editTo, statsTo, originLabel = 'Teams' }: TeamActionsMenuProps) {
  const location = useLocation()
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), originLabel)
  const items = teamMenuItems({ openTo: openTo ? leaveTo(openTo) : undefined, editTo: leaveTo(editTo), statsTo: leaveTo(statsTo) })
  const groups = [{ id: 'team', heading: 'Team', items }]
  return trigger === 'kebab' ? (
    <ManageMenu trigger="kebab" dense label={`Actions for ${teamName}`} testId="team-actions" groups={groups} />
  ) : (
    <ManageMenu label="Manage Team" fixedWidth testId="manage-team" groups={groups} />
  )
}
