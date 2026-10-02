import type { OpenAvailabilityPoll } from '../../../api/matchAvailabilityApi'
import type { SectionAvailabilityFixtureMatch } from '../../../api/sectionAvailabilityApi'
import type { Team } from '../../../api/teamApi'

export { canReopen } from '../../../utils/pollClose'

const DAY_IN_MS = 24 * 60 * 60 * 1000

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

export function formatCloseTime(date: Date): string {
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

// docs/specs/064: the value of the 'Closes' row both card kinds show - the close date/time when
// autoclose is on and one was computed, 'Manually' otherwise (so the row reads 'Closes manually').
export function closesValue(autoClose: boolean, scheduledCloseAt: string | null): string {
  if (autoClose && scheduledCloseAt) {
    return formatCloseTime(new Date(scheduledCloseAt))
  }
  return 'Manually'
}

export function matchLabel(match: SectionAvailabilityFixtureMatch): string {
  return `${match.teamName} vs ${match.opponentLabel}`
}

// A match's own kickoff minus 24 hours - a display preview of what the backend computes and stores
// as scheduledCloseAt at creation time (docs/specs/063's Data Model Changes, 064 for squad polls).
export function closeTimeForMatch(matchDate: string): Date {
  return new Date(new Date(matchDate).getTime() - DAY_IN_MS)
}

// The earliest currently-ticked match's own kickoff minus 24 hours, recomputed client-side as
// matches are ticked/unticked - purely a display preview of what the backend will itself compute
// and store as scheduledCloseAt at creation time (docs/specs/063's Data Model Changes).
export function computeScheduledCloseAt(
  matches: SectionAvailabilityFixtureMatch[],
  selectedIds: Set<string>,
): Date | null {
  const selectedTimes = matches
    .filter((match) => selectedIds.has(match.matchId))
    .map((match) => new Date(match.matchDate).getTime())
  if (selectedTimes.length === 0) {
    return null
  }
  return closeTimeForMatch(new Date(Math.min(...selectedTimes)).toISOString())
}

// docs/specs/064: where the 'covered by' link of an already-polled match points - a squad poll
// lives on its match's own Availability tab, a group poll on the dashboard with 'Show closed
// polls' preset on (so it is listed whether the covering poll is open or closed).
export function coveredPollHref(match: SectionAvailabilityFixtureMatch): string {
  if (match.existingPollType === 'SQUAD') {
    return `/manage/fixtures/matches/${match.matchId}/edit?tab=availability`
  }
  return '/manage/availability?showClosed=true'
}

// Same "resolve whichever side is null against the club's own team list" join MatchList.tsx's
// sideName / MatchFormPage.tsx's sideDisplayName already use — not a new resolution helper.
export function sideDisplayName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return teamName ?? 'TBC'
}

export function squadPollTitle(poll: OpenAvailabilityPoll, teamsById: Map<string, Team>): string {
  const homeTeamName = sideDisplayName(poll.homeTeamId, poll.homeTeamName, teamsById)
  const awayTeamName = sideDisplayName(poll.awayTeamId, poll.awayTeamName, teamsById)
  return `${homeTeamName} vs ${awayTeamName}`
}
