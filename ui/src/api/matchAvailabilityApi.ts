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
