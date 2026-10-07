import type { MatchAvailabilityPoll, MatchAvailabilityPollResponses } from '../../../../api/matchAvailabilityApi'
import type { Match } from '../../../../api/matchApi'
import type { SectionAvailabilityRoundBracket, SectionAvailabilityRoundMatch } from '../../../../api/sectionAvailabilityApi'
import type { Team } from '../../../../api/teamApi'
import { dayPartForDate } from '../../../../utils/dayPart'
import { squadPollOpponentName, squadPollTeamName } from '../pollHelpers'
import type { ResponseRow } from './responseHelpers'

export interface SquadResponsesModel {
  brackets: SectionAvailabilityRoundBracket[]
  rows: ResponseRow[]
  matches: SectionAvailabilityRoundMatch[]
}

// docs/specs/067: a squad poll is a poll with exactly one time slot, so it is fed to the shared
// Responses views as ONE synthetic bracket (windowId = the poll id) and ONE synthetic match, which
// lets the views and helpers stay unchanged. Morning/Afternoon uses the browser's local time, the
// same rule as the poll card's squad slot.
export function toSquadResponsesModel({
  responses,
  poll,
  match,
  teamsById,
}: {
  responses: MatchAvailabilityPollResponses
  poll: Pick<MatchAvailabilityPoll, 'id' | 'teamId'>
  match: Match
  teamsById: Map<string, Team>
}): SquadResponsesModel {
  const windowId = poll.id
  const windowDate = match.matchDate
  const dayPart = dayPartForDate(new Date(match.matchDate))
  const sides = {
    teamId: poll.teamId,
    homeTeamId: match.homeTeamId,
    homeTeamName: match.homeTeamName,
    awayTeamId: match.awayTeamId,
    awayTeamName: match.awayTeamName,
  }

  return {
    brackets: [
      {
        windowId,
        windowDate,
        dayPart,
        availableCount: responses.availableCount,
        unavailableCount: responses.unavailableCount,
        unsureCount: responses.unsureCount,
        noResponseCount: responses.noResponseCount,
        coveredMatchCount: 1,
      },
    ],
    rows: responses.responses.map((row) => ({
      playerProfileId: row.playerProfileId,
      firstName: row.firstName,
      lastName: row.lastName,
      jerseyNumber: row.squadJerseyNumber,
      statuses: [{ windowId, dayPart, windowDate, status: row.status, viaLink: row.viaLink }],
    })),
    matches: [
      {
        matchId: match.id,
        teamId: poll.teamId,
        teamName: squadPollTeamName(sides, teamsById),
        opponentLabel: squadPollOpponentName(sides, teamsById),
        matchDate: match.matchDate,
        venue: match.venue,
        leagueName: null,
        dayPart,
        windowId,
      },
    ],
  }
}
