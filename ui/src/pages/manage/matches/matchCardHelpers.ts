import type { RecordCardBadge } from '../../../components/RecordCard'
import type { Match, MatchPoll } from '../../../api/matchApi'
import type { MatchAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { MatchSquad } from '../../../api/matchSquadApi'
import type { Team } from '../../../api/teamApi'
import type { League } from '../../../api/leagueApi'
import type { Season } from '../../../api/seasonApi'
import { groupPollResponsesPath, squadPollResponsesPath } from '../../../utils/pollRoutes'

// docs/specs/037-match-improvements.md item 2, shared by the card, the Match View page and the Edit
// page header (docs/specs/075-match-view-and-edit.md): why Select / Availability / Share are
// disabled for a match none of the club's teams plays in.
export const NO_CLUB_TEAM_REASON = 'None of your teams is playing in this match'

export interface OwnSide {
  side: 'home' | 'away'
  teamId: string
}

// docs/specs/075: the sides that are a club Team (their team id is set), home first. Used by the
// view and edit pages, which decide "own" from the ids because getMatch has no picked counts.
export function ownSides(match: Pick<Match, 'homeTeamId' | 'awayTeamId'>): OwnSide[] {
  const sides: OwnSide[] = []
  if (match.homeTeamId) sides.push({ side: 'home', teamId: match.homeTeamId })
  if (match.awayTeamId) sides.push({ side: 'away', teamId: match.awayTeamId })
  return sides
}

// docs/specs/075: the "League · Season" value shared by the card and the Match View page.
export function matchLeagueValue(
  match: Pick<Match, 'leagueId' | 'seasonId'>,
  leaguesById: Map<string, League>,
  seasonsById: Map<string, Season>,
): string {
  const league = match.leagueId ? leaguesById.get(match.leagueId)?.name : undefined
  const season = seasonsById.get(match.seasonId)?.label
  return [league, season].filter(Boolean).join(' · ')
}

// docs/specs/069/075: the legend under a selection progress bar, shared by SelectionBlock and the
// Match View team cards so they read identically.
export function pickedLegend(picked: number, playingXiSize: number): string {
  return picked >= playingXiSize ? 'squad complete' : `${picked} picked · ${playingXiSize - picked} to go`
}

// docs/specs/075: a match's polls rebuilt client-side (getMatch returns none), mirroring the
// backend's 069 rule. For each own team: a match squad with a windowId means the match is
// group-covered, contributing one GROUP poll (deduplicated by round: a group poll covers a match
// once); otherwise that team's squad poll from listPolls, if any, contributes a SQUAD poll.
export type MatchSquadCoverage = Pick<MatchSquad, 'windowId' | 'roundId' | 'windowOpen'>
export function matchPollsFrom(
  ownTeamIds: string[],
  squadPolls: Pick<MatchAvailabilityPoll, 'id' | 'teamId' | 'open'>[],
  squadsByTeamId: Map<string, MatchSquadCoverage | undefined>,
): MatchPoll[] {
  const polls: MatchPoll[] = []
  const seenRounds = new Set<string>()
  ownTeamIds.forEach((teamId) => {
    const squad = squadsByTeamId.get(teamId)
    if (squad?.windowId) {
      const roundId = squad.roundId ?? squad.windowId
      if (!seenRounds.has(roundId)) {
        seenRounds.add(roundId)
        polls.push({ type: 'GROUP', teamId: null, pollId: roundId, roundId, open: squad.windowOpen })
      }
      return
    }
    const squadPoll = squadPolls.find((candidate) => candidate.teamId === teamId)
    if (squadPoll) {
      polls.push({ type: 'SQUAD', teamId, pollId: squadPoll.id, roundId: null, open: squadPoll.open })
    }
  })
  return polls
}

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

// docs/specs/075: one side's badge (`prefix` is the 'Name: ' prefix or '').
export function announcedBadge(announced: boolean, prefix: string): RecordCardBadge {
  return announced
    ? { label: `${prefix}Announced`, tone: 'positive' }
    : { label: `${prefix}Not announced`, tone: 'neutral' }
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
    badges.push(announcedBadge(match.homeSideAnnounced, prefix))
  }

  if (match.awayTeamId) {
    const prefix = bothRealTeams ? `${sideName(match.awayTeamId, match.awayTeamName, teamsById)}: ` : ''
    badges.push(announcedBadge(match.awaySideAnnounced, prefix))
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

export type PollMenuOption = { label: string; to: string }
export type PollDestination = { kind: 'link'; to: string } | { kind: 'menu'; options: PollMenuOption[] }

function pollResponsesTo(match: Match, poll: MatchPoll): string {
  return poll.type === 'GROUP'
    ? groupPollResponsesPath(poll.roundId ?? poll.pollId)
    : squadPollResponsesPath(match.id, poll.pollId)
}

// Where the Availability button (card, Match View, Edit page header) goes (docs/specs/075 section 3):
// no poll -> the New poll flow prefilled for this match; one poll -> its Responses page; two or more
// (a derby with a poll per side, or one side group-covered and the other with a squad poll) -> a
// menu with one option per poll, each opening that poll's Responses page.
export function pollDestination(match: Match, teamsById: Map<string, Team>): PollDestination {
  const { polls } = match
  if (polls.length === 0) {
    const params = new URLSearchParams({ type: 'group' })
    const sectionId = clubSideSectionId(match, teamsById)
    if (sectionId) params.set('sectionId', sectionId)
    params.set('matchId', match.id)
    return { kind: 'link', to: `/manage/availability/new?${params.toString()}` }
  }
  if (polls.length === 1) {
    return { kind: 'link', to: pollResponsesTo(match, polls[0]) }
  }
  const squadTeamIds = new Set(polls.filter((poll) => poll.type === 'SQUAD').map((poll) => poll.teamId))
  const ownTeamIds = ownSides(match).map((own) => own.teamId)
  // A group poll covers the own sides that have no squad poll of their own.
  const groupNames = (() => {
    const uncovered = ownTeamIds.filter((teamId) => !squadTeamIds.has(teamId))
    const ids = uncovered.length > 0 ? uncovered : ownTeamIds
    return ids.map((teamId) => sideName(teamId, null, teamsById)).join(' / ')
  })()
  return {
    kind: 'menu',
    options: polls.map((poll) => {
      if (poll.type === 'GROUP') {
        return { label: `${groupNames} · Group poll`, to: pollResponsesTo(match, poll) }
      }
      const side = poll.teamId === match.homeTeamId ? 'Home' : 'Away'
      return {
        label: `${sideName(poll.teamId, null, teamsById)} · ${side} poll`,
        to: pollResponsesTo(match, poll),
      }
    }),
  }
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
