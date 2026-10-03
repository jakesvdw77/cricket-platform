import type { AvailabilityCell, CellStatus, GameColumn, PlayerRow } from '../../../api/playerAvailabilityApi'
import type { DayPart } from '../../../api/sectionAvailabilityApi'
import { DAY_PART_LABEL } from '../../../utils/dayPart'

// docs/specs/068-player-availability-grid.md: the pure, unit-tested logic behind the grid -
// header grouping, footer totals, search/hide filtering, the next game and every label string.

export interface SlotGroup {
  dayPart: DayPart
  games: GameColumn[]
}

export interface DateGroup {
  dateKey: string
  // Local midnight of the game day.
  date: Date
  slots: SlotGroup[]
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
export function groupGames(games: GameColumn[]): DateGroup[] {
  const groups: DateGroup[] = []
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
export function orderedGames(groups: DateGroup[]): GameColumn[] {
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
export function nextGameDayMarker(groups: DateGroup[], now: Date): { dateKey: string; text: string } | null {
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
    return id ? `/manage/availability/group/${id}` : null
  }
  if (game.pollType === 'SQUAD' && game.pollId) {
    return `/manage/availability/squad/${game.matchId}/${game.pollId}`
  }
  return null
}

// NewPollPage reads lowercase type plus sectionId and matchId for its group branch. The section is
// omitted when the game has none, so a literal 'null' is never put in the URL.
export function openPollPath(game: GameColumn): string {
  const section = game.sectionId ? `&sectionId=${game.sectionId}` : ''
  return `/manage/availability/new?type=group${section}&matchId=${game.matchId}`
}
