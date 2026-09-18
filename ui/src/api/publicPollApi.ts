import api from './axiosConfig'
import type { AvailabilityStatus, PlayerAvailabilityRow } from './matchAvailabilityApi'

// The public, unauthenticated side of docs/specs/032-match-availability-polls.md's availability
// poll — `/api/v1/public/polls/**`, second consumer of the public namespace after
// PublicClubController, first to serve real per-record tenant data and accept a public write. No
// clubId anywhere in this shape: the poll's own UUID is the entire access boundary. Built on the
// same shared `api` instance as every other resource file, per docs/standards/frontend.md —
// axiosConfig.ts already no-ops the Authorization header when there's no Keycloak session, so no
// special unauthenticated client is needed here.
export interface PublicAvailabilityPoll {
  pollId: string
  open: boolean
  homeTeamName: string | null
  awayTeamName: string | null
  matchDate: string
  venue: string | null
  leagueName: string | null
  seasonLabel: string | null
  teamName: string | null
  responses: PlayerAvailabilityRow[]
}

function pollPath(pollId: string): string {
  return `/public/polls/${pollId}`
}

export async function getPoll(pollId: string): Promise<PublicAvailabilityPoll> {
  const { data } = await api.get<PublicAvailabilityPoll>(pollPath(pollId))
  return data
}

export async function setAvailability(
  pollId: string,
  playerProfileId: string,
  status: AvailabilityStatus,
): Promise<PublicAvailabilityPoll> {
  const { data } = await api.put<PublicAvailabilityPoll>(`${pollPath(pollId)}/players/${playerProfileId}`, {
    status,
  })
  return data
}
