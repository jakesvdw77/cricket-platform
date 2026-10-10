import type { Match } from '../../../api/matchApi'
import type { MatchSide, MatchSidePlayer, PlayingRole, UpdateMatchSidePayload } from '../../../api/matchSideApi'
import type { SelectionPoolEntry } from '../../../api/matchSelectionApi'
import type { Team } from '../../../api/teamApi'
import type { TeamSelectionStatus } from '../../../api/teamSelectionApi'
import { squadDisplayName } from '../../../utils/squadDisplayName'

// Pure helpers of one side's selection (docs/specs/076-team-selection.md), used by useMatchSidePanel and the Select team
// page. Moved verbatim from MatchFormPage when the Home XI / Away XI tabs became the Select team page (spec 093).

// A real Team's own name from the club's team list, else the match's own free-text name.
export function sideDisplayName(teamId: string | null, teamName: string | null, teamsById: Map<string, Team>): string {
  if (teamName) {
    return teamName
  }
  if (teamId) {
    return teamsById.get(teamId)?.name ?? 'Unknown team'
  }
  return 'Unknown team'
}

// docs/specs/037-match-improvements.md item 9: the *other* side's display name for a previous-match candidate.
export function opponentLabel(match: Match, teamId: string, teamsById: Map<string, Team>): string {
  if (match.homeTeamId === teamId) {
    return sideDisplayName(match.awayTeamId, match.awayTeamName, teamsById)
  }
  return sideDisplayName(match.homeTeamId, match.homeTeamName, teamsById)
}

export function playerName(entry: SelectionPoolEntry | undefined): string {
  return entry
    ? squadDisplayName({ firstName: entry.firstName, lastName: entry.lastName, squadJerseyNumber: entry.jerseyNumber })
    : 'Unknown player'
}

// Positions are always contiguous: every cache edit that removes or gives a position renumbers the
// positioned players 1..k, as the server does.
function compactPositions(players: MatchSidePlayer[]): MatchSidePlayer[] {
  const ranked = players
    .filter((player) => player.battingOrder != null)
    .sort((a, b) => (a.battingOrder as number) - (b.battingOrder as number))
  const positions = new Map(ranked.map((player, index) => [player.playerProfileId, index + 1]))
  return players.map((player) => ({ ...player, battingOrder: positions.get(player.playerProfileId) ?? null }))
}

export function withReorder(side: MatchSide, ids: string[]): MatchSide {
  return {
    ...side,
    twelfthManPlayerId: side.twelfthManPlayerId && ids.includes(side.twelfthManPlayerId) ? null : side.twelfthManPlayerId,
    players: side.players.map((player) => {
      const index = ids.indexOf(player.playerProfileId)
      return { ...player, battingOrder: index === -1 ? null : index + 1 }
    }),
  }
}

export function withUpdate(side: MatchSide, payload: UpdateMatchSidePayload): MatchSide {
  const twelfth = payload.twelfthManPlayerId ?? null
  return {
    ...side,
    captainPlayerId: payload.captainPlayerId ?? null,
    wicketKeeperPlayerId: payload.wicketKeeperPlayerId ?? null,
    twelfthManPlayerId: twelfth,
    players: compactPositions(
      side.players.map((player) => (player.playerProfileId === twelfth ? { ...player, battingOrder: null } : player)),
    ),
  }
}

export function withRemoval(side: MatchSide, playerId: string): MatchSide {
  return {
    ...side,
    captainPlayerId: side.captainPlayerId === playerId ? null : side.captainPlayerId,
    wicketKeeperPlayerId: side.wicketKeeperPlayerId === playerId ? null : side.wicketKeeperPlayerId,
    twelfthManPlayerId: side.twelfthManPlayerId === playerId ? null : side.twelfthManPlayerId,
    players: compactPositions(side.players.filter((player) => player.playerProfileId !== playerId)),
  }
}

export function withRole(side: MatchSide, playerId: string, role: PlayingRole): MatchSide {
  return { ...side, players: side.players.map((player) => (player.playerProfileId === playerId ? { ...player, role } : player)) }
}

// "A, B, C and 4 more": the server's own shape for a long list of names.
function nameList(names: string[]): string {
  const sorted = [...names].sort()
  if (sorted.length <= 3) {
    return sorted.join(', ')
  }
  return `${sorted.slice(0, 3).join(', ')} and ${sorted.length - 3} more`
}

// The section 8 announce rule, with the server's own check order and wording (MatchSideServiceImpl.announce), so the
// disabled button's tooltip carries the text the server would return. Null when the rule is met.
export function announceBlockedReason(
  side: MatchSide,
  teamName: string,
  nameOf: (playerId: string) => string,
): string | null {
  const total = side.players.length
  if (total === 0) {
    return `Side ${side.id} has no players to announce`
  }
  const prefix = `Cannot announce ${teamName}: `
  if (total > side.limits.maxSelected) {
    return `${prefix}${total} players are selected; the most allowed is ${side.limits.maxSelected}.`
  }
  const unpositioned = side.players.filter(
    (player) => player.battingOrder == null && player.playerProfileId !== side.twelfthManPlayerId,
  )
  if (unpositioned.length > 0) {
    const names = nameList(unpositioned.map((player) => nameOf(player.playerProfileId)))
    return `${prefix}${unpositioned.length} ${unpositioned.length === 1 ? 'player has' : 'players have'} no batting position (${names}).`
  }
  const positioned = side.players.filter((player) => player.battingOrder != null).length
  if (positioned > side.limits.battingPlaces) {
    return `${prefix}${positioned} players are selected but only ${side.limits.battingPlaces} places exist; choose the 12th man or remove one.`
  }
  return null
}

// The selection status of one side, by the server's own rule (TeamSelectionStatuses, docs/specs/093): announced; not
// started with nobody picked; ready when every pick but the 12th man has a batting position and all the places are filled.
export function sideStatus(side: MatchSide): TeamSelectionStatus {
  if (side.announced) {
    return 'ANNOUNCED'
  }
  if (side.players.length === 0) {
    return 'NOT_STARTED'
  }
  const rest = side.players.filter((player) => player.playerProfileId !== side.twelfthManPlayerId)
  const positioned = rest.filter((player) => player.battingOrder != null).length
  return positioned === rest.length && positioned >= side.limits.battingPlaces ? 'READY_TO_ANNOUNCE' : 'IN_PROGRESS'
}
