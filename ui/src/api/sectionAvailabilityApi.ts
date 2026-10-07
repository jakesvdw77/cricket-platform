import api from './axiosConfig'
import type { AvailabilityStatus } from './matchAvailabilityApi'

// docs/specs/063-section-availability-and-flexible-squads.md Part A (fixture-group-selection
// revision): a section-scoped availability ask, resolved as one shared public link per admin-
// selected set of real fixtures - a SectionAvailabilityRound - bundling however many bracket
// windows those selected matches actually resolve to (one to several, no longer a fixed
// Morning/Afternoon pair). A round is the only admin/public-facing resource; a bare window is
// never exposed directly, `MatchSquadServiceImpl` still resolves one internally (see the spec's
// Data Model Changes, Part A "Revision note").
export type DayPart = 'MORNING' | 'AFTERNOON'

// One bracket a round owns - `windowDate` is this specific bracket's own date, since a round
// spanning several days now owns several windows, each with its own date.
export interface SectionAvailabilityRoundBracket {
  dayPart: DayPart
  windowDate: string
  windowId: string
  availableCount: number
  unavailableCount: number
  unsureCount: number
  noResponseCount: number
  coveredMatchCount: number
}

export interface SectionAvailabilityRound {
  id: string
  sectionId: string
  sectionName: string
  // Editable free text, the round's title everywhere (admin list, public page, share-invite
  // text) - defaults to a generated label from the selected matches' own date range + section
  // name at creation time, never regenerated after.
  description: string
  firstMatchDate: string
  lastMatchDate: string
  // docs/specs/066: the ISO instant of the earliest covered match - the base of the default close
  // time and of the 'not after the first kickoff' rule.
  firstMatchKickoff: string
  autoClose: boolean
  scheduledCloseAt: string | null
  // docs/specs/082: whether a reopen is allowed right now (auto-close rule and the matches-in-the-past rule).
  canReopen: boolean
  open: boolean
  // However many windows this round actually owns, one to several - no longer a fixed pair.
  brackets: SectionAvailabilityRoundBracket[]
}

export interface CreateSectionAvailabilityRoundPayload {
  sectionId: string
  description: string
  matchIds: string[]
  autoClose: boolean
  // docs/specs/066: ISO instant; absent = the server default (earliest kickoff minus 24h).
  scheduledCloseAt?: string
}

// docs/specs/066: body of both PUT .../close-time endpoints. autoClose false stores no time.
export interface UpdateCloseTimePayload {
  autoClose: boolean
  scheduledCloseAt: string | null
}

// One player's status for one specific bracket a round owns - replaces the pre-fixture-group-
// selection fixed morningStatus/afternoonStatus pair, since a round can now own several windows
// sharing the same dayPart across different dates. status is null when that player hasn't
// responded to this bracket yet.
export interface SectionAvailabilityRoundStatus {
  windowId: string
  dayPart: DayPart
  windowDate: string
  status: AvailabilityStatus | null
  // True when this answer came through the public link (077); null/absent otherwise.
  viaLink?: boolean | null
}

// jerseyNumber is the player's standing PlayerProfile.jerseyNumber (031), not a per-squad number
// - a round has no squad/season concept.
export interface SectionAvailabilityRoundResponseRow {
  playerProfileId: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  statuses: SectionAvailabilityRoundStatus[]
}

export interface SectionAvailabilityRoundResponses {
  roundId: string
  sectionId: string
  sectionName: string
  description: string
  open: boolean
  brackets: SectionAvailabilityRoundBracket[]
  responses: SectionAvailabilityRoundResponseRow[]
  publicPath: string
}

export interface SectionAvailabilityRoundMatch {
  matchId: string
  teamId: string
  teamName: string
  opponentLabel: string
  matchDate: string
  venue: string | null
  leagueName: string | null
  dayPart: DayPart
  windowId: string
}

// One candidate match row within a proposed SectionAvailabilityFixtureGroup  - 
// alreadyPolled/existingPoll* are only populated when the match is already covered by a poll of
// either kind (docs/specs/064-unified-availability-polls.md), so the UI can render it disabled with
// a link to the poll that covers it. existingPollId is the squad poll id (SQUAD) or the group
// round id (GROUP); existingPollLabel is the group description, or 'Team v Opponent' for a squad
// poll.
export interface SectionAvailabilityFixtureMatch {
  matchId: string
  teamId: string
  teamName: string
  opponentLabel: string
  matchDate: string
  dayPart: DayPart
  leagueName: string | null
  alreadyPolled: boolean
  existingPollType: 'SQUAD' | 'GROUP' | null
  existingPollId: string | null
  existingPollLabel: string | null
}

// One proposed group per SectionAvailabilityFixtureGroupResolver's own distinct-calendar-date-
// adjacency clustering (a weekend groups, a two-day-gap date starts its own group).
// suggestedDescription pre-fills CreateSectionAvailabilityRoundPayload.description before the
// admin edits it.
export interface SectionAvailabilityFixtureGroup {
  suggestedDescription: string
  startDate: string
  endDate: string
  matches: SectionAvailabilityFixtureMatch[]
}

function roundsPath(clubId: string): string {
  return `/manage/clubs/${clubId}/section-availability-rounds`
}

function fixtureGroupsPath(clubId: string, sectionId: string): string {
  return `/manage/clubs/${clubId}/sections/${sectionId}/section-availability-fixture-groups`
}

export interface ListRoundsParams {
  sectionId?: string
  open?: boolean
  // docs/specs/083: the shared League and Team filters, validated server-side.
  leagueId?: string
  teamId?: string
}

// Plain array response, not Page<T> - a club's section availability rounds are a small, bounded,
// unpaginated list, matching MatchAvailabilityPoll/Section's own posture.
export async function listRounds(clubId: string, params: ListRoundsParams = {}): Promise<SectionAvailabilityRound[]> {
  const { data } = await api.get<SectionAvailabilityRound[]>(roundsPath(clubId), {
    params: {
      ...(params.sectionId ? { sectionId: params.sectionId } : {}),
      ...(params.open !== undefined ? { open: params.open } : {}),
      ...(params.leagueId ? { leagueId: params.leagueId } : {}),
      ...(params.teamId ? { teamId: params.teamId } : {}),
    },
  })
  return data
}

// Read-only, no side effects - a section's own real, upcoming fixtures (any team of the section, 064), grouped by
// consecutive/same-calendar-date clustering, for the fixture-group review page to propose a new
// round from.
export async function getFixtureGroups(clubId: string, sectionId: string): Promise<SectionAvailabilityFixtureGroup[]> {
  const { data } = await api.get<SectionAvailabilityFixtureGroup[]>(fixtureGroupsPath(clubId, sectionId))
  return data
}

// No roundDate/dayPart in the payload - the admin's own selected matchIds decide both, and
// exactly which brackets get created (Data Model Changes).
export async function createRound(
  clubId: string,
  payload: CreateSectionAvailabilityRoundPayload,
): Promise<SectionAvailabilityRound> {
  const { data } = await api.post<SectionAvailabilityRound>(roundsPath(clubId), payload)
  return data
}

export async function updateRoundDescription(
  clubId: string,
  roundId: string,
  description: string,
): Promise<SectionAvailabilityRound> {
  const { data } = await api.put<SectionAvailabilityRound>(`${roundsPath(clubId)}/${roundId}`, { description })
  return data
}

// docs/specs/066: sets the close time of an open or closed group poll; does not open or close it.
export async function updateRoundCloseTime(
  clubId: string,
  roundId: string,
  payload: UpdateCloseTimePayload,
): Promise<SectionAvailabilityRound> {
  const { data } = await api.put<SectionAvailabilityRound>(`${roundsPath(clubId)}/${roundId}/close-time`, payload)
  return data
}

// docs/specs/064: deletes a group poll with its windows/links/responses; 409 (message surfaced to
// the user) when match squad members were picked from it.
export async function deleteRound(clubId: string, roundId: string): Promise<void> {
  await api.delete(`${roundsPath(clubId)}/${roundId}`)
}

export async function openRound(clubId: string, roundId: string): Promise<SectionAvailabilityRound> {
  const { data } = await api.post<SectionAvailabilityRound>(`${roundsPath(clubId)}/${roundId}/open`)
  return data
}

export async function closeRound(clubId: string, roundId: string): Promise<SectionAvailabilityRound> {
  const { data } = await api.post<SectionAvailabilityRound>(`${roundsPath(clubId)}/${roundId}/close`)
  return data
}

export async function getRoundResponses(clubId: string, roundId: string): Promise<SectionAvailabilityRoundResponses> {
  const { data } = await api.get<SectionAvailabilityRoundResponses>(`${roundsPath(clubId)}/${roundId}/responses`)
  return data
}

export async function getRoundMatches(clubId: string, roundId: string): Promise<SectionAvailabilityRoundMatch[]> {
  const { data } = await api.get<SectionAvailabilityRoundMatch[]>(`${roundsPath(clubId)}/${roundId}/matches`)
  return data
}

// Admin override - set a player's status for one specific bracket directly from /manage, mirroring
// matchAvailabilityApi.ts's own setPlayerStatus (032's real, already-shipped override endpoint,
// added after live review found no way to record a response relayed outside the app, e.g. a phone
// call). Identifies the bracket by windowId directly rather than dayPart alone, since a round can
// now own several windows sharing the same dayPart across different dates. Since docs/specs/066 the
// admin override also works on a closed round (a manager correction); the public path still 409s.
export async function setRoundPlayerStatus(
  clubId: string,
  roundId: string,
  playerProfileId: string,
  windowId: string,
  status: AvailabilityStatus,
): Promise<SectionAvailabilityRoundResponses> {
  const { data } = await api.put<SectionAvailabilityRoundResponses>(
    `${roundsPath(clubId)}/${roundId}/players/${playerProfileId}`,
    { windowId, status },
  )
  return data
}
