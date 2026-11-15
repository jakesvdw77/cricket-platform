import type { SquadMember } from '../api/teamSquadApi'
import type { Match } from '../api/matchApi'
import { LEAGUE_FORMAT_LABELS } from '../api/leagueApi'
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

// Every active squad player, surname then first name (case and accents ignored), so "Van der Westhuizen" sorts under V.
// The shirt number is the squad number, else the player's standing number, else blank.
export function sheetPlayers(squad: SquadMember[]): SheetPlayer[] {
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
    .sort((a, b) => compare(a.lastName, b.lastName) || compare(a.firstName, b.firstName))
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

// Whether the Capt and Keeper boxes of a row are pre-filled (only when the manager switched pre-marking on).
export function preMarks(row: SheetRow, preMark: boolean): { captain: boolean; keeper: boolean } {
  if (!preMark || row.kind !== 'player') return { captain: false, keeper: false }
  return { captain: row.player.isCaptain, keeper: row.player.isKeeper }
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
  match: Pick<Match, 'homeTeamId' | 'homeTeamName' | 'awayTeamId' | 'awayTeamName' | 'matchDate' | 'venue'>,
  teamId: string,
  leagueName: string | null,
  format: LeagueFormat | null | undefined,
): SheetMatchInfo {
  const home = match.homeTeamId === teamId
  const opposition = home ? match.awayTeamName : match.homeTeamName
  return {
    league: leagueName,
    opposition: opposition?.trim() || null,
    date: sheetDate(match.matchDate),
    time: sheetTime(match.matchDate),
    venue: match.venue?.trim() || null,
    overs: format ? LEAGUE_FORMAT_LABELS[format] : null,
  }
}

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
