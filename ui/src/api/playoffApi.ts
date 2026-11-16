import api from './axiosConfig'
import type { Match } from './matchApi'

// docs/specs/155-playoff-and-knockout-fixtures.md: create a round of playoff or knockout games for a league and season. Preview
// validates exactly as the create would and writes nothing; the plain create is the confirm step.
export interface PlayoffSide {
  // Exactly one of these three: a TBC text ("1st in the pool"), one of our team ids, or a league team id.
  placeholder?: string | null
  teamId?: string | null
  leagueTeamId?: string | null
}

export interface PlayoffGame {
  // A game's own stage overrides the round's.
  stage?: string | null
  label?: string | null
  home: PlayoffSide
  away: PlayoffSide
  matchDate: string
  venue?: string | null
  playingAreaId?: string | null
}

export interface PlayoffRound {
  stage: string
  games: PlayoffGame[]
  acknowledgedWarnings?: string[]
}

function playoffsPath(clubId: string, leagueId: string, seasonId: string): string {
  return `/manage/clubs/${clubId}/leagues/${leagueId}/seasons/${seasonId}/playoffs`
}

export async function previewPlayoffs(clubId: string, leagueId: string, seasonId: string, round: PlayoffRound): Promise<Match[]> {
  const { data } = await api.post<Match[]>(`${playoffsPath(clubId, leagueId, seasonId)}/preview`, round)
  return data
}

export async function createPlayoffs(clubId: string, leagueId: string, seasonId: string, round: PlayoffRound): Promise<Match[]> {
  const { data } = await api.post<Match[]>(playoffsPath(clubId, leagueId, seasonId), round)
  return data
}
