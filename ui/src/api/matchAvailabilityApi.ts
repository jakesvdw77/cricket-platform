import api from './axiosConfig'

// A Match side's availability poll — docs/specs/032-match-availability-polls.md. One poll per
// (match, team), admin-managed from a new Availability tab on MatchFormPage. `status` on each row
// is null when that squad member hasn't responded yet.
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNSURE'

export interface MatchAvailabilityPoll {
  id: string
  teamId: string
  open: boolean
  // docs/specs/064-unified-availability-polls.md: squad polls get the same autoclose group polls
  // have - scheduledCloseAt is kickoff minus 24h when autoClose, else null.
  autoClose: boolean
  scheduledCloseAt: string | null
  availableCount: number
  unavailableCount: number
  unsureCount: number
  noResponseCount: number
}

export interface PlayerAvailabilityRow {
  playerProfileId: string
  firstName: string
  lastName: string
  squadJerseyNumber: number | null
  status: AvailabilityStatus | null
  // True when the player answered through the public link (077); null/absent for older data.
  viaLink?: boolean | null
}

export interface MatchAvailabilityPollResponses {
  pollId: string
  teamId: string
  open: boolean
  availableCount: number
  unavailableCount: number
  unsureCount: number
  noResponseCount: number
  responses: PlayerAvailabilityRow[]
  publicPath: string
}

function pollsPath(clubId: string, matchId: string): string {
  return `/manage/clubs/${clubId}/matches/${matchId}/polls`
}

export async function listPolls(clubId: string, matchId: string): Promise<MatchAvailabilityPoll[]> {
  const { data } = await api.get<MatchAvailabilityPoll[]>(pollsPath(clubId, matchId))
  return data
}

// autoClose absent = the backend's own default (on) - 064. scheduledCloseAt (ISO, docs/specs/066)
// absent = the server default (kickoff minus 24h).
export async function createPoll(
  clubId: string,
  matchId: string,
  teamId: string,
  autoClose?: boolean,
  scheduledCloseAt?: string,
): Promise<MatchAvailabilityPoll> {
  const { data } = await api.post<MatchAvailabilityPoll>(pollsPath(clubId, matchId), {
    teamId,
    ...(autoClose !== undefined ? { autoClose } : {}),
    ...(scheduledCloseAt ? { scheduledCloseAt } : {}),
  })
  return data
}

// docs/specs/066: body of the PUT .../close-time endpoint. autoClose false stores no time.
export interface UpdatePollCloseTimePayload {
  autoClose: boolean
  scheduledCloseAt: string | null
}

// Sets the close time of an open or closed squad poll; does not open or close it.
export async function updatePollCloseTime(
  clubId: string,
  matchId: string,
  pollId: string,
  payload: UpdatePollCloseTimePayload,
): Promise<MatchAvailabilityPoll> {
  const { data } = await api.put<MatchAvailabilityPoll>(`${pollsPath(clubId, matchId)}/${pollId}/close-time`, payload)
  return data
}

// docs/specs/064: deletes a squad poll and its responses, freeing the match for a new poll of
// either kind.
export async function deletePoll(clubId: string, matchId: string, pollId: string): Promise<void> {
  await api.delete(`${pollsPath(clubId, matchId)}/${pollId}`)
}

export async function openPoll(clubId: string, matchId: string, pollId: string): Promise<MatchAvailabilityPoll> {
  const { data } = await api.post<MatchAvailabilityPoll>(`${pollsPath(clubId, matchId)}/${pollId}/open`)
  return data
}

export async function closePoll(clubId: string, matchId: string, pollId: string): Promise<MatchAvailabilityPoll> {
  const { data } = await api.post<MatchAvailabilityPoll>(`${pollsPath(clubId, matchId)}/${pollId}/close`)
  return data
}

export async function getPollResponses(
  clubId: string,
  matchId: string,
  pollId: string,
): Promise<MatchAvailabilityPollResponses> {
  const { data } = await api.get<MatchAvailabilityPollResponses>(`${pollsPath(clubId, matchId)}/${pollId}/responses`)
  return data
}

// Admin override — set a squad member's status directly from the Availability tab (added after
// live review found no way to record a response relayed outside the poll link, e.g. a phone
// call). Since docs/specs/066 this also works on a closed poll (a manager correction); the public path still 409s.
export async function setPlayerStatus(
  clubId: string,
  matchId: string,
  pollId: string,
  playerProfileId: string,
  status: AvailabilityStatus,
): Promise<MatchAvailabilityPollResponses> {
  const { data } = await api.put<MatchAvailabilityPollResponses>(
    `${pollsPath(clubId, matchId)}/${pollId}/players/${playerProfileId}`,
    { status },
  )
  return data
}

// docs/specs/034-availability-polls-dashboard.md: one currently-open poll, aggregated with its
// match context and a per-status respondent summary — the club-wide dashboard's own response
// shape, distinct from the match-nested MatchAvailabilityPollResponses above. Exactly one of
// homeTeamId/homeTeamName (same for awayTeamId/awayTeamName) is non-null, per Match's own
// invariant — resolved client-side the same way MatchList.tsx/MatchFormPage.tsx already do, not
// re-solved server-side. Field names/types verified verbatim against
// com.cricketlegend.dto.OpenAvailabilityPollDto.
export interface AvailabilityRespondent {
  playerProfileId: string
  firstName: string
  lastName: string
  squadJerseyNumber: number | null
}

export interface OpenAvailabilityPoll {
  pollId: string
  matchId: string
  teamId: string
  homeTeamId: string | null
  homeTeamName: string | null
  awayTeamId: string | null
  awayTeamName: string | null
  matchDate: string
  venue: string | null
  autoClose: boolean
  scheduledCloseAt: string | null
  availableCount: number
  unavailableCount: number
  unsureCount: number
  noResponseCount: number
  availableRespondents: AvailabilityRespondent[]
  unavailableRespondents: AvailabilityRespondent[]
  unsureRespondents: AvailabilityRespondent[]
}

export interface ListOpenPollsParams {
  // docs/specs/035-section-scoped-access.md: narrows to one section's (and its descendants')
  // open polls — validated server-side, never a client-side filter over the full result.
  sectionId?: string
}

// Plain array response, not Page<T> — see docs/specs/034-availability-polls-dashboard.md's API
// Contract for why this club-wide list is deliberately unpaginated (bounded by "currently open",
// not by match history).
export async function listOpenPolls(clubId: string, params: ListOpenPollsParams = {}): Promise<OpenAvailabilityPoll[]> {
  const { data } = await api.get<OpenAvailabilityPoll[]>(`/manage/clubs/${clubId}/availability-polls/open`, {
    params: { ...(params.sectionId ? { sectionId: params.sectionId } : {}) },
  })
  return data
}

// docs/specs/064-unified-availability-polls.md: the dashboard's 'Show closed polls' switch - same
// OpenAvailabilityPollDto shape as listOpenPolls, but closed polls only, capped server-side at
// the 50 most recent so the list stays bounded.
export async function listClosedPolls(clubId: string, params: ListOpenPollsParams = {}): Promise<OpenAvailabilityPoll[]> {
  const { data } = await api.get<OpenAvailabilityPoll[]>(`/manage/clubs/${clubId}/availability-polls/closed`, {
    params: { ...(params.sectionId ? { sectionId: params.sectionId } : {}) },
  })
  return data
}
