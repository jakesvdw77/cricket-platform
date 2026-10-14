import type {
  Innings,
  MatchResult,
  ResultMarginType,
  ResultSide,
} from '../api/matchResultApi'
import { ballsToOvers, DEFAULT_BALLS_PER_OVER } from './oversFormat'

// docs/specs/100-match-results-core.md: the result as one sentence, and how it reads from one team's side.

export type ResultLineInput = Pick<
  MatchResult,
  'outcomeType' | 'decidedBy' | 'winningSide' | 'marginType' | 'marginValue'
>

export interface SideNames {
  home: string
  away: string
}

function marginText(type: ResultMarginType | null, value: number | null): string {
  if (!type || value === null || value === undefined) return ''
  const unit = type === 'RUNS' ? 'run' : 'wicket'
  return `by ${value} ${unit}${value === 1 ? '' : 's'}`
}

// "Irene Villagers 1 won by 24 runs", "Tied · X won in the super over", "X won by 3 wickets (DLS)", "Abandoned".
// A draft with no outcome yet reads "Result not entered yet".
export function resultLine(result: ResultLineInput, names: SideNames): string {
  const winner = result.winningSide === 'HOME' ? names.home : result.winningSide === 'AWAY' ? names.away : null
  switch (result.outcomeType) {
    case 'WON': {
      if (!winner) return 'Won'
      if (result.decidedBy === 'SUPER_OVER') return `Tied · ${winner} won in the super over`
      const margin = marginText(result.marginType, result.marginValue)
      const base = margin ? `${winner} won ${margin}` : `${winner} won`
      return result.decidedBy === 'DLS' ? `${base} (DLS)` : base
    }
    case 'TIE':
      return 'Match tied'
    case 'DRAW':
      return 'Match drawn'
    case 'NO_RESULT':
      return 'No result'
    case 'ABANDONED':
      return 'Abandoned'
    case 'FORFEIT':
      return winner ? `${winner} won by forfeit` : 'Forfeit'
    default:
      return 'Result not entered yet'
  }
}

export type ResultPerspective = 'won' | 'lost' | 'neutral'

export interface OwnSides {
  home: boolean
  away: boolean
}

// How a result reads for the club: a win or forfeit-win for one of its sides is 'won', a loss to the other side 'lost'.
// Everything else is neutral, including a match between two of the club's own teams (one win and one loss by
// construction) and a match with none of its teams.
export function resultPerspective(
  result: Pick<MatchResult, 'outcomeType' | 'winningSide'>,
  own: OwnSides,
): ResultPerspective {
  if ((result.outcomeType !== 'WON' && result.outcomeType !== 'FORFEIT') || !result.winningSide) return 'neutral'
  if (own.home === own.away) return 'neutral'
  const winnerIsOwn = result.winningSide === 'HOME' ? own.home : own.away
  return winnerIsOwn ? 'won' : 'lost'
}

// One innings as "212/6 (40.0)"; empty when it has no runs entered yet.
export function inningsScoreText(innings: Innings, ballsPerOver = DEFAULT_BALLS_PER_OVER): string {
  if (innings.runs === null || innings.runs === undefined) return ''
  const wickets = innings.wickets === null || innings.wickets === undefined ? '' : `/${innings.wickets}`
  const overs = ballsToOvers(innings.balls, ballsPerOver)
  return `${innings.runs}${wickets}${overs ? ` (${overs})` : ''}`
}

// The innings one side batted, regular first and then super overs, in sequence order.
export function inningsFor(innings: Innings[], side: ResultSide): Innings[] {
  return innings
    .filter((item) => item.battingSide === side)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
}
