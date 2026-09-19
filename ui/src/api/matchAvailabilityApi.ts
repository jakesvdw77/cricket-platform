import api from './axiosConfig'

// A Match side's availability poll — docs/specs/032-match-availability-polls.md. One poll per
// (match, team), admin-managed from a new Availability tab on MatchFormPage. `status` on each row
// is null when that squad member hasn't responded yet.
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNSURE'

export interface MatchAvailabilityPoll {
  id: string
  teamId: string
  open: boolean
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

export async function createPoll(clubId: string, matchId: string, teamId: string): Promise<MatchAvailabilityPoll> {
  const { data } = await api.post<MatchAvailabilityPoll>(pollsPath(clubId, matchId), { teamId })
  return data
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
// call). Same closed-poll 409 rule as the public write path — admin included, no bypass.
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
