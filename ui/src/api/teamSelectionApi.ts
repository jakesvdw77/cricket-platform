import { useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import api from './axiosConfig'
import type { PlayingRole, SelectionLimits } from './matchSideApi'

// docs/specs/093-team-selection-hub.md: the one batched read behind the four views of the Team selection hub
// (Matches, Players, Time slots, Batting order), so they cannot disagree. Writes reuse the spec 076 endpoints.
export type TeamSelectionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_TO_ANNOUNCE' | 'ANNOUNCED'

export type TeamSelectionReasonCode =
  | 'AGE_INELIGIBLE'
  | 'SAID_UNAVAILABLE'
  | 'NOT_CONFIRMED'
  | 'TAKEN_FOR_SLOT'
  | 'NOT_IN_POOL'
  | 'TEAM_FULL'
  | 'POSITION_INVALID'

export interface TeamSelectionPick {
  playerId: string
  firstName: string
  lastName: string
  battingOrder: number | null
  role: PlayingRole
  captain: boolean
  wicketKeeper: boolean
  twelfthMan: boolean
}

export interface TeamSelectionSide {
  // Null until the club's side of the match has been created (nothing picked yet).
  sideId: string | null
  teamId: string
  teamName: string
  sectionId: string
  home: boolean
  opponentName: string
  announced: boolean
  status: TeamSelectionStatus
  limits: SelectionLimits
  pickedCount: number
  placesFilled: boolean
  captainPlayerId: string | null
  wicketKeeperPlayerId: string | null
  twelfthManPlayerId: string | null
  picks: TeamSelectionPick[]
}

export interface TeamSelectionMatch {
  matchId: string
  matchDate: string
  dayPart: 'MORNING' | 'AFTERNOON'
  label: string
  venue: string | null
  seasonId: string
  leagueId: string | null
  leagueName: string | null
  upcoming: boolean
  status: TeamSelectionStatus
  sides: TeamSelectionSide[]
}

export type TeamSelectionAvailability = 'AVAILABLE' | 'UNSURE' | 'UNAVAILABLE' | 'NO_RESPONSE' | 'NOT_POLLED'

export interface TeamSelectionCell {
  matchId: string
  teamId: string
  sideId: string | null
  picked: boolean
  pickable: boolean
  // The player's poll answer for this match, always present (also on picked cells).
  availability: TeamSelectionAvailability
  reasonCode: TeamSelectionReasonCode | null
}

export interface TeamSelectionPlayer {
  playerId: string
  firstName: string
  lastName: string
  pickedCount: number
  cells: TeamSelectionCell[]
}

export interface TeamSelectionCounts {
  upcoming: number
  notStarted: number
  inProgress: number
  readyToAnnounce: number
  announced: number
}

export interface TeamSelectionOverview {
  matches: TeamSelectionMatch[]
  players: TeamSelectionPlayer[]
  counts: TeamSelectionCounts
  truncated: boolean
}

export interface TeamSelectionFilters {
  seasonId?: string | null
  leagueId?: string | null
  sectionId?: string | null
  teamId?: string | null
  includePast?: boolean
}

// Prefix of every overview query of a club, for invalidation after a selection write.
export const teamSelectionPrefix = (clubId: string) => ['managed-club', clubId, 'team-selection'] as const

export const teamSelectionKey = (clubId: string, filters: TeamSelectionFilters = {}) =>
  [...teamSelectionPrefix(clubId), filters] as const

export function invalidateTeamSelection(queryClient: QueryClient, clubId: string) {
  return queryClient.invalidateQueries({ queryKey: teamSelectionPrefix(clubId) })
}

// Only the filters that are set are sent; the server default is includePast false.
export async function getTeamSelection(clubId: string, filters: TeamSelectionFilters = {}): Promise<TeamSelectionOverview> {
  const params: Record<string, string | boolean> = {}
  if (filters.seasonId) params.seasonId = filters.seasonId
  if (filters.leagueId) params.leagueId = filters.leagueId
  if (filters.sectionId) params.sectionId = filters.sectionId
  if (filters.teamId) params.teamId = filters.teamId
  if (filters.includePast) params.includePast = true
  const { data } = await api.get<TeamSelectionOverview>(`/manage/clubs/${clubId}/team-selection`, { params })
  return data
}

export function useTeamSelection(clubId: string | undefined, filters: TeamSelectionFilters, enabled = true) {
  return useQuery({
    queryKey: teamSelectionKey(clubId ?? '', filters),
    queryFn: () => getTeamSelection(clubId as string, filters),
    enabled: Boolean(clubId) && enabled,
  })
}
