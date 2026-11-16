import { useLocation } from 'react-router-dom'
import { currentOrigin, withReturnTo } from '../../../utils/returnTo'

// docs/specs/093-team-selection-hub.md: where "Select players", "Select team" and a row of the Matches view lead - the
// Select team page of one side of a match. A side that does not exist yet has no id, so the path carries the
// placeholder "home" or "away"; the page resolves it (and creates the side on first use, as the Edit Match tabs did).
export const SIDE_PLACEHOLDERS = ['home', 'away'] as const

export function selectTeamPath(matchId: string, sideId?: string | null, home = true): string {
  return `/manage/team-selection/matches/${matchId}/sides/${sideId ?? (home ? 'home' : 'away')}`
}

// The hub tab a link starts from, named for the Back link of the page it opens, which reads "Back to Batting Order".
const TAB_LABELS: Record<string, string> = { matches: 'Matches', slots: 'Time Slots', players: 'Players', batting: 'Batting Order' }

// selectTeamPath carrying where the manager came from (the tab and its filters), so the Select team page's Back returns to
// that tab and not always to the hub's first one (docs/standards/page-anatomy.md, "Back must come back to the same view").
export function useSelectTeamPath(): (matchId: string, sideId?: string | null, home?: boolean) => string {
  const location = useLocation()
  const tab = location.pathname.split('/').filter(Boolean).pop() ?? ''
  return (matchId, sideId, home = true) =>
    withReturnTo(selectTeamPath(matchId, sideId, home), currentOrigin(location), TAB_LABELS[tab] ?? 'Team Selection')
}
