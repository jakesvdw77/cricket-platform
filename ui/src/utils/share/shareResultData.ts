import type { Match } from '../../api/matchApi'
import type {
  BattingEntry,
  BowlingEntry,
  DismissalType,
  MatchResult,
  ResultPlayer,
  ResultSide,
  Scorecard,
} from '../../api/matchResultApi'
import type { Team } from '../../api/teamApi'
import { dismissalLabel } from '../dismissal'
import { ballsToOvers, DEFAULT_BALLS_PER_OVER } from '../oversFormat'
import { scorecardPersonName } from '../playerDisplayName'
import type { PersonName } from '../playerDisplayName'
import { inningsFor, inningsScoreText, resultLine, resultPerspective } from '../resultLine'
import type { ResultPerspective } from '../resultLine'
import { guestPersonName, initialsCollisions, shareName } from './shareName'

// docs/specs/114-share-result.md: ONE model every share format reads (PDF, image, TV, WhatsApp, Facebook). Pure; no
// React. Every player name in it is ALREADY in the shared form (shareName), dismissal text included, so no builder or
// drawing function ever sees a full name it was not meant to show.

export type TeamsChoice = 'both' | 'ours'
export type TeamsChoiceDisabledReason = 'DERBY' | 'NO_SCORECARD' | null

// How many top batters and bowlers an innings lists.
export const TOP_PERFORMERS = 3

export interface ShareTeam {
  side: ResultSide
  name: string
  logoUrl: string | null
  // The match's side is one of the club's own teams (its team id is set).
  ours: boolean
  // "212/6 (40.0)", a second innings joined with " & ", a super over appended; '' when no score is entered.
  scoreText: string
}

export interface ShareBattingRow {
  name: string
  runs: number | null
  balls: number | null
  fours: number | null
  sixes: number | null
  strikeRate: number | null
  howOut: string
  didNotBat: boolean
  notOut: boolean
}

export interface ShareBowlingRow {
  name: string
  overs: string
  balls: number | null
  maidens: number | null
  runs: number | null
  wickets: number | null
  economy: number | null
}

export interface ShareExtras {
  total: number
  // "Extras 12 (b 2, lb 3, w 5, nb 1, pen 1)"; only the parts above zero.
  text: string
}

// One innings: the batting side's card, plus the bowling of the OTHER side in it.
export interface ShareInnings {
  battingSide: ResultSide
  battingTeam: string
  bowlingTeam: string
  battingOurs: boolean
  scoreText: string
  batting: ShareBattingRow[]
  extras: ShareExtras | null
  bowling: ShareBowlingRow[]
  topBatters: ShareBattingRow[]
  topBowlers: ShareBowlingRow[]
}

export interface ShareAward {
  name: string
  ours: boolean
}

export interface ShareResultModel {
  clubName: string | null
  leagueName: string | null
  home: ShareTeam
  away: ShareTeam
  resultLine: string
  perspective: ResultPerspective
  // The winning side and its margin, as the result stores them (null when there is no winner).
  winningSide: ResultSide | null
  marginType: 'RUNS' | 'WICKETS' | null
  marginValue: number | null
  // A regular chase won by wickets with balls left: "4.2" overs to spare; null when it cannot be said from the data.
  oversRemaining: string | null
  // The side that batted first, from the recorded innings; null when no innings are recorded.
  battingFirst: ResultSide | null
  // "Irene won the toss and chose to bat"; null when no toss is recorded.
  toss: string | null
  venue: string | null
  // yyyy-mm-dd and "Saturday 17 October 2026" for the match date, in the browser's time zone.
  dateIso: string
  dateLabel: string
  // Regular innings in batting order. Empty for a summary-only result.
  innings: ShareInnings[]
  playerOfTheMatch: ShareAward | null
  hasScorecard: boolean
  // The choice in force: 'both' whenever the control is disabled.
  teams: TeamsChoice
  teamsChoiceDisabledReason: TeamsChoiceDisabledReason
  initialsOnly: boolean
  // The initials ("S. K.") two different players of the model share; empty unless initialsOnly. The model keeps no
  // full name, so this is computed here from the people it shows.
  initialsCollisions: string[]
}

export interface BuildShareResultInput {
  match: Match
  result: MatchResult
  // Undefined or without players: a summary-only share.
  scorecard?: Scorecard | null
  // Used only to fall back to a team's own logo when the match carries none.
  teams?: Pick<Team, 'id' | 'name' | 'logoUrl'>[]
  clubName?: string | null
  leagueName?: string | null
  teamsChoice: TeamsChoice
  initialsOnly: boolean
}

const other = (side: ResultSide): ResultSide => (side === 'HOME' ? 'AWAY' : 'HOME')
const round = (value: number, places: number): number => Math.round(value * 10 ** places) / 10 ** places

function dateParts(matchDate: string): { iso: string; label: string } {
  const date = new Date(matchDate)
  if (Number.isNaN(date.getTime())) return { iso: matchDate.slice(0, 10), label: matchDate.slice(0, 10) }
  const pad = (value: number) => String(value).padStart(2, '0')
  const iso = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const label = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return { iso, label }
}

function tossLine(result: MatchResult, names: Record<ResultSide, string>): string | null {
  if (!result.tossWonBy) return null
  const winner = names[result.tossWonBy]
  if (!result.tossDecision) return `${winner} won the toss`
  return `${winner} won the toss and chose to ${result.tossDecision === 'BAT' ? 'bat' : 'bowl'}`
}

function extrasOf(
  battingSide: ResultSide,
  scorecard: Scorecard | null | undefined,
  result: MatchResult,
): ShareExtras | null {
  const own = scorecard?.innings?.find((innings) => innings.battingSide === battingSide)
  const fallback = result.innings.find((innings) => innings.battingSide === battingSide && innings.kind !== 'SUPER_OVER')
  const source = own ?? fallback
  const total = source?.extras ?? null
  if (total === null || total === undefined) return null
  const parts: [string, number | null | undefined][] = [
    ['b', source?.byes],
    ['lb', source?.legByes],
    ['w', source?.wides],
    ['nb', source?.noBalls],
    ['pen', source?.penaltyRuns],
  ]
  const detail = parts.filter(([, value]) => (value ?? 0) > 0).map(([label, value]) => `${label} ${value}`)
  return { total, text: `Extras ${total}${detail.length ? ` (${detail.join(', ')})` : ''}` }
}

export function sideScoreText(result: MatchResult, side: ResultSide, ballsPerOver: number): string {
  const innings = inningsFor(result.innings, side)
  const regular = innings.filter((item) => item.kind !== 'SUPER_OVER').map((item) => inningsScoreText(item, ballsPerOver))
  const superOvers = innings.filter((item) => item.kind === 'SUPER_OVER').map((item) => inningsScoreText(item, ballsPerOver))
  const main = regular.filter(Boolean).join(' & ')
  const extra = superOvers.filter(Boolean).join(' & ')
  return [main, extra ? `super over ${extra}` : ''].filter(Boolean).join(' · ')
}

export function buildShareResultModel(input: BuildShareResultInput): ShareResultModel {
  const { match, result, scorecard, initialsOnly } = input
  const ballsPerOver = result.ballsPerOver || DEFAULT_BALLS_PER_OVER
  const players = scorecard?.players ?? []
  const hasScorecard = players.length > 0

  // One of the club's own teams carries its name on the Team, not on the match (the match only names a free-text opponent).
  const nameOf = (teamId: string | null, matchName: string | null, fallback: string): string =>
    (teamId ? input.teams?.find((team) => team.id === teamId)?.name?.trim() : null) || matchName?.trim() || fallback
  const homeName = nameOf(match.homeTeamId, match.homeTeamName, 'Home team')
  const awayName = nameOf(match.awayTeamId, match.awayTeamName, 'Away team')
  const names: Record<ResultSide, string> = { HOME: homeName, AWAY: awayName }
  const logoOf = (teamId: string | null, matchLogo: string | null): string | null =>
    matchLogo || (teamId ? (input.teams?.find((team) => team.id === teamId)?.logoUrl ?? null) : null)
  const home: ShareTeam = {
    side: 'HOME',
    name: homeName,
    logoUrl: logoOf(match.homeTeamId, match.homeTeamLogoUrl),
    ours: match.homeTeamId !== null,
    scoreText: sideScoreText(result, 'HOME', ballsPerOver),
  }
  const away: ShareTeam = {
    side: 'AWAY',
    name: awayName,
    logoUrl: logoOf(match.awayTeamId, match.awayTeamLogoUrl),
    ours: match.awayTeamId !== null,
    scoreText: sideScoreText(result, 'AWAY', ballsPerOver),
  }

  const disabledReason: TeamsChoiceDisabledReason = home.ours && away.ours ? 'DERBY' : !hasScorecard ? 'NO_SCORECARD' : null
  const teams: TeamsChoice = disabledReason ? 'both' : input.teamsChoice
  const oursOnly = teams === 'ours'

  // Players by the key entries use: the stored id, else the client key. "Ours" is opposition === false (spec 101).
  const playerByKey = new Map<string, ResultPlayer>()
  for (const player of players) {
    if (player.id) playerByKey.set(player.id, player)
    if (player.clientKey) playerByKey.set(player.clientKey, player)
  }
  const playerOf = (key: string | null | undefined): ResultPlayer | undefined => (key ? playerByKey.get(key) : undefined)
  const isOurs = (player: ResultPlayer | undefined): boolean => player?.opposition === false
  const visible = (player: ResultPlayer | undefined): boolean => !!player && (!oursOnly || isOurs(player))

  const people = new Map<string, PersonName>()
  const personName = (player: ResultPlayer): PersonName => {
    const registered = !!player.playerProfileId || (!!player.firstName && !player.displayName)
    return registered ? scorecardPersonName(player) : guestPersonName(player.displayName, player.id ?? player.clientKey)
  }
  // The ONLY way a player's name enters the model.
  const label = (player: ResultPlayer): string => {
    const person = personName(player)
    const name = shareName(person, initialsOnly)
    const key = person.id ?? `${person.firstName} ${person.lastName}`.trim().toLowerCase()
    if (name && !people.has(key)) people.set(key, person)
    return name
  }

  const dismissalText = (entry: BattingEntry): string => {
    const type = entry.howOut as DismissalType | null
    if (!type) return ''
    const nameOf = (key: string | null | undefined): string | null => {
      const player = playerOf(key)
      return player && visible(player) ? label(player) || null : null
    }
    const bowler = nameOf(entry.bowlerPlayerId)
    const fielder = nameOf(entry.fielderPlayerId)
    switch (type) {
      case 'BOWLED':
        return bowler ? `b ${bowler}` : 'bowled'
      case 'CAUGHT':
        if (fielder && bowler) return `c ${fielder} b ${bowler}`
        if (bowler) return `caught b ${bowler}`
        return fielder ? `c ${fielder}` : 'caught'
      case 'CAUGHT_AND_BOWLED':
        return bowler ? `c & b ${bowler}` : 'caught and bowled'
      case 'LBW':
        return bowler ? `lbw b ${bowler}` : 'lbw'
      case 'STUMPED':
        if (fielder && bowler) return `st ${fielder} b ${bowler}`
        if (bowler) return `stumped b ${bowler}`
        return fielder ? `st ${fielder}` : 'stumped'
      case 'RUN_OUT':
        return fielder ? `run out (${fielder})` : 'run out'
      case 'HIT_WICKET':
        return bowler ? `hit wicket b ${bowler}` : 'hit wicket'
      default:
        return dismissalLabel(type).toLowerCase()
    }
  }

  const isRegular = (entry: { inningsKind?: string | null }): boolean => entry.inningsKind !== 'SUPER_OVER'

  const battingRows = (side: ResultSide): ShareBattingRow[] => {
    const entries = (scorecard?.batting ?? []).filter((entry) => entry.battingSide === side && isRegular(entry))
    return entries
      .map((entry) => ({ entry, player: playerOf(entry.resultPlayerId ?? entry.playerClientKey) }))
      .filter((item): item is { entry: BattingEntry; player: ResultPlayer } => visible(item.player))
      .sort((a, b) => (a.entry.position ?? 999) - (b.entry.position ?? 999))
      .map(({ entry, player }) => {
        const didNotBat = entry.howOut === 'DID_NOT_BAT'
        const balls = entry.balls ?? null
        return {
          name: label(player),
          runs: entry.runs ?? null,
          balls,
          fours: entry.fours ?? null,
          sixes: entry.sixes ?? null,
          strikeRate: !didNotBat && balls && entry.runs !== null && entry.runs !== undefined ? round((entry.runs / balls) * 100, 1) : null,
          howOut: dismissalText(entry),
          didNotBat,
          notOut: entry.howOut === 'NOT_OUT' || entry.howOut === 'RETIRED_NOT_OUT',
        }
      })
  }

  // The bowlers of the side that FIELDED in the innings `battingSide` batted (bowling entries carry the batting side).
  const bowlingRows = (battingSide: ResultSide): ShareBowlingRow[] => {
    const entries = (scorecard?.bowling ?? []).filter((entry) => entry.battingSide === battingSide && isRegular(entry))
    return entries
      .map((entry) => ({ entry, player: playerOf(entry.resultPlayerId ?? entry.playerClientKey) }))
      .filter((item): item is { entry: BowlingEntry; player: ResultPlayer } => visible(item.player))
      .sort((a, b) => (a.entry.bowlingOrder ?? 999) - (b.entry.bowlingOrder ?? 999))
      .map(({ entry, player }) => {
        const balls = entry.balls ?? null
        return {
          name: label(player),
          overs: ballsToOvers(balls, ballsPerOver),
          balls,
          maidens: entry.maidens ?? null,
          runs: entry.runs ?? null,
          wickets: entry.wickets ?? null,
          economy: balls && entry.runs !== null && entry.runs !== undefined ? round((entry.runs / balls) * ballsPerOver, 2) : null,
        }
      })
  }

  const topBatters = (rows: ShareBattingRow[]): ShareBattingRow[] =>
    rows
      .filter((row) => !row.didNotBat && (row.runs ?? 0) > 0)
      .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0) || (a.balls ?? 9999) - (b.balls ?? 9999))
      .slice(0, TOP_PERFORMERS)
  const topBowlers = (rows: ShareBowlingRow[]): ShareBowlingRow[] =>
    rows
      .filter((row) => (row.balls ?? 0) > 0)
      .sort((a, b) => (b.wickets ?? 0) - (a.wickets ?? 0) || (a.economy ?? 9999) - (b.economy ?? 9999))
      .slice(0, TOP_PERFORMERS)

  // Batting order of the innings: by the sequence of the first regular innings, else home first.
  const firstSequence = (side: ResultSide): number =>
    inningsFor(result.innings, side).find((item) => item.kind !== 'SUPER_OVER')?.sequence ?? (side === 'HOME' ? 1 : 2)
  const sideOrder: ResultSide[] = (['HOME', 'AWAY'] as ResultSide[]).sort((a, b) => firstSequence(a) - firstSequence(b))

  const innings: ShareInnings[] = []
  if (hasScorecard) {
    for (const side of sideOrder) {
      const battingTeam = side === 'HOME' ? home : away
      const batting = battingRows(side)
      const bowling = bowlingRows(side)
      // The extras are the batting side's: the opposition's are omitted with Our team only.
      const extras = oursOnly && !battingTeam.ours ? null : extrasOf(side, scorecard, result)
      if (batting.length === 0 && bowling.length === 0 && !extras) continue
      innings.push({
        battingSide: side,
        battingTeam: battingTeam.name,
        bowlingTeam: names[other(side)],
        battingOurs: battingTeam.ours,
        scoreText: battingTeam.scoreText,
        batting,
        extras,
        bowling,
        topBatters: topBatters(batting),
        topBowlers: topBowlers(bowling),
      })
    }
  }

  // The player of the match: the award's player resolved against the players, never the pre-formatted name.
  let playerOfTheMatch: ShareAward | null = null
  const award = scorecard?.awards.find((item) => item.awardType === 'PLAYER_OF_MATCH')
  if (award) {
    const player = playerOf(award.resultPlayerId ?? award.playerClientKey)
    if (player) {
      const name = label(player)
      if (name && (!oursOnly || isOurs(player))) playerOfTheMatch = { name, ours: isOurs(player) }
    } else if (award.displayName?.trim() && !oursOnly) {
      const person = guestPersonName(award.displayName)
      const name = shareName(person, initialsOnly)
      if (name) {
        people.set(`${person.firstName} ${person.lastName}`.trim().toLowerCase(), person)
        playerOfTheMatch = { name, ours: false }
      }
    }
  }

  // Overs to spare: only for a regular win by wickets by the side that batted second, from the scheduled balls.
  let oversRemaining: string | null = null
  if (result.outcomeType === 'WON' && result.decidedBy === 'REGULAR' && result.marginType === 'WICKETS' && result.winningSide) {
    const chase = inningsFor(result.innings, result.winningSide).find((item) => item.kind !== 'SUPER_OVER')
    const left = (result.scheduledBalls ?? 0) - (chase?.balls ?? 0)
    if (chase && chase.balls && result.scheduledBalls && left > 0 && sideOrder[1] === result.winningSide) {
      oversRemaining = ballsToOvers(left, ballsPerOver)
    }
  }

  const { iso, label: dateLabel } = dateParts(match.matchDate)
  return {
    clubName: input.clubName ?? null,
    leagueName: input.leagueName ?? null,
    home,
    away,
    resultLine: resultLine(result, { home: homeName, away: awayName }),
    perspective: resultPerspective(result, { home: home.ours, away: away.ours }),
    winningSide: result.winningSide,
    marginType: result.marginType,
    marginValue: result.marginValue,
    oversRemaining,
    battingFirst: result.innings.some((item) => item.kind !== 'SUPER_OVER') ? sideOrder[0] : null,
    toss: tossLine(result, names),
    venue: result.playingAreaName ?? match.playingAreaName ?? match.venue ?? null,
    dateIso: iso,
    dateLabel,
    innings,
    playerOfTheMatch,
    hasScorecard,
    teams,
    teamsChoiceDisabledReason: disabledReason,
    initialsOnly,
    initialsCollisions: initialsOnly ? initialsCollisions([...people.values()]) : [],
  }
}
