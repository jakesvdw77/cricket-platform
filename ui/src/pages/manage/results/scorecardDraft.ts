import type {
  AwardType,
  Innings,
  ScorecardPrefillSide,
  BattingEntry,
  BowlingEntry,
  DismissalType,
  FieldingEntry,
  MatchAward,
  ResultDraft,
  ResultPlayer,
  ResultSide,
  Scorecard,
} from '../../../api/matchResultApi'
import type { PickedPlayer } from '../../../components/PlayerSlotPicker'
import { scorecardPersonName } from '../../../utils/playerDisplayName'
import type { RemoveKind } from './scorecard/usePlayerActions'
import { isWicket } from '../../../utils/dismissal'
import { extrasTotal, hasExtras } from '../../../utils/battingTotals'
import { canFeatureBatter, canFeatureBowler } from '../../../utils/standout'
import { blankBattingEntry, entryPlayerKey, entryRefOf, newClientKey, playerRowKey, prefillSideRows } from '../../../utils/scorecardPrefill'

const opposite = (side: ResultSide): ResultSide => (side === 'HOME' ? 'AWAY' : 'HOME')

// docs/specs/101-match-results-our-side-scorecard.md: pure edits of the scorecard the capture wizard holds in its draft.
// Every function returns a new Scorecard. Entries refer to their player by key (the stored id, else the client key of a
// row that has not been saved yet); a batting entry's `battingSide` is the side that batted (ours), a bowling or fielding
// entry's `battingSide` is the OTHER side (the one that batted against our bowlers), so our bowlers of side X are the
// entries whose battingSide is opposite(X).

export const emptyScorecard = (): Scorecard => ({ players: [], batting: [], bowling: [], fielding: [], awards: [] })
export const scorecardOf = (draft: Pick<ResultDraft, 'scorecard'>): Scorecard => draft.scorecard ?? emptyScorecard()

export const withScorecard = (draft: ResultDraft, scorecard: Scorecard): ResultDraft => ({ ...draft, scorecard })

// ---- reading ----

export const playersOfSide = (scorecard: Scorecard, side: ResultSide): ResultPlayer[] =>
  scorecard.players.filter((player) => player.side === side)

export const playersByKey = (scorecard: Scorecard): Map<string, ResultPlayer> =>
  new Map(scorecard.players.map((player) => [playerRowKey(player), player]))

// Stable sort by a nullable order, nulls last.
function sortedBy<T>(rows: T[], order: (row: T) => number | null | undefined): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const left = order(a.row)
      const right = order(b.row)
      if (left == null && right == null) return a.index - b.index
      if (left == null) return 1
      if (right == null) return -1
      return left - right || a.index - b.index
    })
    .map(({ row }) => row)
}

// The side's batters in batting order.
export const battingOf = (scorecard: Scorecard, side: ResultSide): BattingEntry[] =>
  sortedBy(
    scorecard.batting.filter((entry) => entry.battingSide === side),
    (entry) => entry.position,
  )

// Our bowlers of side `ours` in bowling order (they bowled in the innings the other side batted).
export const bowlingOf = (scorecard: Scorecard, ours: ResultSide): BowlingEntry[] =>
  sortedBy(
    scorecard.bowling.filter((entry) => entry.battingSide === opposite(ours)),
    (entry) => entry.bowlingOrder,
  )

export const fieldingOf = (scorecard: Scorecard, ours: ResultSide): FieldingEntry[] =>
  scorecard.fielding.filter((entry) => entry.battingSide === opposite(ours))

export const hasCredit = (entry: FieldingEntry): boolean => (entry.catches ?? 0) + (entry.stumpings ?? 0) + (entry.runOuts ?? 0) > 0

export const hasBowlingFigures = (entry: BowlingEntry): boolean =>
  [entry.balls, entry.maidens, entry.runs, entry.wickets, entry.wides, entry.noBalls].some((value) => value != null)

// ---- batting rows ----

const renumberBatting = (rows: BattingEntry[]): BattingEntry[] => rows.map((entry, index) => ({ ...entry, position: index + 1 }))

// Replaces the side's batters with `rows` (in order, numbered 1..n).
export function setBatting(scorecard: Scorecard, side: ResultSide, rows: BattingEntry[]): Scorecard {
  return { ...scorecard, batting: [...scorecard.batting.filter((entry) => entry.battingSide !== side), ...renumberBatting(rows)] }
}

export function patchBatting(scorecard: Scorecard, key: string, patch: Partial<BattingEntry>): Scorecard {
  // A row that can no longer be featured (Did not bat, no runs) drops any star the manager had set.
  const apply = (entry: BattingEntry): BattingEntry => {
    const next = { ...entry, ...patch }
    return canFeatureBatter(next) ? next : { ...next, featuredOverride: null }
  }
  return { ...scorecard, batting: scorecard.batting.map((entry) => (entryPlayerKey(entry) === key ? apply(entry) : entry)) }
}

export function patchBowling(scorecard: Scorecard, key: string, patch: Partial<BowlingEntry>): Scorecard {
  const apply = (entry: BowlingEntry): BowlingEntry => {
    const next = { ...entry, ...patch }
    return canFeatureBowler(next) ? next : { ...next, featuredOverride: null }
  }
  return { ...scorecard, bowling: scorecard.bowling.map((entry) => (entryPlayerKey(entry) === key ? apply(entry) : entry)) }
}

// Replaces our bowlers of `ours` with `rows` in order (bowlingOrder 1..n).
export function setBowling(scorecard: Scorecard, ours: ResultSide, rows: BowlingEntry[]): Scorecard {
  return {
    ...scorecard,
    bowling: [
      ...scorecard.bowling.filter((entry) => entry.battingSide !== opposite(ours)),
      ...rows.map((entry, index) => ({ ...entry, bowlingOrder: index + 1 })),
    ],
  }
}

export function blankBowlingEntry(ours: ResultSide, player: Pick<ResultPlayer, 'id' | 'clientKey'>, order: number): BowlingEntry {
  return {
    battingSide: opposite(ours),
    inningsKind: 'REGULAR',
    ...entryRefOf(player),
    bowlingOrder: order,
    balls: null,
    maidens: null,
    runs: null,
    wickets: null,
    wides: null,
    noBalls: null,
    featuredOverride: null,
  }
}

// A fielding counter moved by `delta` (never below 0). The row is created on the first credit; a row back at no credits
// stays in the form and is dropped from the save.
export function bumpFielding(
  scorecard: Scorecard,
  ours: ResultSide,
  player: Pick<ResultPlayer, 'id' | 'clientKey'>,
  field: 'catches' | 'stumpings' | 'runOuts',
  delta: 1 | -1,
): Scorecard {
  const key = playerRowKey(player)
  const existing = scorecard.fielding.find((entry) => entryPlayerKey(entry) === key)
  if (!existing) {
    if (delta < 0) return scorecard
    const created: FieldingEntry = {
      battingSide: opposite(ours),
      inningsKind: 'REGULAR',
      ...entryRefOf(player),
      catches: 0,
      stumpings: 0,
      runOuts: 0,
      featuredOverride: null,
      [field]: 1,
    }
    return { ...scorecard, fielding: [...scorecard.fielding, created] }
  }
  return {
    ...scorecard,
    fielding: scorecard.fielding.map((entry) =>
      entryPlayerKey(entry) === key ? { ...entry, [field]: Math.max(0, (entry[field] ?? 0) + delta) } : entry,
    ),
  }
}

export function patchFielding(scorecard: Scorecard, key: string, patch: Partial<FieldingEntry>): Scorecard {
  return { ...scorecard, fielding: scorecard.fielding.map((entry) => (entryPlayerKey(entry) === key ? { ...entry, ...patch } : entry)) }
}

// ---- players ----

// Who a row is: a registered player (profile + names) or a guest (a typed name only).
export interface PlayerIdentity {
  playerProfileId: string | null
  firstName?: string | null
  lastName?: string | null
  displayName?: string | null
}

const identityFields = (identity: PlayerIdentity) => ({
  playerProfileId: identity.playerProfileId,
  displayName: identity.playerProfileId ? null : (identity.displayName ?? null),
  firstName: identity.playerProfileId ? (identity.firstName ?? null) : null,
  lastName: identity.playerProfileId ? (identity.lastName ?? null) : null,
  guest: !identity.playerProfileId,
})

// Adds a player to a side. A registered player who is already there as a substitute (the 12th man) is promoted instead
// of added twice. A batting row is created for every non-substitute player so the batting list is the whole line-up.
export function addPlayer(
  scorecard: Scorecard,
  side: ResultSide,
  identity: PlayerIdentity,
  howOut: DismissalType | null,
): { scorecard: Scorecard; key: string } {
  const sub = identity.playerProfileId
    ? scorecard.players.find((player) => player.side === side && player.substitute && player.playerProfileId === identity.playerProfileId)
    : undefined
  // A registered player (or a guest name) already on the side is never added twice.
  const already = scorecard.players.find(
    (player) =>
      player.side === side &&
      !player.substitute &&
      (identity.playerProfileId
        ? player.playerProfileId === identity.playerProfileId
        : !player.playerProfileId && (player.displayName ?? '').trim().toLowerCase() === (identity.displayName ?? '').trim().toLowerCase()),
  )
  if (already) return { scorecard, key: playerRowKey(already) }
  let players = scorecard.players
  let player: ResultPlayer
  if (sub) {
    player = { ...sub, substitute: false }
    players = players.map((candidate) => (candidate === sub ? player : candidate))
  } else {
    player = {
      clientKey: newClientKey(),
      side,
      plannedBattingOrder: null,
      replacedPlayerProfileId: null,
      substitute: false,
      ...identityFields(identity),
    }
    players = [...players, player]
  }
  const position = battingOf(scorecard, side).length + 1
  const entry = { ...blankBattingEntry(side, player, position), howOut, auto: howOut === 'DID_NOT_BAT' }
  return { scorecard: { ...scorecard, players, batting: [...scorecard.batting, entry] }, key: playerRowKey(player) }
}

// Drops a player and everything that refers to them (their rows and any award).
export function removePlayer(scorecard: Scorecard, key: string): Scorecard {
  const keep = <T extends { resultPlayerId?: string | null; playerClientKey?: string | null }>(entry: T) => entryPlayerKey(entry) !== key
  const players = scorecard.players.filter((player) => playerRowKey(player) !== key)
  const side = scorecard.players.find((player) => playerRowKey(player) === key)?.side
  const next: Scorecard = {
    ...scorecard,
    players,
    batting: scorecard.batting.filter(keep),
    bowling: scorecard.bowling.filter(keep),
    fielding: scorecard.fielding.filter(keep),
    awards: scorecard.awards.filter(keep),
  }
  return side ? setBatting(next, side, battingOf(next, side)) : next
}

// Swap player...: the row keeps its figures (they point at the player, and the player keeps its key) while WHO it is
// changes. The selected player who was swapped out is remembered in replacedPlayerProfileId. A registered player who is
// already on the side as an unused substitute (the 12th man) steps into the row; that substitute entry goes.
export function swapPlayer(scorecard: Scorecard, key: string, identity: PlayerIdentity): Scorecard {
  const current = scorecard.players.find((player) => playerRowKey(player) === key)
  if (!current) return scorecard
  // Swapping onto someone already playing for the side would put them on the scorecard twice: refused.
  if (
    identity.playerProfileId &&
    scorecard.players.some((player) => player.side === current.side && !player.substitute && playerRowKey(player) !== key && player.playerProfileId === identity.playerProfileId)
  ) {
    return scorecard
  }
  const sub = identity.playerProfileId
    ? scorecard.players.find(
        (player) =>
          player.side === current.side &&
          player.substitute &&
          player.playerProfileId === identity.playerProfileId &&
          playerRowKey(player) !== key,
      )
    : undefined
  const base = sub ? removePlayer(scorecard, playerRowKey(sub)) : scorecard
  return {
    ...base,
    players: base.players.map((player) =>
      playerRowKey(player) === key
        ? {
            ...player,
            ...identityFields(identity),
            // The first person swapped out stays the one remembered ("planned X, Y played"); a guest swapped out is not a
            // selected player.
            replacedPlayerProfileId: player.replacedPlayerProfileId ?? player.playerProfileId,
            linkedBy: null,
            linkedAt: null,
          }
        : player,
    ),
  }
}

// Link to a registered player...: a guest row becomes the registered player. The typed name stays as written (an audit of
// what was typed) and nothing is recorded as replaced.
export function linkGuest(scorecard: Scorecard, key: string, identity: PlayerIdentity): Scorecard {
  return {
    ...scorecard,
    players: scorecard.players.map((player) =>
      playerRowKey(player) === key
        ? {
            ...player,
            playerProfileId: identity.playerProfileId,
            firstName: identity.firstName ?? null,
            lastName: identity.lastName ?? null,
            guest: false,
          }
        : player,
    ),
  }
}

// ---- awards ----

export const officialAward = (scorecard: Scorecard): MatchAward | undefined =>
  scorecard.awards.find((award) => award.awardType === 'PLAYER_OF_MATCH')

export const teamAward = (scorecard: Scorecard, side: ResultSide): MatchAward | undefined =>
  scorecard.awards.find((award) => award.awardType === 'TEAM_PLAYER_OF_MATCH' && award.side === side)

// Sets (or, with null, clears) the one award of its kind (per side for the team award).
export function setAward(scorecard: Scorecard, type: AwardType, side: ResultSide | null, award: MatchAward | null): Scorecard {
  const others = scorecard.awards.filter((candidate) =>
    type === 'PLAYER_OF_MATCH' ? candidate.awardType !== type : !(candidate.awardType === type && candidate.side === side),
  )
  return { ...scorecard, awards: award ? [...others, award] : others }
}

// ---- loading and saving ----

// A scorecard as loaded from the server, ready to edit: every non-substitute player has a batting row (a player whose
// row was undecided is not stored, so it comes back as an undecided row at the end) and batting positions are 1..n.
export function normalizeLoaded(scorecard: Scorecard): Scorecard {
  let next = scorecard
  for (const side of ['HOME', 'AWAY'] as const) {
    const present = new Set(battingOf(next, side).map((entry) => entryPlayerKey(entry)))
    const missing = playersOfSide(next, side).filter((player) => !player.substitute && !present.has(playerRowKey(player)))
    // A player who bowls or fields but never had a batting row (a promoted 12th man) did not bat; anyone else is undecided.
    const plays = (player: ResultPlayer) =>
      next.bowling.some((entry) => entryPlayerKey(entry) === playerRowKey(player)) || next.fielding.some((entry) => entryPlayerKey(entry) === playerRowKey(player))
    const rows = [
      ...battingOf(next, side),
      ...missing.map((player) => (plays(player) ? { ...blankBattingEntry(side, player, 0), howOut: 'DID_NOT_BAT' as const } : blankBattingEntry(side, player, 0))),
    ]
    if (rows.length > 0) next = setBatting(next, side, rows)
  }
  return next
}

// The server's identity of one of the draft's players: the stored id, else the profile (or the typed name) on the side.
function matchServerPlayer(player: ResultPlayer, server: ResultPlayer[]): ResultPlayer | undefined {
  if (player.id) return server.find((candidate) => candidate.id === player.id)
  const name = (player.displayName ?? '').trim().toLowerCase()
  return server.find(
    (candidate) =>
      candidate.side === player.side &&
      (player.playerProfileId
        ? candidate.playerProfileId === player.playerProfileId
        : !candidate.playerProfileId && (candidate.displayName ?? '').trim().toLowerCase() === name),
  )
}

// After a save: copies the server's suggested / featured flags onto the draft's entries (the rules run on the server, the
// form never recomputes them). Matched through the player; nothing else of the draft is touched.
export function mergeSuggestions(draft: Scorecard, server: Scorecard): Scorecard {
  const serverKeyOf = new Map<string, string>()
  for (const player of draft.players) {
    const match = matchServerPlayer(player, server.players)
    if (match?.id) serverKeyOf.set(playerRowKey(player), match.id)
  }
  const flagsFor = <T extends { resultPlayerId?: string | null; playerClientKey?: string | null; battingSide: ResultSide; suggested?: boolean | null; featured?: boolean | null }>(
    entry: T,
    candidates: T[],
  ): T => {
    const serverId = serverKeyOf.get(entryPlayerKey(entry) ?? '')
    const found = serverId ? candidates.find((candidate) => candidate.resultPlayerId === serverId && candidate.battingSide === entry.battingSide) : undefined
    return found ? { ...entry, suggested: found.suggested ?? false, featured: found.featured ?? null } : entry
  }
  return {
    ...draft,
    batting: draft.batting.map((entry) => flagsFor(entry, server.batting)),
    bowling: draft.bowling.map((entry) => flagsFor(entry, server.bowling)),
    fielding: draft.fielding.map((entry) => flagsFor(entry, server.fielding)),
  }
}

// ---- status ----

export type SideStatus = 'NONE' | 'PARTIAL' | 'COMPLETE'

// Mirrors the server's per-side status (ScorecardServiceImpl.statuses) on the unsaved draft: none without players,
// complete when the side has batting rows and bowling rows for the innings it played in, else partial.
export function sideStatus(draft: ResultDraft, side: ResultSide): SideStatus {
  const scorecard = scorecardOf(draft)
  if (playersOfSide(scorecard, side).length === 0) return 'NONE'
  const innings = (draft.innings ?? []).filter((item) => item.kind !== 'SUPER_OVER')
  const batted = innings.some((item) => item.battingSide === side && item.runs !== null)
  const bowled = innings.some((item) => item.battingSide === opposite(side) && item.runs !== null)
  const hasBatting = battingOf(scorecard, side).some((entry) => entry.howOut !== null && entry.howOut !== 'DID_NOT_BAT')
  const hasBowling = bowlingOf(scorecard, side).some(hasBowlingFigures)
  return (!batted || hasBatting) && (!bowled || hasBowling) ? 'COMPLETE' : 'PARTIAL'
}

// A scorecard step with something still to enter for `side`, for the dot on its Home | Away tab: the innings it concerns
// has runs, and there are no rows yet or (batting) a batter's how out is still undecided.
export function stepIncomplete(draft: ResultDraft, side: ResultSide, step: 'batting' | 'bowling'): boolean {
  const scorecard = scorecardOf(draft)
  const innings = (draft.innings ?? []).filter((item) => item.kind !== 'SUPER_OVER')
  if (step === 'batting') {
    if (!innings.some((item) => item.battingSide === side && item.runs !== null)) return false
    const rows = battingOf(scorecard, side)
    return rows.length === 0 || rows.some((entry) => entry.howOut === null)
  }
  if (!innings.some((item) => item.battingSide === opposite(side) && item.runs !== null)) return false
  return !bowlingOf(scorecard, side).some(hasBowlingFigures)
}

// ---- pre-fill ----

// First open of a side: its players and batting rows from the team selection (nothing is written until a save). Null when
// the side already has players or the selection is empty.
export function ensureSideFromPrefill(scorecard: Scorecard, prefillSide: ScorecardPrefillSide | null, wickets: number | null): Scorecard | null {
  if (!prefillSide || prefillSide.players.length === 0) return null
  if (scorecard.players.some((player) => player.side === prefillSide.side)) return null
  const built = prefillSideRows(prefillSide, wickets)
  return { ...scorecard, players: [...scorecard.players, ...built.players], batting: [...scorecard.batting, ...built.batting] }
}

// First open of Our bowling: the line-up's bowlers and all-rounders as blank bowling rows, in batting order. Null when the
// side already has bowling rows or no selected player bowls.
export function prefillBowlers(scorecard: Scorecard, ours: ResultSide, prefillSide: ScorecardPrefillSide | null): Scorecard | null {
  if (!prefillSide || bowlingOf(scorecard, ours).length > 0) return null
  const roles = new Map(prefillSide.players.map((player) => [player.playerProfileId, player.role]))
  const bowlers = battingOf(scorecard, ours)
    .map((entry) => scorecard.players.find((player) => playerRowKey(player) === entryPlayerKey(entry)))
    .filter((player): player is ResultPlayer => Boolean(player?.playerProfileId) && !player?.substitute)
    .filter((player) => {
      const role = roles.get(player.playerProfileId as string)
      return role === 'BOWLER' || role === 'ALL_ROUNDER'
    })
  if (bowlers.length === 0) return null
  return setBowling(scorecard, ours, bowlers.map((player, index) => blankBowlingEntry(ours, player, index + 1)))
}

// The keys of players that appear twice on a side (the same registered profile, or the same guest name), so both rows can
// be marked "Duplicate" instead of leaving the manager to hunt for what the server refused.
export function duplicatePlayerKeys(scorecard: Scorecard, side: ResultSide): Set<string> {
  const groups = new Map<string, string[]>()
  for (const player of scorecard.players) {
    if (player.side !== side) continue
    const id = player.playerProfileId ? `p:${player.playerProfileId}` : player.displayName ? `g:${player.displayName.trim().toLowerCase()}` : null
    if (id) groups.set(id, [...(groups.get(id) ?? []), playerRowKey(player)])
  }
  return new Set([...groups.values()].filter((keys) => keys.length > 1).flat())
}

// ---- innings figures suggested by the scorecard ----

export interface InningsSuggestion {
  runs: number | null
  wickets: number | null
  balls: number | null
  // The extras the bowlers' own wides and no-balls add up to (null when no bowler has them entered).
  wides: number | null
  noBalls: number | null
}

// What the scorecard adds up to for each regular innings (by sequence), for Scores and margin to offer where a figure is
// empty or disagrees. Our batting: runs = the batters' runs + the extras, wickets = the batters out. Else our bowling
// (the innings the other side batted): runs = bowlers' runs + byes + leg byes + penalty, wickets = bowlers' wickets + the
// wickets not credited to a bowler. Balls always come from our bowlers' balls, when there are any. Nothing is suggested
// from an empty scorecard.
export function inningsSuggestions(draft: ResultDraft): Map<number, InningsSuggestion> {
  const scorecard = scorecardOf(draft)
  const out = new Map<number, InningsSuggestion>()
  for (const innings of (draft.innings ?? []).filter((item) => item.kind !== 'SUPER_OVER')) {
    if (!innings.battingSide || innings.sequence == null) continue
    const batters = battingOf(scorecard, innings.battingSide).filter((entry) => entry.howOut !== null && entry.howOut !== 'DID_NOT_BAT')
    const bowlers = bowlingOf(scorecard, opposite(innings.battingSide)).filter(hasBowlingFigures)
    const n = (value: number | null | undefined) => value ?? 0
    let runs: number | null = null
    let wickets: number | null = null
    const hasRuns = batters.some((entry) => entry.runs != null)
    if (batters.length > 0 && (hasRuns || hasExtras(innings) || batters.some((entry) => isWicket(entry.howOut)))) {
      runs = hasRuns || hasExtras(innings) ? batters.reduce((sum, entry) => sum + n(entry.runs), 0) + extrasTotal(innings) : null
      wickets = batters.length > 0 ? batters.filter((entry) => isWicket(entry.howOut)).length : null
    } else if (bowlers.length > 0) {
      runs = bowlers.reduce((sum, entry) => sum + n(entry.runs), 0) + n(innings.byes) + n(innings.legByes) + n(innings.penaltyRuns)
      wickets = bowlers.reduce((sum, entry) => sum + n(entry.wickets), 0) + n(innings.nonBowlerWickets)
    }
    const balls = bowlers.reduce((sum, entry) => sum + n(entry.balls), 0)
    // Wides and no-balls are charged to the bowler: they are inside the bowlers' runs already (never added to the runs again)
    // and add up to the innings' wides and no-balls extras.
    const sum = (pick: (entry: BowlingEntry) => number | null | undefined) => (bowlers.some((entry) => pick(entry) != null) ? bowlers.reduce((total, entry) => total + n(pick(entry)), 0) : null)
    const wides = sum((entry) => entry.wides)
    const noBalls = sum((entry) => entry.noBalls)
    if (runs !== null || balls > 0 || wides !== null || noBalls !== null) out.set(innings.sequence, { runs, wickets, balls: balls > 0 ? balls : null, wides, noBalls })
  }
  return out
}

// ---- calculated innings figures, and the manager's corrections ----

export type InningsFigure = 'runs' | 'wickets' | 'balls' | 'wides' | 'noBalls'
const FLAG = { runs: 'runsCorrected', wickets: 'wicketsCorrected', balls: 'ballsCorrected', wides: 'widesCorrected', noBalls: 'noBallsCorrected' } as const

// The manager owns the wickets once they typed them (or they came from an earlier entry): typed wickets drive the
// not-out / did-not-bat fill and are not overwritten while entering the card. Only "Use calculated" (or clearing the
// field) hands them back to the scorecard.
export const wicketsOwned = (innings: Pick<Innings, 'wickets' | 'wicketsCorrected'>): boolean =>
  innings.wicketsCorrected === true || (innings.wicketsCorrected === undefined && innings.wickets != null)

// A figure the manager typed that disagrees with what the scorecard adds up to ("Corrected, was 187 from the scorecard").
export function figureCorrected(innings: Innings, field: InningsFigure, calculated: number | null | undefined): boolean {
  const value = innings[field] ?? null
  if (calculated == null || value === null || value === calculated) return false
  if (field === 'wickets') return wicketsOwned(innings)
  return innings[FLAG[field]] !== false
}

// Keeps the calculated figures of every regular innings in step with the scorecard after an edit: runs, wickets and balls
// follow the scorecard unless the manager corrected them. A corrected figure is left alone until it equals the
// calculation again (runs, balls) or "Use calculated" is clicked (wickets stay the manager's). Returns the same draft when
// nothing changes.
export function syncInningsFromScorecard(draft: ResultDraft): ResultDraft {
  const calculated = inningsSuggestions(draft)
  let changed = false
  const innings = (draft.innings ?? []).map((item) => {
    const calc = item.sequence != null ? calculated.get(item.sequence) : undefined
    if (!calc) return item
    let next = item
    for (const field of ['runs', 'wickets', 'balls', 'wides', 'noBalls'] as const) {
      const value = calc[field]
      if (value === null) continue
      if (field === 'wickets' ? wicketsOwned(next) : figureCorrected(next, field, value)) continue
      if (next[field] !== value || next[FLAG[field]] !== false) next = { ...next, [field]: value, [FLAG[field]]: false }
    }
    if (next !== item) changed = true
    return next
  })
  return changed ? { ...draft, innings } : draft
}

// The manager types a figure: it is theirs (flagged corrected) until it equals the calculation again or is cleared.
export function editInningsFigure(draft: ResultDraft, sequence: number, field: InningsFigure, value: number | null): ResultDraft {
  const patched = {
    ...draft,
    innings: (draft.innings ?? []).map((item) => (item.sequence === sequence ? { ...item, [field]: value, [FLAG[field]]: value !== null } : item)),
  }
  return syncInningsFromScorecard(patched)
}

// "Use calculated": hand the figure back to the scorecard.
export function applyCalculatedFigure(draft: ResultDraft, sequence: number, field: InningsFigure): ResultDraft {
  const patched = {
    ...draft,
    innings: (draft.innings ?? []).map((item) => (item.sequence === sequence ? { ...item, [field]: null, [FLAG[field]]: false } : item)),
  }
  return syncInningsFromScorecard(patched)
}

// ---- the match squad for the pickers ----

// The registered players of THIS match for one side: the team selection (with the 12th man) and anyone already on the
// side's scorecard list, deduped. With `bowlersFirst` (Add bowler, fielding) the selection's bowlers and all-rounders come
// first. Empty when no team was selected and nothing is on the list yet.
export function matchSquadFor(scorecard: Scorecard, side: ResultSide, prefillSide: ScorecardPrefillSide | null, bowlersFirst: boolean): PickedPlayer[] {
  const out = new Map<string, PickedPlayer & { rank: number }>()
  const rankOf = (role: string | null | undefined) => (bowlersFirst ? (role === 'BOWLER' || role === 'ALL_ROUNDER' ? 0 : 1) : 0)
  for (const player of prefillSide?.players ?? []) {
    out.set(player.playerProfileId, { playerProfileId: player.playerProfileId, firstName: player.firstName, lastName: player.lastName, rank: rankOf(player.role) })
  }
  for (const player of playersOfSide(scorecard, side)) {
    if (!player.playerProfileId || out.has(player.playerProfileId)) continue
    out.set(player.playerProfileId, { playerProfileId: player.playerProfileId, firstName: player.firstName ?? '', lastName: player.lastName ?? '', rank: bowlersFirst ? 1 : 0 })
  }
  return [...out.values()]
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => a.entry.rank - b.entry.rank || a.index - b.index)
    .map(({ entry: { rank: _rank, ...person } }) => person)
}

// ---- the side's list, the 12th man and safe removal ----

export interface MatchPlayer {
  key: string
  firstName: string
  lastName: string
  substitute: boolean
}

// Every result player of the side, whatever their batting status (Did not bat, the 12th man, substitutes, guests): the
// list Our bowling and fielding pick from. The selection's bowlers and all-rounders come first.
export function matchPlayersFor(scorecard: Scorecard, side: ResultSide, prefillSide: ScorecardPrefillSide | null): MatchPlayer[] {
  const roles = new Map((prefillSide?.players ?? []).map((player) => [player.playerProfileId, player.role]))
  const rank = (player: ResultPlayer) => {
    const role = player.playerProfileId ? roles.get(player.playerProfileId) : undefined
    return role === 'BOWLER' || role === 'ALL_ROUNDER' ? 0 : 1
  }
  return playersOfSide(scorecard, side)
    .map((player, index) => ({ player, index }))
    .sort((a, b) => rank(a.player) - rank(b.player) || a.index - b.index)
    .map(({ player }) => {
      const person = scorecardPersonName(player)
      return { key: playerRowKey(player), firstName: person.firstName, lastName: person.lastName, substitute: player.substitute }
    })
}

// A player has a part in the match once they batted (or are yet to be decided), bowled or fielded.
export function playsInMatch(scorecard: Scorecard, player: ResultPlayer): boolean {
  const key = playerRowKey(player)
  return (
    scorecard.batting.some((entry) => entryPlayerKey(entry) === key && entry.howOut !== 'DID_NOT_BAT') ||
    scorecard.bowling.some((entry) => entryPlayerKey(entry) === key && hasBowlingFigures(entry)) ||
    scorecard.fielding.some((entry) => entryPlayerKey(entry) === key && hasCredit(entry))
  )
}

// The selection's 12th man becomes a real player the moment they bat, bowl or field (so they count as a match played), and
// goes back to being the 12th man if all of that is taken away again. Nobody else is ever demoted.
export function reconcileSubstitutes(scorecard: Scorecard, selectionSubstitutes: ReadonlySet<string>): Scorecard {
  let changed = false
  const players = scorecard.players.map((player) => {
    const active = playsInMatch(scorecard, player)
    if (player.substitute && active) {
      changed = true
      return { ...player, substitute: false }
    }
    if (!player.substitute && !active && player.playerProfileId && selectionSubstitutes.has(player.playerProfileId)) {
      changed = true
      return { ...player, substitute: true }
    }
    return player
  })
  return changed ? { ...scorecard, players } : scorecard
}

// What the batting popup offers for taking `key` off the list. A player from the selection, or who bowls, fields or has an
// award, stays in the match squad: they are set to Did not bat instead. Only a manually added player with nothing else is
// removed.
export function removalOf(scorecard: Scorecard, key: string, selectionProfiles: ReadonlySet<string>, name: string): RemoveKind {
  const player = scorecard.players.find((candidate) => playerRowKey(candidate) === key)
  if (!player) return { kind: 'remove' }
  if (player.playerProfileId && selectionProfiles.has(player.playerProfileId)) return { kind: 'dnb' }
  const bowls = scorecard.bowling.some((entry) => entryPlayerKey(entry) === key)
  const fields = scorecard.fielding.some((entry) => entryPlayerKey(entry) === key)
  const award = scorecard.awards.some((entry) => entryPlayerKey(entry) === key)
  if (bowls || fields || award) {
    const what = [bowls ? 'bowls' : null, fields ? 'fields' : null, award ? 'has an award' : null].filter(Boolean).join('/')
    return { kind: 'blocked', message: `${name} also ${what} on this scorecard. Remove those first.` }
  }
  return { kind: 'remove' }
}

// Mark as 12th man / substitute (and back). A substitute has no batting row; a player brought back into the team gets a Did
// not bat row at the end.
export function setSubstitute(scorecard: Scorecard, key: string, substitute: boolean): Scorecard {
  const target = scorecard.players.find((player) => playerRowKey(player) === key)
  if (!target || target.substitute === substitute) return scorecard
  const players = scorecard.players.map((player) => (playerRowKey(player) === key ? { ...player, substitute } : player))
  const next = { ...scorecard, players }
  const rows = battingOf(next, target.side)
  if (substitute) return setBatting(next, target.side, rows.filter((entry) => entryPlayerKey(entry) !== key))
  if (rows.some((entry) => entryPlayerKey(entry) === key)) return next
  return setBatting(next, target.side, [...rows, { ...blankBattingEntry(target.side, target, rows.length + 1), howOut: 'DID_NOT_BAT', auto: true }])
}
