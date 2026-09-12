import api from './axiosConfig'
import type { Player } from './playerApi'

// A Team's squad — the pool of players eligible for selection on that team, season-scoped per
// docs/specs/029-league-management.md's own pre-build amendment: a squad is always "this team's
// squad for this season," never a standing, un-scoped list. Reuses 028's existing PlayerDto shape
// server-side — no new type needed here either.
function squadPath(clubId: string, teamId: string, seasonId: string): string {
  return `/manage/clubs/${clubId}/teams/${teamId}/seasons/${seasonId}/squad`
}

export async function listSquad(clubId: string, teamId: string, seasonId: string): Promise<Player[]> {
  const { data } = await api.get<Player[]>(squadPath(clubId, teamId, seasonId))
  return data
}

export async function addToSquad(
  clubId: string,
  teamId: string,
  seasonId: string,
  playerId: string,
): Promise<Player> {
  const { data } = await api.post<Player>(`${squadPath(clubId, teamId, seasonId)}/${playerId}/add`)
  return data
}

export async function removeFromSquad(
  clubId: string,
  teamId: string,
  seasonId: string,
  playerId: string,
): Promise<void> {
  await api.post(`${squadPath(clubId, teamId, seasonId)}/${playerId}/remove`)
}
