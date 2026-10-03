import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { SectionAvailabilityFixtureMatch } from '../../../api/sectionAvailabilityApi'
import type { Team } from '../../../api/teamApi'
import type { PollItem } from './pollItem'

// Why 'Share invite' is disabled on a closed poll (the backend refuses public answers for one).
export const SHARE_CLOSED_REASON = 'Share invite is unavailable: this poll is closed'

const HOUR_IN_MS = 60 * 60 * 1000
const DAY_IN_MS = 24 * HOUR_IN_MS

// Moved out of the deleted SectionAvailabilityRounds.tsx unchanged (docs/specs/064-unified-
// availability-polls.md) - shared by the group-poll fixture cards and the squad-poll branch.
export function formatDateRange(startDate: string, endDate: string): string {
  const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
  const startLabel = new Date(startDate).toLocaleDateString(undefined, options)
  if (startDate === endDate) {
    return startLabel
  }
  const endLabel = new Date(endDate).toLocaleDateString(undefined, options)
  return `${startLabel} - ${endLabel}`
}

export function formatMatchDateTime(matchDate: string): string {
  return new Date(matchDate).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// docs/specs/071-league-card-redesign.md: date only, e.g. "Sat 3 Oct 2026".
export function formatMatchDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatCloseTime(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function matchLabel(match: Pick<SectionAvailabilityFixtureMatch, 'teamName' | 'opponentLabel'>): string {
  return `${match.teamName} vs ${match.opponentLabel}`
}

// docs/specs/064, repointed by docs/specs/075: where the 'covered by' link of an already-polled
// match points - the covering poll's own Responses page (a group poll by its round id, which is what
// the backend returns as existingPollId for a GROUP match; a squad poll by match and poll id). With no
// existingPollId (the type allows it, alreadyPolled never produces it) it falls back to the dashboard
// with 'Show closed polls' preset on.
export function coveredPollHref(match: SectionAvailabilityFixtureMatch): string {
  if (!match.existingPollId) {
    return '/manage/availability?showClosed=true'
  }
  if (match.existingPollType === 'SQUAD') {
    return `/manage/availability/squad/${match.matchId}/${match.existingPollId}`
  }
  return `/manage/availability/group/${match.existingPollId}`
}

// Same "resolve whichever side is null against the club's own team list" join MatchList.tsx's
// sideName / MatchFormPage.tsx's sideDisplayName already use — not a new resolution helper.
export function sideDisplayName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return teamName ?? 'TBC'
}

export function squadPollTitle(poll: Pick<OpenAvailabilityPoll, 'homeTeamId' | 'homeTeamName' | 'awayTeamId' | 'awayTeamName'>, teamsById: Map<string, Team>): string {
  const homeTeamName = sideDisplayName(poll.homeTeamId, poll.homeTeamName, teamsById)
  const awayTeamName = sideDisplayName(poll.awayTeamId, poll.awayTeamName, teamsById)
  return `${homeTeamName} vs ${awayTeamName}`
}

// docs/specs/066: the close time the UI proposes - the kickoff minus 24 hours (the rule from 064),
// or minus 1 hour when that is already in the past (a match less than a day away).
export function defaultCloseTime(kickoff: string | Date, now: Date = new Date()): Date {
  const kickoffMs = new Date(kickoff).getTime()
  const dayBefore = kickoffMs - DAY_IN_MS
  return new Date(dayBefore > now.getTime() ? dayBefore : kickoffMs - HOUR_IN_MS)
}

// The server's exact 400 messages (docs/specs/066's close-time rules), mirrored so the form can
// show them inline before the request is sent.
export const CLOSE_TIME_REQUIRED_MESSAGE = 'A closing time is required when Autoclose is on.'
export const CLOSE_TIME_PAST_MESSAGE = 'Choose a closing time in the future.'
export const CLOSE_TIME_AFTER_KICKOFF_MESSAGE = 'Choose a closing time before the first match starts.'

// Mirrors the server rule: autoClose off needs no time; otherwise a time is required, after now and
// not after the earliest covered kickoff. Returns the message, or null when valid. `closeTime` is
// an ISO string, or null/'' when the field is empty/unparseable.
export function validateCloseTime(
  autoClose: boolean,
  closeTime: string | null,
  kickoff: string | null,
  now: Date = new Date(),
): string | null {
  if (!autoClose) {
    return null
  }
  if (!closeTime || Number.isNaN(new Date(closeTime).getTime())) {
    return CLOSE_TIME_REQUIRED_MESSAGE
  }
  const closeMs = new Date(closeTime).getTime()
  if (closeMs <= now.getTime()) {
    return CLOSE_TIME_PAST_MESSAGE
  }
  if (kickoff && closeMs > new Date(kickoff).getTime()) {
    return CLOSE_TIME_AFTER_KICKOFF_MESSAGE
  }
  return null
}

// docs/specs/073: the card's "Poll closes" line as label + value. Open: "Poll closes" with the
// formatted date and time, or "Manually" (Autoclose off). Closed: "Poll closed" with the date only
// (e.g. "Sat 3 Oct"), or "Manually".
export function closesRow(
  open: boolean,
  autoClose: boolean,
  scheduledCloseAt: string | null,
): { label: 'Poll closes' | 'Poll closed'; value: string } {
  const hasTime = autoClose && Boolean(scheduledCloseAt)
  if (open) {
    return { label: 'Poll closes', value: hasTime ? formatCloseTime(new Date(scheduledCloseAt as string)) : 'Manually' }
  }
  if (!hasTime) {
    return { label: 'Poll closed', value: 'Manually' }
  }
  const date = new Date(scheduledCloseAt as string).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  return { label: 'Poll closed', value: date }
}

// The text of the Responses page headers' Closes line: 'Closes <date time>' / 'Closes manually'
// while open, 'Closed <date>' / 'Closed manually' once closed.
export function closesRowText(open: boolean, autoClose: boolean, scheduledCloseAt: string | null): string {
  const { value } = closesRow(open, autoClose, scheduledCloseAt)
  const verb = open ? 'Closes' : 'Closed'
  return value === 'Manually' ? `${verb} manually` : `${verb} ${value}`
}

// docs/specs/073: where a poll's Responses page lives - the card's click-through and its Responses
// button. Group polls by round id, squad polls by match and poll id.
export function pollResponsesPath(item: PollItem): string {
  return item.kind === 'GROUP'
    ? `/manage/availability/group/${item.round.id}`
    : `/manage/availability/squad/${item.poll.matchId}/${item.poll.pollId}`
}

// docs/specs/064/066/067, repointed by docs/specs/075: the match's own view page (the Edit page's
// Availability tab no longer exists) - the destination of the Matches dialog's match link and the
// Responses page's Open match link.
export function squadPollHref(poll: Pick<OpenAvailabilityPoll, 'matchId'>): string {
  return `/manage/fixtures/matches/${poll.matchId}`
}

// The 'Home' / 'Away' badge of a squad poll.
export function squadPollSideLabel(poll: Pick<OpenAvailabilityPoll, 'teamId' | 'homeTeamId'>): 'Home' | 'Away' {
  return poll.teamId === poll.homeTeamId ? 'Home' : 'Away'
}

type SquadSides = Pick<OpenAvailabilityPoll, 'teamId' | 'homeTeamId' | 'homeTeamName' | 'awayTeamId' | 'awayTeamName'>

// docs/specs/067: the name of the side a squad poll is for (the share invite greets this team) and
// of the other side (the slot's opponent), shared by the card and the Responses page.
export function squadPollTeamName(poll: SquadSides, teamsById: Map<string, Team>): string {
  return poll.teamId === poll.homeTeamId
    ? sideDisplayName(poll.homeTeamId, poll.homeTeamName, teamsById)
    : sideDisplayName(poll.awayTeamId, poll.awayTeamName, teamsById)
}

export function squadPollOpponentName(poll: SquadSides, teamsById: Map<string, Team>): string {
  return poll.teamId === poll.homeTeamId
    ? sideDisplayName(poll.awayTeamId, poll.awayTeamName, teamsById)
    : sideDisplayName(poll.homeTeamId, poll.homeTeamName, teamsById)
}
