import { announceMatchSide, updateMatchSide } from '../../../api/matchSideApi'

// The roles a manager picks in the announce dialog for a side that had none. Absent means "leave it as it is".
export interface AnnounceRoleChoices {
  captainPlayerId?: string
  wicketKeeperPlayerId?: string
}

export interface SideRoles {
  captainPlayerId: string | null
  wicketKeeperPlayerId: string | null
  twelfthManPlayerId: string | null
}

// docs/specs/076-team-selection.md: PUT .../sides/{sideId} is a full replace of captain, keeper and 12th man, so the
// roles that are not chosen are sent as they are. The role save comes first; if it fails nothing is announced.
export async function announceWithRoles(
  clubId: string,
  matchId: string,
  sideId: string,
  current: SideRoles,
  choices?: AnnounceRoleChoices,
) {
  if (choices && (choices.captainPlayerId || choices.wicketKeeperPlayerId)) {
    await updateMatchSide(clubId, matchId, sideId, {
      captainPlayerId: choices.captainPlayerId ?? current.captainPlayerId,
      wicketKeeperPlayerId: choices.wicketKeeperPlayerId ?? current.wicketKeeperPlayerId,
      twelfthManPlayerId: current.twelfthManPlayerId,
    })
  }
  return announceMatchSide(clubId, matchId, sideId)
}
