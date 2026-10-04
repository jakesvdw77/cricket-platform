import api from './axiosConfig'
import type { MatchSide, PlayingRole } from './matchSideApi'

// docs/specs/076-team-selection.md: the selection pool a manager picks from and the atomic apply
// endpoint behind the Select players dialog. Both live on the new MatchSelectionController.
export type SelectionAvailability = 'AVAILABLE' | 'UNSURE' | 'UNAVAILABLE' | 'NO_RESPONSE' | 'NOT_POLLED'
export type SelectionReason = 'TAKEN_FOR_SLOT' | 'SAID_UNAVAILABLE' | 'NOT_CONFIRMED' | 'AGE_INELIGIBLE'
export type SelectionRejectionReason =
  | SelectionReason
  | 'NOT_IN_POOL'
  | 'TEAM_FULL'
  | 'POSITION_INVALID'

export interface SelectionTaken {
  teamId: string
  teamName: string
  matchId: string
  matchDate: string
  sideId: string
  // The other side of this same match (a derby).
  sameMatch: boolean
  announced: boolean
  canRelease: boolean
}

export interface SelectionPoolEntry {
  playerProfileId: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  availability: SelectionAvailability
  selected: boolean
  selectable: boolean
  reason: SelectionReason | null
  reasonText: string | null
  taken: SelectionTaken | null
}

export type CoveringPollKind = 'NONE' | 'SQUAD' | 'GROUP'

export interface SelectionCoveringPoll {
  kind: CoveringPollKind
  pollId: string | null
  roundId: string | null
  matchId: string | null
}

export interface SelectionPool {
  matchId: string
  teamId: string
  // Null until the side exists.
  sideId: string | null
  basis: 'ROSTER' | 'POLL_AVAILABLE'
  wholeSection: boolean
  coveringPoll: SelectionCoveringPoll
  truncated: boolean
  entries: SelectionPoolEntry[]
}

export interface SelectionPoolParams {
  wholeSection: boolean
  q?: string
}

export interface SelectionEntryRequest {
  playerProfileId: string
  // null = keep the existing role (a player already on the side) or BATSMAN (a new one).
  role?: PlayingRole | null
  // null = keep the existing position or none for a new player.
  battingOrder?: number | null
}

export interface ApplySelectionRequest {
  players: SelectionEntryRequest[]
}

export interface SelectionRejection {
  // Null for the whole-request TEAM_FULL rejection.
  playerProfileId: string | null
  playerName: string | null
  reason: SelectionRejectionReason
  message: string
  taken: SelectionTaken | null
}

// The 409 ProblemDetail body of an apply that was refused: nothing was saved.
export interface SelectionRejectedBody {
  detail?: string
  rejections?: SelectionRejection[]
}

export function selectionPoolQueryKey(clubId: string, matchId: string, teamId: string) {
  return ['managed-club', clubId, 'matches', matchId, 'teams', teamId, 'selection-pool'] as const
}

export async function getSelectionPool(
  clubId: string,
  matchId: string,
  teamId: string,
  { wholeSection, q }: SelectionPoolParams,
): Promise<SelectionPool> {
  const { data } = await api.get<SelectionPool>(
    `/manage/clubs/${clubId}/matches/${matchId}/teams/${teamId}/selection-pool`,
    { params: { wholeSection, ...(q ? { q } : {}) } },
  )
  return data
}

export async function applySelection(
  clubId: string,
  matchId: string,
  sideId: string,
  request: ApplySelectionRequest,
): Promise<MatchSide> {
  const { data } = await api.put<MatchSide>(
    `/manage/clubs/${clubId}/matches/${matchId}/sides/${sideId}/selection`,
    request,
  )
  return data
}
