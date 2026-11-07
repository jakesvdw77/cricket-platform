import type { MyResultDismissal, MyResultOutcome, MyResultRow, MyResultScope } from '../../../api/meResultsApi'

// docs/specs/145 (Player Hub Results): the small pure helpers the Results screens share. Pure; no React. The server decides every
// figure and the result from the player's side; this only chooses words, letters and the card to show.

export type ResultTone = 'win' | 'loss' | 'tie' | 'neutral'
export type CardKind = 'batting' | 'bowling' | 'noBat'

const OUTCOME_WORD: Record<MyResultOutcome, string> = {
  WON: 'Won',
  LOST: 'Lost',
  TIED: 'Tied',
  DRAWN: 'Drawn',
  NO_RESULT: 'No Result',
  ABANDONED: 'Abandoned',
  INTERNAL: 'Internal Match',
}

export const resultWord = (result: MyResultOutcome): string => OUTCOME_WORD[result]

const STREAK_LETTER: Record<MyResultOutcome, string> = { WON: 'W', LOST: 'L', TIED: 'T', DRAWN: 'D', NO_RESULT: 'N', ABANDONED: 'A', INTERNAL: 'I' }

// The one letter of the last-five streak chip.
export const streakLetter = (result: MyResultOutcome): string => STREAK_LETTER[result]

// Gold for a win, muted red for a loss, sand for a tie; anything else is a plain card.
export function resultTone(result: MyResultOutcome): ResultTone {
  if (result === 'WON') return 'win'
  if (result === 'LOST') return 'loss'
  if (result === 'TIED') return 'tie'
  return 'neutral'
}

// The bold banner: the server's result line ("Irene Villagers won by 24 runs"), else the player's side's word.
export const resultBanner = (row: Pick<MyResultRow, 'resultLine' | 'result'>): string => row.resultLine?.trim() || resultWord(row.result)

// ----- the figures --------------------------------------------------------------------------------------------------------

// "46" or "46*" (not out in the last innings).
export function battingFigure(row: MyResultRow): string {
  const innings = row.batting.innings ?? []
  const last = innings[innings.length - 1]
  return `${row.batting.runs}${last?.notOut ? '*' : ''}`
}

// "2/21" (wickets for runs).
export const bowlingFigure = (row: MyResultRow): string => `${row.bowling.wickets}/${row.bowling.runs}`

// "6 overs", "4.2 overs", "1 over" from legal balls.
export function oversText(balls: number, ballsPerOver: number): string {
  const per = ballsPerOver > 0 ? ballsPerOver : 6
  const whole = Math.floor(balls / per)
  const part = balls % per
  const text = part ? `${whole}.${part}` : `${whole}`
  return `${text} ${text === '1' ? 'over' : 'overs'}`
}

// Runs per over to one decimal; null with no balls bowled.
export function economy(runs: number, balls: number, ballsPerOver: number): number | null {
  if (balls <= 0) return null
  const per = ballsPerOver > 0 ? ballsPerOver : 6
  return Math.round((runs / (balls / per)) * 10) / 10
}

export const economyText = (row: MyResultRow): string | null => {
  const value = economy(row.bowling.runs, row.bowling.balls, row.ballsPerOver)
  return value === null ? null : `economy ${value.toFixed(1)}`
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

// Which card a result gets. A player who batted and bowled gets the bigger contribution (a wicket is worth about 15 runs), so a
// three-wicket spell beats a 9 not out. A match with neither a batting nor a bowling card is the "did not bat" card.
export function cardKind(row: MyResultRow): CardKind {
  const batted = row.batting.status === 'BATTED'
  const bowled = row.bowling.status === 'BOWLED'
  if (batted && bowled) return row.bowling.wickets * 15 > row.batting.runs ? 'bowling' : 'batting'
  if (batted) return 'batting'
  if (bowled) return 'bowling'
  return 'noBat'
}

// The chip figure under a streak chip: the headline figure of the card, or a dash.
export function chipFigure(row: MyResultRow): string {
  const kind = cardKind(row)
  if (kind === 'batting') return battingFigure(row)
  if (kind === 'bowling') return bowlingFigure(row)
  return row.batting.status === 'DID_NOT_BAT' ? 'DNB' : '-'
}

// The three letters under a chip: "PRE" for Pretoria A, "INT" for a derby.
export const opponentCode = (row: Pick<MyResultRow, 'opponentName' | 'derby'>): string => (row.derby || !row.opponentName ? 'INT' : row.opponentName.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase())

// "Irene Villagers U15" (every team of ours in the match, a derby has two).
export const ourTeamsText = (row: Pick<MyResultRow, 'ourTeams'>): string => row.ourTeams.map((team) => team.teamName).join(' and ')

// "v Pretoria A", or "Villagers v Hillcrest" for a derby.
export const versusText = (row: Pick<MyResultRow, 'opponentName' | 'derby' | 'homeName' | 'awayName'>): string =>
  row.derby || !row.opponentName ? `${row.homeName} v ${row.awayName}` : `v ${row.opponentName}`

export function resultDate(iso: string, withYear = false): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
}

export const competitionText = (row: Pick<MyResultRow, 'competition' | 'leagueName'>): string => (row.competition === 'LEAGUE' ? row.leagueName || 'League' : 'Friendly')

const tail = (result: MyResultOutcome): string => (result === 'WON' ? ' in the win' : result === 'LOST' ? ' in a loss' : result === 'TIED' ? ' in a tie' : '')

// The one line under the big figure, built only from the figures (no ranking, no comparison with other players).
export function storyLine(row: MyResultRow): string {
  const kind = cardKind(row)
  if (kind === 'batting') {
    const best = Math.max(0, ...(row.batting.innings ?? []).map((innings) => innings.runs))
    const innings = row.batting.innings ?? []
    const notOut = Boolean(innings[innings.length - 1]?.notOut)
    const lead = best >= 100 ? 'A century' : best >= 50 ? 'A fifty' : notOut ? `Not out on ${row.batting.runs}` : plural(row.batting.runs, 'run')
    const boundaries = row.batting.fours + row.batting.sixes
    return `${lead}${tail(row.result)}${boundaries > 0 ? `, with ${plural(boundaries, 'boundary', 'boundaries')}` : ''}.`
  }
  if (kind === 'bowling') {
    const { wickets, runs, maidens } = row.bowling
    const lead = wickets >= 5 ? 'A five-wicket haul' : wickets > 0 ? `${plural(wickets, 'wicket')} for ${runs}` : `No wicket, ${plural(runs, 'run')} conceded`
    return `${lead}${tail(row.result)}${maidens > 0 ? `, ${plural(maidens, 'maiden')}` : ''}.`
  }
  if (row.batting.status === 'NO_CARD' && row.bowling.status === 'NO_CARD') return 'No scorecard was captured for this match.'
  const catches = row.fielding.catches
  return catches > 0 ? `${plural(catches, 'catch', 'catches')} in the field.` : 'Part of the team that day.'
}

// ----- the player's strip -------------------------------------------------------------------------------------------------

// The slim line at the foot of a result card. The Hub is read by parents, agents and managers, so it always names the player.
export function playerStripText(row: MyResultRow, name: string): string {
  const kind = cardKind(row)
  if (kind === 'batting') {
    const boundaries = [row.batting.fours > 0 ? plural(row.batting.fours, 'four') : null, row.batting.sixes > 0 ? plural(row.batting.sixes, 'six', 'sixes') : null]
    return [`${name} batted ${battingFigure(row)}`, row.batting.ballsFaced > 0 ? `off ${plural(row.batting.ballsFaced, 'ball')}` : null, ...boundaries].filter(Boolean).join(', ')
  }
  if (kind === 'bowling') return `${name} bowled ${bowlingFigure(row)}, ${oversText(row.bowling.balls, row.ballsPerOver)}`
  if (row.batting.status === 'NO_CARD' && row.bowling.status === 'NO_CARD') return 'No scorecard captured'
  const catches = row.fielding.catches
  if (row.batting.status === 'DID_NOT_BAT') return `${name} did not bat${catches > 0 ? `, ${plural(catches, 'catch', 'catches')}` : ''}`
  return catches > 0 ? `${name} took ${plural(catches, 'catch', 'catches')}` : `${name} played`
}

// "2 won, 3 lost in the last 5" (a zero lost or tied is left out).
export function formSentence(rows: MyResultRow[]): string {
  const count = (outcome: MyResultOutcome) => rows.filter((row) => row.result === outcome).length
  const lost = count('LOST')
  const tied = count('TIED')
  return `${count('WON')} won${lost ? `, ${lost} lost` : ''}${tied ? `, ${tied} tied` : ''} in the last ${rows.length}`
}

// ----- scope --------------------------------------------------------------------------------------------------------------

export interface ScopeNames {
  season?: string | null
  team?: string | null
  league?: string | null
}

// "2026 · U15 · Diamond League" on every card, so a screenshot is never misleading.
export function scopeLabel(names: ScopeNames, showTeam: boolean): string {
  return [names.season || 'All Seasons', showTeam ? names.team || 'All Teams' : null, names.league || null].filter(Boolean).join(' · ')
}

// The Results scope as a query string without the "?" (season, team, league, competition), carried by a result page so Back restores it.
export function resultsQuery(search: URLSearchParams): string | undefined {
  const query = new URLSearchParams()
  for (const name of ['season', 'team', 'league', 'competition']) {
    const value = search.get(name)
    if (value) query.set(name, value)
  }
  const text = query.toString()
  return text || undefined
}

export const scopeQuery = (scope: MyResultScope): string => {
  const query = new URLSearchParams()
  if (scope.seasonId) query.set('season', scope.seasonId)
  if (scope.teamId) query.set('team', scope.teamId)
  if (scope.leagueId) query.set('league', scope.leagueId)
  if (scope.competition) query.set('competition', scope.competition)
  return query.toString()
}

export const resultPath = (playerKey: string, matchId: string, scope?: string): string => `/account/players/${playerKey}/results/${matchId}${scope ? `?${scope}` : ''}`

// ----- the scorecard ------------------------------------------------------------------------------------------------------

const HOW_OUT: Record<MyResultDismissal, string> = {
  NOT_OUT: 'not out',
  BOWLED: 'bowled',
  CAUGHT: 'caught',
  CAUGHT_AND_BOWLED: 'caught and bowled',
  LBW: 'lbw',
  STUMPED: 'stumped',
  RUN_OUT: 'run out',
  HIT_WICKET: 'hit wicket',
  HANDLED_BALL: 'handled the ball',
  OBSTRUCTING_FIELD: 'obstructing the field',
  HIT_BALL_TWICE: 'hit the ball twice',
  TIMED_OUT: 'timed out',
  RETIRED_NOT_OUT: 'retired not out',
  RETIRED_OUT: 'retired out',
}

// How a batter was out, in words: "c Jones b Smith", "lbw b Smith", "run out (Jones)", "not out".
export function howOutWords(type: MyResultDismissal | null | undefined, bowler?: string | null, fielder?: string | null): string {
  if (!type) return ''
  switch (type) {
    case 'BOWLED':
      return bowler ? `b ${bowler}` : HOW_OUT.BOWLED
    case 'CAUGHT':
      return `${fielder ? `c ${fielder}` : HOW_OUT.CAUGHT}${bowler ? ` b ${bowler}` : ''}`
    case 'CAUGHT_AND_BOWLED':
      return bowler ? `c and b ${bowler}` : HOW_OUT.CAUGHT_AND_BOWLED
    case 'LBW':
      return bowler ? `lbw b ${bowler}` : HOW_OUT.LBW
    case 'STUMPED':
      return `st ${fielder ?? 'keeper'}${bowler ? ` b ${bowler}` : ''}`
    case 'RUN_OUT':
      return fielder ? `run out (${fielder})` : HOW_OUT.RUN_OUT
    case 'HIT_WICKET':
      return bowler ? `hit wicket b ${bowler}` : HOW_OUT.HIT_WICKET
    default:
      return HOW_OUT[type]
  }
}

// "46 off 68 balls".
export const offBalls = (runs: number, balls: number): string => `${runs} off ${plural(balls, 'ball')}`

// The extras line: "Extras 8 (w 3, nb 1, b 2, lb 2)".
export function extrasLine(innings: { extras: number; wides: number; noBalls: number; byes: number; legByes: number; penaltyRuns: number }): string {
  const parts = [
    innings.wides ? `w ${innings.wides}` : null,
    innings.noBalls ? `nb ${innings.noBalls}` : null,
    innings.byes ? `b ${innings.byes}` : null,
    innings.legByes ? `lb ${innings.legByes}` : null,
    innings.penaltyRuns ? `pen ${innings.penaltyRuns}` : null,
  ].filter(Boolean)
  return `Extras ${innings.extras}${parts.length ? ` (${parts.join(', ')})` : ''}`
}

// "36.4" overs as legal balls (36 whole overs and 4 balls); 0 when the text is not a number.
export function oversToBalls(overs: string, ballsPerOver: number): number {
  const [whole, part] = overs.split('.')
  const balls = Number(whole) * (ballsPerOver > 0 ? ballsPerOver : 6) + Number(part ?? 0)
  return Number.isFinite(balls) ? balls : 0
}
