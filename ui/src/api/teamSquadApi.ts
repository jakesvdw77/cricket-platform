import api from './axiosConfig'
import type { Player } from './playerApi'

// A Team's squad — the pool of players eligible for selection on that team, season-scoped per
// docs/specs/029-league-management.md's own pre-build amendment: a squad is always "this team's
// squad for this season," never a standing, un-scoped list.
//
// docs/specs/031-jersey-numbers.md gave TeamSquadMember its first-ever independent attribute
// (jerseyNumber), so GET/POST .../squad now return the backend's TeamSquadMemberDto — every field
// PlayerDto already carries, plus `id` (the TeamSquadMember row's own id, not
// player.id/playerProfileId — a squad member is addressed by playerProfileId when calling back
// into this API, but its own row has a distinct id) and `squadJerseyNumber` (this squad
// membership's own number, independent of `jerseyNumber`, the player's standing number carried
// over from PlayerDto).
function squadPath(clubId: string, teamId: string, seasonId: string): string {
  return `/manage/clubs/${clubId}/teams/${teamId}/seasons/${seasonId}/squad`
}

export interface SquadMember extends Player {
  // The player's own PlayerProfile id — same value Player.id already carries under a distinct
  // name here, since `id` on this shape means something different (see above). Every existing
  // playerProfileId join elsewhere in this codebase (MatchSidePlayer, MatchSide's captain/
  // wicketkeeper/twelfth-man ids) is expressed against this field, not `id`.
  playerProfileId: string
  squadJerseyNumber: number | null
}

export async function listSquad(clubId: string, teamId: string, seasonId: string): Promise<SquadMember[]> {
  const { data } = await api.get<SquadMember[]>(squadPath(clubId, teamId, seasonId))
  return data
}

export async function addToSquad(
  clubId: string,
  teamId: string,
  seasonId: string,
  playerId: string,
): Promise<SquadMember> {
  const { data } = await api.post<SquadMember>(`${squadPath(clubId, teamId, seasonId)}/${playerId}/add`)
  return data
}

// docs/specs/031-jersey-numbers.md's new PUT endpoint — TeamSquadMember's first-ever update,
// updating only this squad member's own jerseyNumber. `null` clears it back out.
export async function updateSquadJerseyNumber(
  clubId: string,
  teamId: string,
  seasonId: string,
  playerId: string,
  jerseyNumber: number | null,
): Promise<SquadMember> {
  const { data } = await api.put<SquadMember>(`${squadPath(clubId, teamId, seasonId)}/${playerId}`, { jerseyNumber })
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
