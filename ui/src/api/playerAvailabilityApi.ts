import api from './axiosConfig'
import type { DayPart } from './sectionAvailabilityApi'

// docs/specs/068-player-availability-grid.md: one read endpoint fills the whole grid - games as
// columns, players as rows, one cell per (player, game). Field names mirror
// com.cricketlegend.dto.PlayerAvailabilityDto and its nested records.
export type GridPollType = 'SQUAD' | 'GROUP'

export type CellStatus = 'AVAILABLE' | 'UNSURE' | 'UNAVAILABLE' | 'NO_RESPONSE' | 'NOT_IN_POLL'

export interface GameColumn {
  matchId: string
  matchDate: string
  dayPart: DayPart
  label: string
  venue: string | null
  leagueId: string | null
  leagueName: string | null
  // Null when no in-scope club team resolves for the game.
  teamId: string | null
  sectionId: string | null
  pollType: GridPollType | null
  // Squad poll id, or the group round id for a group poll; null when the game has no poll.
  pollId: string | null
  roundId: string | null
}

export interface AvailabilityCell {
  matchId: string
  status: CellStatus
  picked: boolean
}

export interface PlayerRow {
  playerProfileId: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  answeredCount: number
  pickedCount: number
  // Same order as PlayerAvailability.games.
  cells: AvailabilityCell[]
}

export interface PlayerAvailability {
  games: GameColumn[]
  players: PlayerRow[]
  // True when the server's hard cap cut either the games or the players.
  truncated: boolean
}

export interface ListPlayerAvailabilityParams {
  seasonId?: string
  leagueId?: string
  sectionId?: string
  teamId?: string
  includePast?: boolean
}

export async function listPlayerAvailability(
  clubId: string,
  params: ListPlayerAvailabilityParams = {},
): Promise<PlayerAvailability> {
  const { data } = await api.get<PlayerAvailability>(`/manage/clubs/${clubId}/player-availability`, {
    params: {
      ...(params.seasonId ? { seasonId: params.seasonId } : {}),
      ...(params.leagueId ? { leagueId: params.leagueId } : {}),
      ...(params.sectionId ? { sectionId: params.sectionId } : {}),
      ...(params.teamId ? { teamId: params.teamId } : {}),
      ...(params.includePast ? { includePast: true } : {}),
    },
  })
  return data
}
