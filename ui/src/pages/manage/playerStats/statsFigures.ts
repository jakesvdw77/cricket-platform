import type { PageCounterItem } from '../../../components/PageCounters'
import type { PlayerStats } from '../../../api/playerStatsApi'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import type { PlayerStatsTab } from './playerStatsTabConfig'
import { bestBowlingText, decimals, highestScoreText } from './statsFormat'

const figure = (value: number | null | undefined) => (value === null || value === undefined ? NOT_ON_FILE : String(value))

// docs/specs/141 (owner, 2026-11-04) and page-anatomy section 0: ONE row of figure cards, directly under the title and above the tabs, and nothing
// else repeats them. The row follows the tab: Overview and Matches show the headline four, Batting its four, Bowling its four, Fielding its four,
// Awards & record its four. `basis` (the "Based on N published results ..." sentence) is the first card's info icon, not a line of its own.
export function playerStatsFigures(stats: PlayerStats, tab: PlayerStatsTab, basis: string): PageCounterItem[] {
  const { batting, bowling, fielding, awards, record } = stats
  const item = (id: string, label: string, value: string, info?: string): PageCounterItem => ({ id, testId: `tile-${id}`, label, value, info })
  const noBatting = stats.basis.resultsWithBattingCard === 0
  const noBowling = stats.basis.resultsWithBowlingCard === 0
  const matches = item('matches', 'Matches', figure(stats.basis.matchesCounted), basis)
  switch (tab) {
    case 'batting':
      return noBatting
        ? [matches]
        : [
            item('runs', 'Runs', figure(batting.runs), basis),
            item('average', 'Batting Average', decimals(batting.average, 2)),
            item('strike-rate', 'Strike Rate', decimals(batting.strikeRate, 2)),
            item('highest', 'Highest Score', highestScoreText(batting.highestScore)),
          ]
    case 'bowling':
      return noBowling
        ? [matches]
        : [
            item('wickets', 'Wickets', figure(bowling.wickets), basis),
            item('bowling-average', 'Bowling Average', decimals(bowling.average, 2)),
            item('economy', 'Economy Rate', decimals(bowling.economy, 2)),
            item('best', 'Best Bowling', bestBowlingText(bowling.best)),
          ]
    case 'fielding':
      return [
        item('catches', 'Catches', figure(fielding.catches), basis),
        item('stumpings', 'Stumpings', figure(fielding.stumpings)),
        item('run-outs', 'Run-Outs', figure(fielding.runOuts)),
        item('per-match', 'Dismissals Per Match', decimals(fielding.dismissalsPerMatch, 2)),
      ]
    case 'awards':
      return [
        item('potm', 'Player Of The Match', figure(awards.playerOfTheMatch), basis),
        item('team-potm', 'Team Player Of The Match', figure(awards.teamPlayerOfTheMatch)),
        item('won', 'Won', figure(record.won)),
        item('lost', 'Lost', figure(record.lost)),
      ]
    default:
      return [
        matches,
        item('runs', 'Runs', figure(batting.runs)),
        item('wickets', 'Wickets', figure(bowling.wickets)),
        item('catches', 'Catches', figure(fielding.catches)),
      ]
  }
}
