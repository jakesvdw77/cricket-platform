import type { BattingEntry, ResultPlayer, ResultSide, ScorecardPrefillPlayer, ScorecardPrefillSide } from '../api/matchResultApi'
import { initialRows } from './wicketFill'

// docs/specs/101-match-results-our-side-scorecard.md (Our batting, "Pre-fill"): turns the team selection
// (GET .../scorecard/prefill) into the rows of the batting grid. Built locally; nothing is written until a save.

export const LINEUP_SIZE = 11

let keyCounter = 0
// A client key for a new row (entries refer to a new player by it until the server gives the player an id).
export function newClientKey(): string {
  keyCounter += 1
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}-${keyCounter}`
  return random
}

// The key a row is known by in the form: the stored id, else the client key.
export const playerRowKey = (player: Pick<ResultPlayer, 'id' | 'clientKey'>): string => (player.id ?? player.clientKey) as string

// The player an entry belongs to, by the same key.
export const entryPlayerKey = (entry: { resultPlayerId?: string | null; playerClientKey?: string | null }): string | null =>
  entry.resultPlayerId ?? entry.playerClientKey ?? null

// The reference an entry for `player` carries: the id of a stored player, the client key of a new one.
export const entryRefOf = (player: Pick<ResultPlayer, 'id' | 'clientKey'>) =>
  player.id ? { resultPlayerId: player.id, playerClientKey: null } : { resultPlayerId: null, playerClientKey: player.clientKey ?? null }

export interface SideRows {
  players: ResultPlayer[]
  batting: BattingEntry[]
}

export function resultPlayerFromPrefill(
  side: ResultSide,
  player: ScorecardPrefillPlayer,
  makeKey: () => string = newClientKey,
): ResultPlayer {
  return {
    clientKey: makeKey(),
    side,
    playerProfileId: player.playerProfileId,
    displayName: null,
    plannedBattingOrder: player.plannedBattingOrder,
    replacedPlayerProfileId: null,
    substitute: player.substitute,
    firstName: player.firstName,
    lastName: player.lastName,
    guest: false,
  }
}

export function blankBattingEntry(side: ResultSide, player: Pick<ResultPlayer, 'id' | 'clientKey'>, position: number): BattingEntry {
  return {
    battingSide: side,
    inningsKind: 'REGULAR',
    ...entryRefOf(player),
    position,
    howOut: null,
    runs: null,
    balls: null,
    fours: null,
    sixes: null,
    featuredOverride: null,
  }
}

// The proposed lines in batting order: players with a planned order first (by it), then those without, with the 12th man
// (a substitute) last. The server already sends them this way; this keeps the rule in one place for a re-sort.
export function lineupOrder(input: ScorecardPrefillPlayer[]): ScorecardPrefillPlayer[] {
  // One profile is one result player: a profile listed twice (the 12th man also in the selection) keeps its first entry,
  // flagged as a substitute if either entry was.
  const seen = new Map<string, ScorecardPrefillPlayer>()
  const players: ScorecardPrefillPlayer[] = []
  for (const player of input) {
    const earlier = seen.get(player.playerProfileId)
    if (!earlier) {
      seen.set(player.playerProfileId, player)
      players.push(player)
    } else if (player.substitute && !earlier.substitute) {
      const merged = { ...earlier, substitute: true, plannedBattingOrder: null }
      players[players.indexOf(earlier)] = merged
      seen.set(player.playerProfileId, merged)
    }
  }
  const rank = (player: ScorecardPrefillPlayer) => (player.substitute ? 2 : player.plannedBattingOrder == null ? 1 : 0)
  const sorted = players
    .map((player, index) => ({ player, index }))
    .sort(
      (a, b) =>
        rank(a.player) - rank(b.player) ||
        (a.player.plannedBattingOrder ?? 0) - (b.player.plannedBattingOrder ?? 0) ||
        a.index - b.index,
    )
    .map(({ player }) => player)
  // The eleven are the first LINEUP_SIZE batting positions; anyone beyond them is listed after as a substitute.
  let batting = 0
  return sorted.map((player) => {
    if (player.substitute) return player
    batting += 1
    return batting > LINEUP_SIZE ? { ...player, substitute: true } : player
  })
}

// The grid of one ours side as first opened: a row per player in the planned order, the first `wickets + 2` as batted
// (undecided) and the rest as Did not bat; a substitute (the 12th man) is listed as a player with no batting row. An
// empty selection gives empty rows (the grid starts empty and the add control is open).
export function prefillSideRows(
  side: ScorecardPrefillSide,
  wickets: number | null,
  makeKey: () => string = newClientKey,
): SideRows {
  const ordered = lineupOrder(side.players)
  const players = ordered.map((player) => resultPlayerFromPrefill(side.side, player, makeKey))
  const lineup = players.filter((player) => !player.substitute)
  const fill = initialRows(lineup.length, wickets)
  const batting = lineup.map((player, index) => ({
    ...blankBattingEntry(side.side, player, index + 1),
    howOut: fill[index].howOut,
    auto: fill[index].auto ?? false,
  }))
  return { players, batting }
}

// "Reset to selection": adds the planned players that are missing (as Did not bat, after the existing rows) and
// re-snapshots every present planned player's planned order. It never removes or changes an entered row.
export function resetToSelection(
  current: SideRows,
  side: ScorecardPrefillSide,
  makeKey: () => string = newClientKey,
): SideRows {
  const planned = new Map(side.players.map((player) => [player.playerProfileId, player]))
  const players = current.players.map((player) => {
    const proposal = player.playerProfileId ? planned.get(player.playerProfileId) : undefined
    return proposal ? { ...player, plannedBattingOrder: proposal.plannedBattingOrder } : player
  })
  const present = new Set(players.map((player) => player.playerProfileId).filter(Boolean))
  const added = lineupOrder(side.players)
    .filter((player) => !present.has(player.playerProfileId))
    .map((player) => resultPlayerFromPrefill(side.side, player, makeKey))
  const batting = [...current.batting]
  let position = batting.reduce((max, entry) => Math.max(max, entry.position ?? 0), 0)
  for (const player of added) {
    if (player.substitute) continue
    position += 1
    batting.push({ ...blankBattingEntry(side.side, player, position), howOut: 'DID_NOT_BAT', auto: true })
  }
  return { players: [...players, ...added], batting }
}
