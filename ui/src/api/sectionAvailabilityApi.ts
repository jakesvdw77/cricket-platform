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
  autoClose: boolean
  scheduledCloseAt: string | null
  open: boolean
  // However many windows this round actually owns, one to several - no longer a fixed pair.
  brackets: SectionAvailabilityRoundBracket[]
}

export interface CreateSectionAvailabilityRoundPayload {
  sectionId: string
  description: string
  matchIds: string[]
  autoClose: boolean
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
// alreadyPolled/existingRoundId/existingRoundDescription are only populated when a
// SectionAvailabilityWindow already exists for this match's own resolved bracket (from any
// round, open or closed), so the UI can render it disabled with a link to the poll that already
// covers it.
export interface SectionAvailabilityFixtureMatch {
  matchId: string
  teamId: string
  teamName: string
  opponentLabel: string
  matchDate: string
  dayPart: DayPart
  leagueName: string | null
  alreadyPolled: boolean
  existingRoundId: string | null
  existingRoundDescription: string | null
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
}

// Plain array response, not Page<T> - a club's section availability rounds are a small, bounded,
// unpaginated list, matching MatchAvailabilityPoll/Section's own posture.
export async function listRounds(clubId: string, params: ListRoundsParams = {}): Promise<SectionAvailabilityRound[]> {
  const { data } = await api.get<SectionAvailabilityRound[]>(roundsPath(clubId), {
    params: {
      ...(params.sectionId ? { sectionId: params.sectionId } : {}),
      ...(params.open !== undefined ? { open: params.open } : {}),
    },
  })
  return data
}

// Read-only, no side effects - a section's own real, upcoming FLEXIBLE-team fixtures, grouped by
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
// now own several windows sharing the same dayPart across different dates. Same closed-round 409
// rule as the public write path - admin included, no bypass.
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
