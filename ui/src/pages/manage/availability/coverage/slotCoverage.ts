import type { GameColumn, PlayerRow } from '../../../../api/playerAvailabilityApi'
import type { DayPart } from '../../../../api/sectionAvailabilityApi'
import { groupGames } from '../../playerAvailability/gridHelpers'

// docs/specs/074-availability-coverage.md section 4: the pure logic behind the Coverage view. No
// React, no clock, no I/O. One SlotCoverage per (local date, Morning/Afternoon) of the club's games,
// with a verdict decided by a maximum bipartite matching of players to the places each team needs.

export type SlotStatus = 'COVERED' | 'TIGHT' | 'SHORT' | 'NO_XI_SIZE' | 'NO_POLL'

export interface TeamCoverage {
  teamId: string
  // The league's playing XI size; null when any of the team's games has no known league size.
  needed: number | null
  available: number
  // Available for this team and for no other team in the slot.
  ownOnly: number
  // Available for this team and at least one other team in the slot.
  shared: number
  unsure: number
  hasPoll: boolean
}

export interface SplitEntry {
  teamId: string
  shortfall: number
}

export interface SlotCoverage {
  key: string
  // Local midnight of the slot's date.
  date: Date
  dayPart: DayPart
  // Sorted by kickoff.
  games: GameColumn[]
  // Sorted by team id (the card orders by name).
  teams: TeamCoverage[]
  distinctAvailable: number
  placesNeeded: number
  sharedIds: string[]
  distinctUnsure: number
  status: SlotStatus
  shortBy: number
  // Tight only: the shared players each team with a shortfall must take.
  split: SplitEntry[]
  spare: number
}

interface ComputeInput {
  games: GameColumn[]
  players: PlayerRow[]
  xiSizeByLeagueId: Map<string, number>
}

interface TeamWork {
  teamId: string
  // Larger league XI size across the team's games; unknownSize when any game has none.
  neededMax: number
  unknownSize: boolean
  hasPoll: boolean
  availableIds: Set<string>
  unsureIds: Set<string>
}

const DAY_PART_ORDER: DayPart[] = ['MORNING', 'AFTERNOON']

// Maximum assignment of players to team places (each team a node with capacity `needed`), by
// augmenting paths: Kuhn's algorithm with capacities. Players are tried in profile-id order so the
// result is deterministic. Returns how many places are filled and each player's assigned team.
export function maxMatching(
  teams: { teamId: string; needed: number; availableIds: Set<string> }[],
): { matched: number; assignment: Map<string, string> } {
  const capacity = new Map(teams.map((team) => [team.teamId, team.needed]))
  const playerTeams = new Map<string, string[]>()
  for (const team of teams) {
    for (const id of team.availableIds) {
      const list = playerTeams.get(id) ?? []
      list.push(team.teamId)
      playerTeams.set(id, list)
    }
  }
  const assigned = new Map<string, string[]>(teams.map((team) => [team.teamId, []]))

  const augment = (playerId: string, visited: Set<string>): boolean => {
    for (const teamId of playerTeams.get(playerId) ?? []) {
      if (visited.has(teamId)) continue
      visited.add(teamId)
      const current = assigned.get(teamId) as string[]
      if (current.length < (capacity.get(teamId) as number)) {
        current.push(playerId)
        return true
      }
      for (let index = 0; index < current.length; index += 1) {
        if (augment(current[index], visited)) {
          current[index] = playerId
          return true
        }
      }
    }
    return false
  }

  let matched = 0
  for (const playerId of [...playerTeams.keys()].sort()) {
    if (augment(playerId, new Set())) matched += 1
  }

  const assignment = new Map<string, string>()
  for (const [teamId, list] of assigned) {
    for (const playerId of list) assignment.set(playerId, teamId)
  }
  return { matched, assignment }
}

export function computeSlotCoverage({ games, players, xiSizeByLeagueId }: ComputeInput): SlotCoverage[] {
  const clubGames = games.filter((game) => game.teamId !== null)
  const slots = groupGames(clubGames).flatMap((group) =>
    group.slots.map((slot) => ({ date: group.date, dateKey: group.dateKey, dayPart: slot.dayPart, games: slot.games })),
  )
  slots.sort(
    (a, b) => a.date.getTime() - b.date.getTime() || DAY_PART_ORDER.indexOf(a.dayPart) - DAY_PART_ORDER.indexOf(b.dayPart),
  )

  // statusOf(player, matchId) once, not a scan per lookup.
  const answers = new Map<string, Map<string, string>>()
  for (const player of players) {
    answers.set(player.playerProfileId, new Map(player.cells.map((cell) => [cell.matchId, cell.status])))
  }

  return slots.map((slot) => {
    const games = [...slot.games].sort(
      (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime() || a.matchId.localeCompare(b.matchId),
    )

    const work = new Map<string, TeamWork>()
    for (const game of games) {
      const teamId = game.teamId as string
      const size = game.leagueId ? xiSizeByLeagueId.get(game.leagueId) : undefined
      let team = work.get(teamId)
      if (!team) {
        team = { teamId, neededMax: 0, unknownSize: false, hasPoll: false, availableIds: new Set(), unsureIds: new Set() }
        work.set(teamId, team)
      }
      if (size === undefined) team.unknownSize = true
      else team.neededMax = Math.max(team.neededMax, size)
      if (game.pollType !== null) team.hasPoll = true
      for (const player of players) {
        const status = answers.get(player.playerProfileId)?.get(game.matchId)
        if (status === 'AVAILABLE') team.availableIds.add(player.playerProfileId)
        else if (status === 'UNSURE') team.unsureIds.add(player.playerProfileId)
      }
    }
    const teamsWork = [...work.values()]
      .map((team) => ({ ...team, needed: team.unknownSize ? null : team.neededMax }))
      .sort((a, b) => a.teamId.localeCompare(b.teamId))
    // An unsure answer from someone available for the same team is not unsure for that team.
    for (const team of teamsWork) {
      for (const id of team.availableIds) team.unsureIds.delete(id)
    }

    const distinct = new Set<string>()
    const counts = new Map<string, number>()
    for (const team of teamsWork) {
      for (const id of team.availableIds) {
        distinct.add(id)
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
    const sharedIds = [...counts.entries()].filter(([, count]) => count >= 2).map(([id]) => id).sort()
    const unsureAnywhere = new Set<string>()
    for (const team of teamsWork) {
      for (const id of team.unsureIds) if (!distinct.has(id)) unsureAnywhere.add(id)
    }

    const teams: TeamCoverage[] = teamsWork.map((team) => {
      let shared = 0
      for (const id of team.availableIds) if ((counts.get(id) as number) >= 2) shared += 1
      return {
        teamId: team.teamId,
        needed: team.needed,
        available: team.availableIds.size,
        ownOnly: team.availableIds.size - shared,
        shared,
        unsure: team.unsureIds.size,
        hasPoll: team.hasPoll,
      }
    })
    const placesNeeded = teams.reduce((sum, team) => sum + (team.needed ?? 0), 0)

    let status: SlotStatus
    let shortBy = 0
    let split: SplitEntry[] = []
    if (teams.some((team) => !team.hasPoll)) {
      status = 'NO_POLL'
    } else if (teams.some((team) => team.needed === null)) {
      status = 'NO_XI_SIZE'
    } else if (teams.length === 1) {
      const [only] = teams
      const needed = only.needed as number
      if (only.available >= needed) {
        status = 'COVERED'
      } else {
        status = 'SHORT'
        shortBy = needed - only.available
      }
    } else {
      const { matched } = maxMatching(
        teamsWork.map((team) => ({ teamId: team.teamId, needed: team.needed as number, availableIds: team.availableIds })),
      )
      if (matched < placesNeeded) {
        status = 'SHORT'
        shortBy = placesNeeded - matched
      } else if (teams.every((team) => team.ownOnly >= (team.needed as number))) {
        status = 'COVERED'
      } else {
        status = 'TIGHT'
        split = teams
          .map((team) => ({ teamId: team.teamId, shortfall: Math.max(0, (team.needed as number) - team.ownOnly) }))
          .filter((entry) => entry.shortfall > 0)
      }
    }

    return {
      key: `${slot.dateKey}|${slot.dayPart}`,
      date: slot.date,
      dayPart: slot.dayPart,
      games,
      teams,
      distinctAvailable: distinct.size,
      placesNeeded,
      sharedIds,
      distinctUnsure: unsureAnywhere.size,
      status,
      shortBy,
      split,
      spare: status === 'COVERED' || status === 'TIGHT' ? distinct.size - placesNeeded : 0,
    }
  })
}

export interface HintPart {
  text: string
  bold?: boolean
}

export function hintToString(parts: HintPart[]): string {
  return parts.map((part) => part.text).join('')
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function playersWord(count: number): string {
  return count === 1 ? 'player' : 'players'
}

// docs/specs/074 section 4.6: the Tight / Short hint as bold-marked parts, or null for any other
// status. `compact` is the phone wording of the Tight hint (Short has one wording).
export function slotHint(slot: SlotCoverage, teamName: (teamId: string) => string, compact = false): HintPart[] | null {
  if (slot.status === 'TIGHT') {
    const shared = slot.sharedIds.length
    const sharedNoun = `${shared} shared ${playersWord(shared)}`
    const spare = slot.spare > 0 ? ` (${slot.spare} spare)` : ''
    if (compact) {
      const list = slot.split.map((entry) => `${entry.shortfall} to ${teamName(entry.teamId)}`).join(', ')
      return [{ text: `Split the ${sharedNoun}: ${list}.` }]
    }
    if (slot.split.length === 1) {
      const [entry] = slot.split
      return [
        { text: 'Works only if ' },
        { text: `${entry.shortfall} of the ${sharedNoun}`, bold: true },
        { text: ` ${shared === 1 ? 'goes' : 'go'} to ${teamName(entry.teamId)}${spare}.` },
      ]
    }
    return [
      { text: `Works only if the ${sharedNoun} ${shared === 1 ? 'is' : 'are'} split: ` },
      { text: slot.split.map((entry) => `${entry.shortfall} to ${teamName(entry.teamId)}`).join(', '), bold: true },
      { text: `${spare}.` },
    ]
  }

  if (slot.status === 'SHORT') {
    const chase = { text: `Chase ${slot.shortBy} more ${playersWord(slot.shortBy)}.`, bold: true }
    if (slot.teams.length === 1) {
      const [only] = slot.teams
      return [
        { text: teamName(only.teamId), bold: true },
        { text: ` has ${only.available} available and needs ${only.needed}. ` },
        chase,
      ]
    }
    const parts: HintPart[] = []
    const short = slot.teams.filter((team) => team.needed !== null && team.available < team.needed)
    if (short.length > 0) {
      for (const team of short) {
        parts.push({ text: `${teamName(team.teamId)} cannot reach ${team.needed}`, bold: true })
        parts.push({ text: ' even with every shared player. ' })
      }
      if (slot.sharedIds.length > 0) {
        const sharing = slot.teams.filter((team) => team.shared > 0).map((team) => teamName(team.teamId))
        const count = slot.sharedIds.length
        parts.push({
          text: `The ${count} shared ${playersWord(count)} ${count === 1 ? 'is' : 'are'} contended between ${joinNames(sharing)}. `,
        })
      }
    } else {
      const sharing = slot.teams.filter((team) => team.shared > 0).map((team) => teamName(team.teamId))
      parts.push({ text: joinNames(sharing), bold: true })
      parts.push({
        text: ` need more distinct players than are available: the ${slot.sharedIds.length} shared ${playersWord(
          slot.sharedIds.length,
        )} cannot fill ${
          sharing.length === 2 ? 'both' : 'all'
        } XIs. `,
      })
    }
    parts.push(chase)
    return parts
  }

  return null
}
