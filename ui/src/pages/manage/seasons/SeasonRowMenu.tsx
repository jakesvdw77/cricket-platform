import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import { useLocation } from 'react-router-dom'
import { ManageMenu } from '../../../components/ManageMenu'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import type { Season } from '../../../api/seasonApi'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'

export interface SeasonRowMenuProps {
  season: Pick<Season, 'id' | 'label'>
  testId?: string
}

const SEASONS_PATH = '/manage/fixtures/seasons'

// docs/specs/129 and docs/standards/page-anatomy.md section 6: the ONE actions button of a season row or card, a dense kebab menu.
// Deactivate and Reactivate stay on the edit page (038). Leagues and Matches open their unfiltered lists. The button never
// navigates the row it sits in.
export function SeasonRowMenu({ season, testId = 'season-actions' }: SeasonRowMenuProps) {
  const location = useLocation()
  const base = `${SEASONS_PATH}/${season.id}`
  // docs/specs/127: every destination returns to the list the menu is on.
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), 'Seasons')
  const items: ManageMenuItem[] = [
    { id: 'open', title: 'Open Season', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: leaveTo(base) },
    { id: 'edit', title: 'Edit Season', icon: <EditOutlinedIcon fontSize="small" />, to: leaveTo(`${base}/edit`) },
    { id: 'open-leagues', title: 'Open Leagues', icon: <EmojiEventsOutlinedIcon fontSize="small" />, to: leaveTo('/manage/fixtures/leagues') },
    { id: 'open-matches', title: 'Open Matches', icon: <EventOutlinedIcon fontSize="small" />, to: leaveTo('/manage/fixtures/matches') },
  ]
  return (
    <ManageMenu
      trigger="kebab"
      dense
      label={`Actions for ${season.label}`}
      testId={`${testId}-${season.id}`}
      groups={[{ id: 'actions', heading: 'Actions', items }]}
    />
  )
}
