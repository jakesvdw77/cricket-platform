import api from './axiosConfig'

// A Match's playing-XI side — docs/specs/029-league-management.md. A MatchSide only exists for a
// side that's a real Team; a free-text opponent side never gets one (no roster to select from).
export type PlayingRole = 'BATSMAN' | 'BOWLER' | 'ALL_ROUNDER'

export interface MatchSidePlayer {
  playerProfileId: string
  battingOrder: number
  role: PlayingRole
}

export interface MatchSide {
  id: string
  matchId: string
  teamId: string
  captainPlayerId: string | null
  wicketKeeperPlayerId: string | null
  twelfthManPlayerId: string | null
  players: MatchSidePlayer[]
  announced: boolean
}

function sidesPath(clubId: string, matchId: string): string {
  return `/manage/clubs/${clubId}/matches/${matchId}/sides`
}

export async function listMatchSides(clubId: string, matchId: string): Promise<MatchSide[]> {
  const { data } = await api.get<MatchSide[]>(sidesPath(clubId, matchId))
  return data
}

export async function createMatchSide(clubId: string, matchId: string, teamId: string): Promise<MatchSide> {
  const { data } = await api.post<MatchSide>(sidesPath(clubId, matchId), { teamId })
  return data
}

export interface UpdateMatchSidePayload {
  captainPlayerId?: string | null
  wicketKeeperPlayerId?: string | null
  twelfthManPlayerId?: string | null
}

export async function updateMatchSide(
  clubId: string,
  matchId: string,
  sideId: string,
  payload: UpdateMatchSidePayload,
): Promise<MatchSide> {
  const { data } = await api.put<MatchSide>(`${sidesPath(clubId, matchId)}/${sideId}`, payload)
  return data
}

export async function addMatchSidePlayer(
  clubId: string,
  matchId: string,
  sideId: string,
  playerProfileId: string,
  role: PlayingRole,
): Promise<MatchSide> {
  const { data } = await api.post<MatchSide>(`${sidesPath(clubId, matchId)}/${sideId}/players`, {
    playerProfileId,
    role,
  })
  return data
}

export async function updateMatchSidePlayerRole(
  clubId: string,
  matchId: string,
  sideId: string,
  playerProfileId: string,
  role: PlayingRole,
): Promise<MatchSide> {
  const { data } = await api.put<MatchSide>(
    `${sidesPath(clubId, matchId)}/${sideId}/players/${playerProfileId}`,
    { role },
  )
  return data
}

export async function removeMatchSidePlayer(
  clubId: string,
  matchId: string,
  sideId: string,
  playerProfileId: string,
): Promise<MatchSide> {
  const { data } = await api.post<MatchSide>(
    `${sidesPath(clubId, matchId)}/${sideId}/players/${playerProfileId}/remove`,
  )
  return data
}

export async function reorderMatchSidePlayers(
  clubId: string,
  matchId: string,
  sideId: string,
  playerProfileIds: string[],
): Promise<MatchSide> {
  const { data } = await api.put<MatchSide>(`${sidesPath(clubId, matchId)}/${sideId}/players/reorder`, {
    playerProfileIds,
  })
  return data
}

export async function announceMatchSide(clubId: string, matchId: string, sideId: string): Promise<MatchSide> {
  const { data } = await api.post<MatchSide>(`${sidesPath(clubId, matchId)}/${sideId}/announce`)
  return data
}

export async function unannounceMatchSide(clubId: string, matchId: string, sideId: string): Promise<MatchSide> {
  const { data } = await api.post<MatchSide>(`${sidesPath(clubId, matchId)}/${sideId}/unannounce`)
  return data
}
