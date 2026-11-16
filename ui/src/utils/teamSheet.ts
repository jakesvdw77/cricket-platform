import type { SquadMember } from '../api/teamSquadApi'
import type { Match } from '../api/matchApi'
import type { MatchSide } from '../api/matchSideApi'
import { LEAGUE_FORMAT_LABELS } from '../api/leagueApi'
import { stageOf, tbcText } from './matchStages'
import type { LeagueFormat } from '../api/leagueApi'

// docs/specs/153-printable-team-sheet.md: the rows, pages and match details of a printable team sheet. Pure; no React, no jsPDF.
// The sheet lists the WHOLE squad alphabetically (no batting order) with empty Playing, Capt and Keeper boxes to tick by hand.

export interface SheetPlayer {
  key: string
  firstName: string
  lastName: string
  shirt: number | null
  isCaptain: boolean
  isKeeper: boolean
  // Selected Side only: the side's twelfth man, listed last.
  twelfth?: boolean
}

// A table row: a squad player, or an empty line to write a late or guest player on.
export type SheetRow = { kind: 'player'; player: SheetPlayer } | { kind: 'blank'; key: string }

export interface SheetMatchInfo {
  league: string | null
  opposition: string | null
  date: string | null
  time: string | null
  venue: string | null
  overs: string | null
  // The opposition's crest (a registered league team's logo or an opponent's own); the Poster style draws it, the plain sheet does not.
  oppositionLogoUrl?: string | null
  // docs/specs/155: the match's stage (Playoff, Semi-final, ...), printed under the date by the Poster; null for a pool match.
  stage?: string | null
}

export const EMPTY_MATCH_INFO: SheetMatchInfo = { league: null, opposition: null, date: null, time: null, venue: null, overs: null }

export interface MetaCell {
  label: string
  value: string | null
  // How many of the four columns the box spans: Venue takes the toss boxes' room when those are switched off.
  span: number
}

export interface MetaOptions {
  // Toss won by and Elected to (off unless asked: the sheet is handed in before the game).
  tossBoxes: boolean
  // Captain and Wicketkeeper written in boxes up here, for a sheet without the Capt and Keeper tick columns.
  leaderFields: boolean
  captain?: string | null
  keeper?: string | null
}

// The captain and the wicketkeeper(s) as names, for the pre-marked write-on boxes.
export function leaderNames(players: SheetPlayer[]): { captain: string | null; keeper: string | null } {
  const full = (player: SheetPlayer): string => `${player.firstName} ${player.lastName}`.trim()
  const captain = players.find((player) => player.isCaptain)
  const keepers = players.filter((player) => player.isKeeper).map(full)
  return { captain: captain ? full(captain) : null, keeper: keepers.length > 0 ? keepers.join(', ') : null }
}

// The write-on boxes under the header, four columns across. Row one is League, Opposition, Date, Start time. Row two is Venue and
// Overs plus whatever optional boxes are on, Venue taking the spare room so the row stays full. When both the toss boxes and the
// Captain and Wicketkeeper boxes are on, the latter two get a third row.
export function metaCells(match: SheetMatchInfo, options: MetaOptions): MetaCell[] {
  const { tossBoxes, leaderFields, captain = null, keeper = null } = options
  const toss: MetaCell[] = tossBoxes ? [{ label: 'Toss won by', value: null, span: 1 }, { label: 'Elected to', value: null, span: 1 }] : []
  const leaders: MetaCell[] = leaderFields ? [{ label: 'Captain', value: captain, span: 1 }, { label: 'Wicketkeeper', value: keeper, span: 1 }] : []
  const inRowTwo = tossBoxes ? toss : leaders
  return [
    { label: 'League', value: match.league, span: 1 },
    { label: 'Opposition', value: match.opposition, span: 1 },
    { label: 'Date', value: match.date, span: 1 },
    { label: 'Start time', value: match.time, span: 1 },
    { label: 'Venue', value: match.venue, span: 4 - inRowTwo.length - 1 },
    ...inRowTwo,
    { label: 'Overs', value: match.overs, span: 1 },
    ...(tossBoxes && leaderFields ? leaders.map((cell) => ({ ...cell, span: 2 })) : []),
  ]
}

// How many table rows fit on one A4 page under the header and above the signatures, and how many empty lines close the list.
export const ROWS_PER_PAGE = 20
export const BLANK_LINES = 2

const compare = (a: string, b: string): number => a.localeCompare(b, undefined, { sensitivity: 'base' })

export type SideOrder = 'batting' | 'alphabetical'

// What an alphabetical list sorts on first: the surname (the default) or the first name. The other name breaks ties.
export type NameSort = 'surname' | 'firstName'
const nameCompare = (sort: NameSort) => (a: { firstName: string; lastName: string }, b: { firstName: string; lastName: string }): number =>
  sort === 'firstName' ? compare(a.firstName, b.firstName) || compare(a.lastName, b.lastName) : compare(a.lastName, b.lastName) || compare(a.firstName, b.firstName)

// The players of a saved match side (docs/specs/076) as sheet rows: the batting XI in Team Selection's order or alphabetically
// (a player with no batting position yet goes after those with one), then the twelfth man last. Names and shirt numbers come from the
// season squad when the player is on it, else from the side itself.
export function sidePlayers(
  side: Pick<MatchSide, 'players' | 'captainPlayerId' | 'wicketKeeperPlayerId' | 'twelfthManPlayerId'>,
  squad: SquadMember[],
  order: SideOrder,
  nameSort: NameSort = 'surname',
): SheetPlayer[] {
  const squadById = new Map(squad.map((member) => [member.playerProfileId, member]))
  const picks = new Map(side.players.map((pick) => [pick.playerProfileId, pick]))
  if (side.twelfthManPlayerId && !picks.has(side.twelfthManPlayerId)) {
    picks.set(side.twelfthManPlayerId, { playerProfileId: side.twelfthManPlayerId, battingOrder: null, role: 'BATSMAN' })
  }
  const all = [...picks.values()].map((pick) => {
    const member = squadById.get(pick.playerProfileId)
    return {
      player: {
        key: pick.playerProfileId,
        firstName: member?.firstName ?? pick.firstName ?? '',
        lastName: member?.lastName ?? pick.lastName ?? '',
        shirt: member?.squadJerseyNumber ?? member?.jerseyNumber ?? null,
        isCaptain: pick.playerProfileId === side.captainPlayerId,
        isKeeper: pick.playerProfileId === side.wicketKeeperPlayerId,
        twelfth: pick.playerProfileId === side.twelfthManPlayerId,
      } satisfies SheetPlayer,
      battingOrder: pick.battingOrder,
    }
  })
  const byName = nameCompare(nameSort)
  const batting = all.filter((entry) => !entry.player.twelfth)
  batting.sort((a, b) => {
    if (order === 'batting' && a.battingOrder !== b.battingOrder) {
      if (a.battingOrder === null) return 1
      if (b.battingOrder === null) return -1
      return a.battingOrder - b.battingOrder
    }
    return byName(a.player, b.player)
  })
  return [...batting.map((entry) => entry.player), ...all.filter((entry) => entry.player.twelfth).map((entry) => entry.player)]
}

// Every active squad player, by surname then first name unless nameSort says first name first (case and accents ignored), so "Van der Westhuizen" sorts under V.
// The shirt number is the squad number, else the player's standing number, else blank.
export function sheetPlayers(squad: SquadMember[], nameSort: NameSort = 'surname'): SheetPlayer[] {
  return squad
    .filter((member) => member.active !== false)
    .map((member) => ({
      key: member.playerProfileId,
      firstName: member.firstName,
      lastName: member.lastName,
      shirt: member.squadJerseyNumber ?? member.jerseyNumber ?? null,
      isCaptain: member.isCaptain === true,
      isKeeper: member.isWicketKeeper === true,
    }))
    .sort(nameCompare(nameSort))
}

// The squad then two empty lines (none when the manager switched them off), cut into pages of ROWS_PER_PAGE. An empty squad is one page of empty lines only.
export function sheetPages(players: SheetPlayer[], blankLines: number = BLANK_LINES): SheetRow[][] {
  const rows: SheetRow[] = [
    ...players.map((player) => ({ kind: 'player' as const, player })),
    ...Array.from({ length: blankLines }, (_, index) => ({ kind: 'blank' as const, key: `blank-${index}` })),
  ]
  const pages: SheetRow[][] = []
  for (let start = 0; start < rows.length; start += ROWS_PER_PAGE) pages.push(rows.slice(start, start + ROWS_PER_PAGE))
  return pages.length > 0 ? pages : [[]]
}

// A surname as the sheets and posters print it in capitals: the main part in capitals, the leading particles (van, der, de, du, le...) in
// lower case, as the name is written: "de VILLIERS", "van der MERWE". At least one word is always the main part.
const SURNAME_PARTICLES = new Set(['van', 'von', 'der', 'den', 'de', 'du', 'di', 'da', 'le', 'la', 'te', 'ten', 'ter', 'op', 'vd', 'v/d', 'dos', 'das', 'del', 'della', 'el', 'al', "'t"])
export function surnameDisplay(lastName: string): string {
  const words = lastName.trim().split(/\s+/).filter(Boolean)
  let particles = 0
  while (particles < words.length - 1 && SURNAME_PARTICLES.has(words[particles].toLowerCase())) particles += 1
  const prefix = words.slice(0, particles).map((word) => word.toLowerCase())
  return [...prefix, words.slice(particles).join(' ').toUpperCase()].filter(Boolean).join(' ')
}

// Pre-marking the captain and the wicketkeeper are two separate choices. A plain boolean still means both (the older callers).
export interface PreMark {
  captain: boolean
  keeper: boolean
}
export type PreMarkOption = boolean | PreMark
export const preMarkOf = (option: PreMarkOption | undefined): PreMark =>
  typeof option === 'object' && option !== null ? option : { captain: option === true, keeper: option === true }

// Whether the Capt and Keeper boxes of a row are pre-filled (each only when the manager switched that pre-mark on).
export function preMarks(row: SheetRow, preMark: PreMarkOption): { captain: boolean; keeper: boolean } {
  const wanted = preMarkOf(preMark)
  if (row.kind !== 'player') return { captain: false, keeper: false }
  return { captain: wanted.captain && row.player.isCaptain, keeper: wanted.keeper && row.player.isKeeper }
}

// The captain's and the keeper's names for the match details, each only when that pre-mark is on.
export function preMarkedLeaders(players: SheetPlayer[], preMark: PreMarkOption): { captain: string | null; keeper: string | null } {
  const wanted = preMarkOf(preMark)
  const names = leaderNames(players)
  return { captain: wanted.captain ? names.captain : null, keeper: wanted.keeper ? names.keeper : null }
}

const two = (value: number): string => String(value).padStart(2, '0')

// "Thu 19 Nov 2026" and "14:30", in the browser's own zone (the same reading as the manager screens).
export function sheetDate(iso: string): string {
  const date = new Date(iso)
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' })
  const month = date.toLocaleDateString('en-GB', { month: 'short' })
  return `${weekday} ${date.getDate()} ${month} ${date.getFullYear()}`
}
export function sheetTime(iso: string): string {
  const date = new Date(iso)
  return `${two(date.getHours())}:${two(date.getMinutes())}`
}

// The match as the sheet prints it, for OUR team: the opposition is the other side, whichever way round the fixture is.
export function matchInfoFor(
  match: Pick<Match, 'homeTeamId' | 'homeTeamName' | 'awayTeamId' | 'awayTeamName' | 'matchDate' | 'venue' | 'homeTeamLogoUrl' | 'awayTeamLogoUrl'> &
    Partial<Pick<Match, 'stage' | 'homePlaceholder' | 'awayPlaceholder'>>,
  teamId: string,
  leagueName: string | null,
  format: LeagueFormat | null | undefined,
): SheetMatchInfo {
  const home = match.homeTeamId === teamId
  const opposition = home ? match.awayTeamName : match.homeTeamName
  const oppositionIsTbc = Boolean(home ? match.awayPlaceholder : match.homePlaceholder)
  return {
    league: leagueName,
    opposition: oppositionIsTbc ? tbcText(opposition?.trim()) : opposition?.trim() || null,
    date: sheetDate(match.matchDate),
    time: sheetTime(match.matchDate),
    venue: match.venue?.trim() || null,
    overs: format ? LEAGUE_FORMAT_LABELS[format] : null,
    oppositionLogoUrl: oppositionIsTbc ? null : (home ? match.awayTeamLogoUrl : match.homeTeamLogoUrl) || null,
    stage: stageOf(match),
  }
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// The dates line of a tournament, from its first to its last match: "19-21 NOV 2026", "30 NOV - 2 DEC 2026", "19 NOV 2026" for one day.
export function tournamentRange(isoDates: string[]): string | null {
  if (isoDates.length === 0) return null
  const days = isoDates.map((iso) => new Date(iso)).sort((a, b) => a.getTime() - b.getTime())
  const first = days[0]
  const last = days[days.length - 1]
  const same = (a: Date, b: Date, part: 'getDate' | 'getMonth' | 'getFullYear') => a[part]() === b[part]()
  if (same(first, last, 'getFullYear') && same(first, last, 'getMonth') && same(first, last, 'getDate')) return `${first.getDate()} ${MONTHS[first.getMonth()]} ${first.getFullYear()}`
  if (same(first, last, 'getFullYear') && same(first, last, 'getMonth')) return `${first.getDate()}-${last.getDate()} ${MONTHS[first.getMonth()]} ${first.getFullYear()}`
  const year = same(first, last, 'getFullYear') ? '' : ` ${first.getFullYear()}`
  return `${first.getDate()} ${MONTHS[first.getMonth()]}${year} - ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`
}

// "14:30" as South Africans write it on a fixture: "14H30".
export const hourStyle = (time: string): string => time.replace(':', 'H')

// The matches a team plays, soonest first, for the pickers.
export function teamMatches<T extends Pick<Match, 'homeTeamId' | 'awayTeamId' | 'matchDate' | 'active'>>(matches: T[], teamId: string): T[] {
  return matches
    .filter((match) => match.active !== false && (match.homeTeamId === teamId || match.awayTeamId === teamId))
    .sort((a, b) => a.matchDate.localeCompare(b.matchDate))
}

const clean = (value: string): string => value.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()

// "Team Sheet - Irene Veterans - Midlands CC - 2026-11-19.pdf", "Team Sheet - Irene Veterans (blank).pdf" and the league bundle
// "Team Sheets - VCASA Club Champs - Irene Veterans.pdf".
export function teamSheetFileName(opts: { teamName: string; kind: 'blank' | 'match' | 'bundle'; opposition?: string | null; isoDate?: string | null; leagueName?: string | null }): string {
  const { teamName, kind, opposition, isoDate, leagueName } = opts
  if (kind === 'blank') return `${clean(`Team Sheet - ${teamName} (blank)`)}.pdf`
  if (kind === 'bundle') return `${clean(['Team Sheets', leagueName, teamName].filter(Boolean).join(' - '))}.pdf`
  const day = isoDate ? new Date(isoDate) : null
  const stamp = day ? `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}` : null
  return `${clean(['Team Sheet', teamName, opposition, stamp].filter(Boolean).join(' - '))}.pdf`
}
