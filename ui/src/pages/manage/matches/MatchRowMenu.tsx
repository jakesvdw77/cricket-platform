import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import LiveTvOutlinedIcon from '@mui/icons-material/LiveTvOutlined'
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined'
import ScoreboardOutlinedIcon from '@mui/icons-material/ScoreboardOutlined'
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined'
import SportsScoreOutlinedIcon from '@mui/icons-material/SportsScoreOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import { useLocation } from 'react-router-dom'
import { ManageMenu } from '../../../components/ManageMenu'
import type { ManageMenuItem } from '../../../components/ManageMenu'
import type { Match } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'
import { selectTeamPath } from '../teamSelection/selectionLinks'
import { resultActionFor, resultImportActionFor } from './matchResultHelpers'
import { NO_CLUB_TEAM_REASON, ownSides, pollDestination, sideName } from './matchCardHelpers'
import type { PollDestination } from './matchCardHelpers'
import { useTeamSheetShare } from './useTeamSheetShare'

export interface MatchRowMenuProps {
  clubId: string
  match: Match
  teamsById: Map<string, Team>
  leaguesById: Map<string, League>
  seasonsById: Map<string, Season>
  testId?: string
}

export const MATCHES_PATH = '/manage/fixtures/matches'

// "View result" to "View Result": the menu labels are Title Case, the shared result helpers keep their sentence form.
export function titleCase(text: string): string {
  return text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
}

// The Open Availability item(s): one when the match has no poll or one poll, one per poll (named) when it has several. A menu
// cannot anchor a second menu, so the poll choice is flattened into items, each a link.
export function availabilityMenuItems(
  destination: PollDestination,
  leaveTo: (destination: string) => string,
  disabledReason: string | null,
  description?: string,
): ManageMenuItem[] {
  const icon = <EventAvailableOutlinedIcon fontSize="small" />
  const blocked = { disabled: Boolean(disabledReason), reason: disabledReason ?? undefined }
  if (destination.kind === 'link') {
    return [{ id: 'availability', title: 'Open Availability', description, icon, to: leaveTo(destination.to), ...blocked }]
  }
  return destination.options.map((option, index) => ({
    id: `availability-${index}`,
    title: `Open Availability: ${option.label}`,
    description,
    icon,
    to: leaveTo(option.to),
    ...blocked,
  }))
}

// docs/specs/130 and docs/standards/page-anatomy.md section 6: the ONE actions button of a match row or card, a dense kebab menu.
// Deactivate, Reactivate and Delete stay on the edit page (038, 109). Scoring and Watch Live open the match's own links in a new
// tab. Share Team Sheet is last. The button never navigates the row it sits in.
export function MatchRowMenu({ clubId, match, teamsById, leaguesById, seasonsById, testId = 'match-actions' }: MatchRowMenuProps) {
  const location = useLocation()
  const base = `${MATCHES_PATH}/${match.id}`
  const home = sideName(match.homeTeamId, match.homeTeamName, teamsById)
  const away = sideName(match.awayTeamId, match.awayTeamName, teamsById)
  // docs/specs/127: every destination returns to the list the menu is on.
  const leaveTo = (destination: string) => withReturnTo(destination, currentOrigin(location), 'Matches')
  const { openShare, shareDialog } = useTeamSheetShare({ clubId, match, teamsById, leaguesById, seasonsById })

  const hasOwnTeam = ownSides(match).length > 0
  const noTeamReason = hasOwnTeam ? null : NO_CLUB_TEAM_REASON
  const resultAction = resultActionFor(match)
  const importAction = resultImportActionFor(match)

  const items: ManageMenuItem[] = [
    { id: 'open', title: 'Open Match', icon: <OpenInNewOutlinedIcon fontSize="small" />, to: leaveTo(base) },
    { id: 'edit', title: 'Edit Match', icon: <EditOutlinedIcon fontSize="small" />, to: leaveTo(`${base}/edit`) },
    {
      id: 'select-team',
      title: 'Select Team',
      icon: <GroupsOutlinedIcon fontSize="small" />,
      to: hasOwnTeam ? leaveTo(selectTeamPath(match.id, null, Boolean(match.homeTeamId))) : undefined,
      disabled: !hasOwnTeam,
      reason: NO_CLUB_TEAM_REASON,
    },
    ...availabilityMenuItems(pollDestination(match, teamsById), leaveTo, noTeamReason),
    ...(resultAction ? [{ id: 'result', title: titleCase(resultAction.label), icon: <SportsScoreOutlinedIcon fontSize="small" />, to: leaveTo(resultAction.to) }] : []),
    ...(importAction ? [{ id: 'import-result', title: titleCase(importAction.label), icon: <UploadFileOutlinedIcon fontSize="small" />, to: leaveTo(importAction.to) }] : []),
    ...(match.scoringUrl
      ? [{ id: 'scoring', title: 'Scoring', icon: <ScoreboardOutlinedIcon fontSize="small" />, onClick: () => window.open(match.scoringUrl as string, '_blank', 'noopener,noreferrer') }]
      : []),
    ...(match.streamingUrl
      ? [{ id: 'watch-live', title: 'Watch Live', icon: <LiveTvOutlinedIcon fontSize="small" />, onClick: () => window.open(match.streamingUrl as string, '_blank', 'noopener,noreferrer') }]
      : []),
    {
      id: 'share-team-sheet',
      title: 'Share Team Sheet',
      icon: <ShareOutlinedIcon fontSize="small" />,
      onClick: openShare,
      disabled: !hasOwnTeam,
      reason: NO_CLUB_TEAM_REASON,
    },
  ]
  return (
    <>
      <ManageMenu
        trigger="kebab"
        dense
        label={`Actions for ${home} v ${away}`}
        testId={`${testId}-${match.id}`}
        groups={[{ id: 'actions', heading: 'Actions', items }]}
      />
      {shareDialog}
    </>
  )
}
