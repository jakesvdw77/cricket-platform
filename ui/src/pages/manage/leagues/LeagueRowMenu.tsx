import AddOutlinedIcon from '@mui/icons-material/AddOutlined'
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import EventOutlinedIcon from '@mui/icons-material/EventOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { useLocation } from 'react-router-dom'
import { ManageMenu } from '../../../components/ManageMenu'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import type { League } from '../../../api/leagueApi'
import { importScheduleDisabledReason, leagueAddMatchPath, leagueScheduleImportPath } from '../../../utils/leagueScheduleImport'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'

export interface LeagueRowMenuProps {
  league: League
  // The chosen season, carried into the destinations. Empty/absent: Add Match and Import Schedule are disabled ("Create a season first").
  seasonId?: string
  // The page owns both dialogs; an absent handler leaves its item out.
  onShare?: (league: League) => void
  onDuplicate?: (league: League) => void
  testId?: string
}

// docs/standards/page-anatomy.md section 6: the ONE actions button of a league row or card, a dense kebab menu. Same items and
// reasons as the league page's Manage League panel; the button never navigates the row it sits in.
export function LeagueRowMenu({ league, seasonId, onShare, onDuplicate, testId = 'league-actions' }: LeagueRowMenuProps) {
  const location = useLocation()
  const base = `/manage/fixtures/leagues/${league.id}`
  const search = seasonId ? `?seasonId=${seasonId}` : ''
  // docs/specs/127: every destination returns to the list the menu is on.
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), 'Leagues')
  const importReason = importScheduleDisabledReason({ hasSeason: Boolean(seasonId), leagueActive: league.active })
  const items: ManageMenuItem[] = [
    { id: 'open', title: 'Open League', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: leaveTo(`${base}/schedule${search}`) },
    { id: 'open-schedule', title: 'Open Schedule', icon: <EventOutlinedIcon fontSize="small" />, to: leaveTo(`${base}/schedule${search}`) },
    { id: 'open-teams', title: 'Open Teams', icon: <GroupsOutlinedIcon fontSize="small" />, to: leaveTo(`${base}/teams${search}`) },
    { id: 'open-conditions', title: 'Open Playing Conditions', icon: <DescriptionOutlinedIcon fontSize="small" />, to: leaveTo(`${base}/conditions${search}`) },
    { id: 'edit', title: 'Edit League Details', icon: <EditOutlinedIcon fontSize="small" />, to: leaveTo(`${base}/edit${search}`) },
    {
      id: 'add-match',
      title: 'Add Match',
      icon: <AddOutlinedIcon fontSize="small" />,
      to: seasonId ? leaveTo(leagueAddMatchPath(league.id, seasonId)) : undefined,
      disabled: !seasonId,
      reason: 'Create a season first',
    },
    {
      id: 'import-schedule',
      title: 'Import Schedule',
      icon: <UploadFileOutlinedIcon fontSize="small" />,
      to: seasonId ? leaveTo(leagueScheduleImportPath(league.id, seasonId, 'view')) : undefined,
      disabled: Boolean(importReason),
      reason: importReason ?? undefined,
    },
    ...(onShare ? [{ id: 'share', title: 'Share League', icon: <ShareOutlinedIcon fontSize="small" />, onClick: () => onShare(league) }] : []),
    ...(onDuplicate ? [{ id: 'duplicate', title: 'Duplicate League', icon: <ContentCopyOutlinedIcon fontSize="small" />, onClick: () => onDuplicate(league) }] : []),
  ]
  return (
    <ManageMenu
      trigger="kebab"
      dense
      label={`Actions for ${league.name}`}
      testId={`${testId}-${league.id}`}
      groups={[{ id: 'actions', heading: 'Actions', items }]}
    />
  )
}
