import type { RecordCardBadge } from '../../../components/RecordCard'
import type { Match, MatchPoll } from '../../../api/matchApi'
import type { Team } from '../../../api/teamApi'

// docs/specs/037-match-improvements.md item 2: SquadPicker.tsx (029) already passes an `editTo`
// that itself ends in `?tab=playing-xi` — a naive `${editTo}?tab=playing-xi` would double up the
// query string (`?tab=playing-xi?tab=playing-xi`, which MatchFormPage's own `searchParams.get`
// read would then fail to match exactly). Skips entirely when already present, else appends with
// `&` when a (different) query string already exists.
export function withPlayingXiTab(url: string): string {
  if (url.includes('tab=playing-xi')) {
    return url
  }
  return `${url}${url.includes('?') ? '&' : '?'}tab=playing-xi`
}

// Exported (via MatchList) for MatchDetailPage.tsx (docs/specs/036-view-first-record-detail-screens.md)
// so the read-only view screen's title/badge match this card's exactly, rather than a second copy.
export function sideName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return teamName ?? 'TBC'
}

export function badgeFor(match: Match): RecordCardBadge | undefined {
  if (!match.active) {
    return { label: 'Inactive', tone: 'muted' }
  }
  return undefined
}

// docs/specs/040-announce-team.md: one badge per real-Team side (skipped entirely for a
// free-text opponent side, since there's nothing to announce), prefixed with that side's own
// resolved team name only when both sides are real Teams — unprefixed for the overwhelmingly
// common one-real-side case, since the card's own title already names both teams.
// docs/specs/069-match-card-redesign.md: the not-announced label is 'Not announced' (lowercase a).
export function announcedBadges(match: Match, teamsById: Map<string, Team>): RecordCardBadge[] {
  const badges: RecordCardBadge[] = []
  const bothRealTeams = Boolean(match.homeTeamId) && Boolean(match.awayTeamId)

  if (match.homeTeamId) {
    const prefix = bothRealTeams ? `${sideName(match.homeTeamId, match.homeTeamName, teamsById)}: ` : ''
    badges.push(
      match.homeSideAnnounced
        ? { label: `${prefix}Announced`, tone: 'positive' }
        : { label: `${prefix}Not announced`, tone: 'neutral' },
    )
  }

  if (match.awayTeamId) {
    const prefix = bothRealTeams ? `${sideName(match.awayTeamId, match.awayTeamName, teamsById)}: ` : ''
    badges.push(
      match.awaySideAnnounced
        ? { label: `${prefix}Announced`, tone: 'positive' }
        : { label: `${prefix}Not announced`, tone: 'neutral' },
    )
  }

  return badges
}

// docs/specs/069: any open poll -> 'Poll open'; polls but none open -> 'Poll closed'; none -> 'No poll'.
export function pollBadgeFor(polls: MatchPoll[]): RecordCardBadge {
  if (polls.some((poll) => poll.open)) {
    return { label: 'Poll open', tone: 'open' }
  }
  if (polls.length > 0) {
    return { label: 'Poll closed', tone: 'closed' }
  }
  return { label: 'No poll', tone: 'noPoll' }
}

// The section of the home club side's team, else the away one's; undefined when neither is known.
export function clubSideSectionId(match: Match, teamsById: Map<string, Team>): string | undefined {
  const home = match.homeTeamId ? teamsById.get(match.homeTeamId)?.sectionId : undefined
  if (home) return home
  return match.awayTeamId ? teamsById.get(match.awayTeamId)?.sectionId : undefined
}

// Where the card's Poll button goes: no poll -> the New poll flow prefilled for this match; one
// poll -> its Responses page; two (a derby with a poll per side) -> the match's Availability tab.
// `editTo` is the match edit route (it may already carry a query string, e.g. SquadPicker's).
export function pollDestination(match: Match, teamsById: Map<string, Team>, editTo: string): string {
  const { polls } = match
  if (polls.length === 0) {
    const params = new URLSearchParams({ type: 'group' })
    const sectionId = clubSideSectionId(match, teamsById)
    if (sectionId) params.set('sectionId', sectionId)
    params.set('matchId', match.id)
    return `/manage/availability/new?${params.toString()}`
  }
  if (polls.length === 1) {
    const [poll] = polls
    return poll.type === 'GROUP'
      ? `/manage/availability/group/${poll.roundId ?? poll.pollId}`
      : `/manage/availability/squad/${match.id}/${poll.pollId}`
  }
  return `${editTo.split('?')[0]}?tab=availability`
}

export interface SelectionRow {
  teamName: string
  picked: number
  playingXiSize: number | null
}

// One row per CLUB team side: a side with a real team id whose picked count is not null (the
// backend reports null for a free-text or other-club side). Home first, then away.
export function selectionRows(match: Match, teamsById: Map<string, Team>): SelectionRow[] {
  const rows: SelectionRow[] = []
  if (match.homeTeamId && match.homePickedCount !== null) {
    rows.push({
      teamName: sideName(match.homeTeamId, match.homeTeamName, teamsById),
      picked: match.homePickedCount,
      playingXiSize: match.playingXiSize,
    })
  }
  if (match.awayTeamId && match.awayPickedCount !== null) {
    rows.push({
      teamName: sideName(match.awayTeamId, match.awayTeamName, teamsById),
      picked: match.awayPickedCount,
      playingXiSize: match.playingXiSize,
    })
  }
  return rows
}
