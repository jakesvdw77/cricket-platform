import type { AvailabilityCell, CellStatus, GameColumn, PlayerRow } from '../../../api/playerAvailabilityApi'
import type { DayPart } from '../../../api/sectionAvailabilityApi'
import { DAY_PART_LABEL } from '../../../utils/dayPart'
import { groupPollResponsesPath, squadPollResponsesPath } from '../../../utils/pollRoutes'

// docs/specs/068-player-availability-grid.md: the pure, unit-tested logic behind the grid -
// header grouping, footer totals, search/hide filtering, the next game and every label string.

// Generic over the column type so the Team selection Players grid (docs/specs/093) groups its matches the same way.
export interface DatedColumn {
  matchDate: string
  dayPart: DayPart
}

export interface SlotGroup<T extends DatedColumn = GameColumn> {
  dayPart: DayPart
  games: T[]
}

export interface DateGroup<T extends DatedColumn = GameColumn> {
  dateKey: string
  // Local midnight of the game day.
  date: Date
  slots: SlotGroup<T>[]
  gameCount: number
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_PART_ORDER: DayPart[] = ['MORNING', 'AFTERNOON']

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dateKeyOf(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

// Dates then Morning/Afternoon then games, keeping the server's order (date, then kickoff). A slot
// with no games is never created, so empty slots are omitted by construction.
export function groupGames<T extends DatedColumn = GameColumn>(games: T[]): DateGroup<T>[] {
  const groups: DateGroup<T>[] = []
  for (const game of games) {
    const gameDate = startOfDay(new Date(game.matchDate))
    const key = dateKeyOf(gameDate)
    let group = groups.find((candidate) => candidate.dateKey === key)
    if (!group) {
      group = { dateKey: key, date: gameDate, slots: [], gameCount: 0 }
      groups.push(group)
    }
    let slot = group.slots.find((candidate) => candidate.dayPart === game.dayPart)
    if (!slot) {
      slot = { dayPart: game.dayPart, games: [] }
      group.slots.push(slot)
    }
    slot.games.push(game)
    group.gameCount += 1
  }
  for (const group of groups) {
    group.slots.sort((a, b) => DAY_PART_ORDER.indexOf(a.dayPart) - DAY_PART_ORDER.indexOf(b.dayPart))
  }
  return groups
}

// The games in the same left-to-right order the grouped header lays them out.
export function orderedGames<T extends DatedColumn = GameColumn>(groups: DateGroup<T>[]): T[] {
  return groups.flatMap((group) => group.slots.flatMap((slot) => slot.games))
}

export interface FooterCounts {
  available: number
  unsure: number
  unavailable: number
}

export function cellFor(player: PlayerRow, matchId: string): AvailabilityCell | undefined {
  return player.cells.find((cell) => cell.matchId === matchId)
}

// Counted from the rows passed in (the visible ones), so the totals follow search and hiding.
export function footerCounts(players: PlayerRow[], matchId: string): FooterCounts {
  const counts: FooterCounts = { available: 0, unsure: 0, unavailable: 0 }
  for (const player of players) {
    const status = cellFor(player, matchId)?.status
    if (status === 'AVAILABLE') counts.available += 1
    else if (status === 'UNSURE') counts.unsure += 1
    else if (status === 'UNAVAILABLE') counts.unavailable += 1
  }
  return counts
}

export function footerText(counts: FooterCounts): string {
  return `${counts.available} / ${counts.unsure} / ${counts.unavailable}`
}

export function footerLabel(counts: FooterCounts): string {
  return `${counts.available} available, ${counts.unsure} unsure, ${counts.unavailable} unavailable`
}

const ANSWERED: CellStatus[] = ['AVAILABLE', 'UNSURE', 'UNAVAILABLE']

export function hasAnswers(player: PlayerRow): boolean {
  return player.cells.some((cell) => ANSWERED.includes(cell.status))
}

export function playerFullName(player: Pick<PlayerRow, 'firstName' | 'lastName'>): string {
  return `${player.firstName} ${player.lastName}`.trim()
}

export function filterPlayers(
  players: PlayerRow[],
  { search, hideUnanswered }: { search: string; hideUnanswered: boolean },
): PlayerRow[] {
  const term = search.trim().toLowerCase()
  return players.filter((player) => {
    if (hideUnanswered && !hasAnswers(player)) return false
    return !term || playerFullName(player).toLowerCase().includes(term)
  })
}

// The first game (in the server's order) kicking off at or after `now`, or undefined.
export function firstUpcomingGame(games: GameColumn[], now: Date): GameColumn | undefined {
  return games.find((game) => new Date(game.matchDate).getTime() >= now.getTime())
}

export function dateHeading(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

export function kickoffText(matchDate: string): string {
  const date = new Date(matchDate)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function slotLabel(dayPart: DayPart, short = false): string {
  return short ? (dayPart === 'MORNING' ? 'AM' : 'PM') : DAY_PART_LABEL[dayPart]
}

// Marks the next game day only: 'Today' / 'Tomorrow' when it is, else 'Next game day'. Every
// other date, and every date once the games are all in the past, gets none.
export function nextGameDayMarker(groups: DateGroup<DatedColumn>[], now: Date): { dateKey: string; text: string } | null {
  const today = startOfDay(now)
  const next = groups.find((group) => group.date.getTime() >= today.getTime())
  if (!next) return null
  const dayDiff = Math.round((next.date.getTime() - today.getTime()) / 86_400_000)
  return { dateKey: next.dateKey, text: dayDiff === 0 ? 'Today' : dayDiff === 1 ? 'Tomorrow' : 'Next game day' }
}

export const STATUS_WORD: Record<CellStatus, string> = {
  AVAILABLE: 'Available',
  UNSURE: 'Unsure',
  UNAVAILABLE: 'Unavailable',
  NO_RESPONSE: 'No response',
  NOT_IN_POLL: 'Not in this poll',
}

export function pollKindLabel(game: Pick<GameColumn, 'pollType'>): string {
  return game.pollType === 'GROUP' ? 'group poll' : game.pollType === 'SQUAD' ? 'squad poll' : 'no poll'
}

// e.g. "Anton de Villiers, Sat 3 Oct Morning, Villagers 1 v CBC: Available, group poll, picked"
export function cellLabel(player: PlayerRow, game: GameColumn, cell: AvailabilityCell): string {
  const when = `${dateHeading(new Date(game.matchDate))} ${DAY_PART_LABEL[game.dayPart]}`
  return `${playerFullName(player)}, ${when}, ${game.label}: ${STATUS_WORD[cell.status]}, ${pollKindLabel(game)}${
    cell.picked ? ', picked' : ''
  }`
}

// Where a game's poll lives (group round, or squad poll for the match); null for a game without one.
export function pollPath(game: GameColumn): string | null {
  if (game.pollType === 'GROUP') {
    const id = game.roundId ?? game.pollId
    return id ? groupPollResponsesPath(id) : null
  }
  if (game.pollType === 'SQUAD' && game.pollId) {
    return squadPollResponsesPath(game.matchId, game.pollId)
  }
  return null
}

// NewPollPage reads lowercase type plus sectionId and matchId for its group branch. The section is
// omitted when the game has none, so a literal 'null' is never put in the URL.
export function openPollPath(game: GameColumn): string {
  const section = game.sectionId ? `&sectionId=${game.sectionId}` : ''
  return `/manage/availability/new?type=group${section}&matchId=${game.matchId}`
}

// docs/specs/085 (E): the helpers behind the phone lists (By game, By player).

// The four answers a phone chip can filter on. NOT_IN_POLL is not one: a player outside a game's poll is not in its list.
export type AnswerStatus = 'AVAILABLE' | 'UNSURE' | 'UNAVAILABLE' | 'NO_RESPONSE'
export const ANSWER_STATUSES: AnswerStatus[] = ['AVAILABLE', 'UNSURE', 'UNAVAILABLE', 'NO_RESPONSE']

// Index (in the left-to-right order) of the first game of the next game day - the same day the desktop "Next game
// day" chip marks (nextGameDayMarker: a game earlier today still counts as today). -1 when every game is before today.
export function nextGameDayIndex(columns: GameColumn[], now: Date): number {
  const today = startOfDay(now).getTime()
  return columns.findIndex((game) => startOfDay(new Date(game.matchDate)).getTime() >= today)
}

// The game the phone lists open on: the first game of the next game day; with none upcoming, the last (most recent) game.
export function openingGame(columns: GameColumn[], now: Date): GameColumn | undefined {
  const index = nextGameDayIndex(columns, now)
  return index >= 0 ? columns[index] : columns[columns.length - 1]
}

// The games of the By player strip: four, starting at the next game day (or the last four when all are past).
export function nextFourGames(columns: GameColumn[], now: Date, count = 4): GameColumn[] {
  const index = nextGameDayIndex(columns, now)
  return index >= 0 ? columns.slice(index, index + count) : columns.slice(-count)
}

// How many of the given players gave each answer for one game.
export function answerCounts(players: PlayerRow[], matchId: string): Record<AnswerStatus, number> {
  const counts: Record<AnswerStatus, number> = { AVAILABLE: 0, UNSURE: 0, UNAVAILABLE: 0, NO_RESPONSE: 0 }
  for (const player of players) {
    const status = cellFor(player, matchId)?.status
    if (status && (ANSWER_STATUSES as string[]).includes(status)) counts[status as AnswerStatus] += 1
  }
  return counts
}

export interface GamePlayer {
  player: PlayerRow
  status: AnswerStatus
  picked: boolean
}

// The players that have one of the four answers for a game, in the order given (optionally only one answer). Players
// outside the game's poll (NOT_IN_POLL, or no cell) are left out.
export function playersForGame(players: PlayerRow[], matchId: string, status: AnswerStatus | null = null): GamePlayer[] {
  const rows: GamePlayer[] = []
  for (const player of players) {
    const cell = cellFor(player, matchId)
    if (!cell || !(ANSWER_STATUSES as string[]).includes(cell.status)) continue
    if (status && cell.status !== status) continue
    rows.push({ player, status: cell.status as AnswerStatus, picked: cell.picked })
  }
  return rows
}

// "15 Oct" - the short date over a column of the By player strip.
export function shortDate(date: Date): string {
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

// True when the grid (or the phone lists) is replaced by an empty state: no games, or no game has a poll yet.
export function hasNothingToShow(games: GameColumn[]): boolean {
  return games.length === 0 || games.every((game) => game.pollType === null)
}
