import type {
  PlayerMatchBowling,
  PlayerMatchFielding,
  PlayerMatchInnings,
  PlayerMatchResultCode,
  PlayerMatchRow,
} from '../../../api/playerStatsApi'
import type { DismissalType } from '../../../api/matchResultApi'
import type { RecordCardBadgeTone } from '../../../components/RecordCard'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import { ballsToOvers } from '../../../utils/oversFormat'
import { dismissalLabel } from '../../../utils/dismissal'

// docs/specs/115-player-match-list.md: display helpers for the Matches tab. Statuses, sums and the result come from the server
// (PlayerMatchRowBuilder); these functions only choose words, join parts and turn null into a dash.

export const RESULT_LABEL: Record<PlayerMatchResultCode, string> = {
  WON: 'Won',
  LOST: 'Lost',
  TIED: 'Tied',
  DRAWN: 'Drawn',
  NO_RESULT: 'No result',
  ABANDONED: 'Abandoned',
  INTERNAL: 'Internal',
}

export const RESULT_TONE: Record<PlayerMatchResultCode, RecordCardBadgeTone> = {
  WON: 'positive',
  LOST: 'closed',
  TIED: 'neutral',
  DRAWN: 'neutral',
  NO_RESULT: 'muted',
  ABANDONED: 'muted',
  INTERNAL: 'side',
}

// How out in lowercase words, no names: "caught", "bowled", "lbw", "not out". Built on dismissalLabel so the wording follows the
// shared util (which stays capitalised for the scorecard).
export function howOutWord(type: DismissalType | null | undefined): string {
  return type ? dismissalLabel(type).toLowerCase() : ''
}

const dash = (value: number | null | undefined) => (value === null || value === undefined ? NOT_ON_FILE : String(value))

export function runsText(innings: PlayerMatchInnings): string {
  return innings.runs === null || innings.runs === undefined ? NOT_ON_FILE : `${innings.runs}${innings.notOut ? '*' : ''}`
}

// "56* off 41 · not out" for the phone card; the balls and the how-out are left out when not recorded.
export function inningsLine(innings: PlayerMatchInnings): string {
  const balls = innings.balls === null || innings.balls === undefined ? '' : ` off ${innings.balls}`
  const out = howOutWord(innings.howOut)
  return `${runsText(innings)}${balls}${out ? ` · ${out}` : ''}`
}

// The summed balls faced, or a dash when no innings recorded any (the server sums only valid balls).
export function ballsText(innings: PlayerMatchInnings[], ballsFaced: number | null | undefined): string {
  if (innings.length === 1) return dash(innings[0].balls)
  return innings.some((entry) => entry.balls !== null && entry.balls !== undefined) ? dash(ballsFaced) : NOT_ON_FILE
}

export function bowlingFigure(bowling: PlayerMatchBowling): string {
  return `${bowling.wickets ?? 0}/${bowling.runs ?? 0}`
}

// "4.0 ov · 1 mdn · 8 dots": dots only when recorded.
export function bowlingDetail(bowling: PlayerMatchBowling, ballsPerOver: number): string {
  const parts = [`${ballsToOvers(bowling.balls ?? 0, ballsPerOver)} ov`, `${bowling.maidens ?? 0} mdn`]
  if (bowling.dots !== null && bowling.dots !== undefined) parts.push(`${bowling.dots} dots`)
  return parts.join(' · ')
}

// The non-zero credits only; null when there are none (a dash is shown instead). `long` spells the words for the phone card.
export function fieldingText(fielding: PlayerMatchFielding, long = false): string | null {
  const catches = fielding.catches ?? 0
  const stumpings = fielding.stumpings ?? 0
  const runOuts = fielding.runOuts ?? 0
  const parts: string[] = []
  if (catches > 0) parts.push(long ? `${catches} ${catches === 1 ? 'catch' : 'catches'}` : `${catches} ct`)
  if (stumpings > 0) parts.push(long ? `${stumpings} ${stumpings === 1 ? 'stumping' : 'stumpings'}` : `${stumpings} st`)
  if (runOuts > 0) parts.push(long ? `${runOuts} ${runOuts === 1 ? 'run-out' : 'run-outs'}` : `${runOuts} ro`)
  return parts.length > 0 ? parts.join(' · ') : null
}

// A team list with no scorecard at all: the three blocks are all NO_CARD.
export function hasNoScorecard(row: PlayerMatchRow): boolean {
  return row.batting.status === 'NO_CARD' && row.bowling.status === 'NO_CARD' && row.fielding.status === 'NO_CARD'
}

export function competitionLabel(row: PlayerMatchRow): string {
  return row.competition === 'FRIENDLY' || !row.leagueName ? 'Friendly' : row.leagueName
}

export function opponentLabel(row: PlayerMatchRow): string {
  return row.derby ? 'Internal match' : row.opponentName || NOT_ON_FILE
}

// The club's own team(s) in the match: the sub-line under the opponent ("U15 A", or "U15 A v U15 B" for a derby).
export function teamsLabel(row: PlayerMatchRow): string {
  return row.ourTeams.map((team) => team.teamName).join(row.derby ? ' v ' : ' / ')
}

// "14 March 2026 against Riverside, open result"
export function openResultLabel(dateLong: string, row: PlayerMatchRow): string {
  return `${dateLong} against ${row.derby ? 'an internal match' : row.opponentName || 'an unnamed opponent'}, open result`
}
