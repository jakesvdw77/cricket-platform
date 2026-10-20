import type { BattingFormEntry, BowlingFormEntry, HighestScore, BestBowling, NotCapturedItem } from '../../../api/playerStatsApi'
import type { FormStripItem } from '../../../components/FormStrip'
import { NOT_ON_FILE } from '../../../utils/playerFormat'
import { DEFAULT_BALLS_PER_OVER, ballsToOvers } from '../../../utils/oversFormat'
import { DISMISSALS } from '../../../utils/dismissal'
import type { PlayerStatsTab } from './playerStatsTabConfig'

// docs/specs/103-player-stats.md: display helpers only. The client never computes a statistic; the server's figures are
// already rounded, and these functions only choose how many decimals to show, add a star or a slash, and turn null into
// a dash.

export function dash(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === '' ? NOT_ON_FILE : String(value)
}

export function decimals(value: number | null | undefined, places: number): string {
  return value === null || value === undefined ? NOT_ON_FILE : value.toFixed(places)
}

export function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? NOT_ON_FILE : `${value.toFixed(1)}%`
}

export function highestScoreText(score: HighestScore | null | undefined): string {
  return score ? `${score.runs}${score.notOut ? '*' : ''}` : NOT_ON_FILE
}

export function bestBowlingText(best: BestBowling | null | undefined): string {
  return best ? `${best.wickets}/${best.runs}` : NOT_ON_FILE
}

// Overs through oversFormat; null (so a dash) when the counted innings mixed over lengths or nothing was bowled.
export function oversText(balls: number, ballsPerOver: number[], mixed: boolean, inningsBowled: number): string {
  if (mixed || inningsBowled === 0) return NOT_ON_FILE
  return ballsToOvers(balls, ballsPerOver[0] ?? DEFAULT_BALLS_PER_OVER) || NOT_ON_FILE
}

export function coverageCaption(used: number, counted: number, what?: string): string | undefined {
  if (counted <= 0 || used >= counted) return undefined
  return `from ${used} of ${counted} innings${what ? ` ${what}` : ''}`
}

export function resultsPhrase(count: number): string {
  return `${count} published result${count === 1 ? '' : 's'}`
}

export function dismissalLabelFor(key: string): string {
  return DISMISSALS.find((info) => info.type === key)?.label ?? key.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())
}

// Dismissal rows with a count, in the scorecard's own order; notOut and notRecorded are rendered by the caller.
const NOT_DISMISSALS = new Set(['NOT_OUT', 'DID_NOT_BAT', 'RETIRED_NOT_OUT', 'notRecorded'])
export function dismissalRows(modes: Record<string, number>): { key: string; label: string; count: number }[] {
  const order = new Map(DISMISSALS.map((info, index) => [info.type as string, index]))
  return Object.entries(modes)
    .filter(([key, count]) => !NOT_DISMISSALS.has(key) && count > 0)
    .sort(([a], [b]) => (order.get(a) ?? 99) - (order.get(b) ?? 99))
    .map(([key, count]) => ({ key, label: dismissalLabelFor(key), count }))
}

// The form chips. Tones are presentation only: 50+ and a bowling spell of 2 or more wickets read positive, a duck (out
// for nought) reads muted.
export function battingFormItems(entries: BattingFormEntry[]): FormStripItem[] {
  return entries.map((entry) => ({
    key: entry.matchId,
    label: entry.runs === null ? NOT_ON_FILE : `${entry.runs}${entry.notOut ? '*' : ''}`,
    tone: entry.runs === null ? 'neutral' : entry.runs >= 50 ? 'positive' : entry.runs === 0 && !entry.notOut ? 'muted' : 'neutral',
    ariaLabel:
      entry.runs === null ? 'Runs not recorded' : `${entry.runs}${entry.notOut ? ' not out' : ''}${entry.balls != null ? ` off ${entry.balls} balls` : ''}`,
  }))
}

export function bowlingFormItems(entries: BowlingFormEntry[]): FormStripItem[] {
  return entries.map((entry) => ({
    key: entry.matchId,
    label: `${entry.wickets}/${entry.runs}`,
    tone: entry.wickets >= 2 ? 'positive' : 'neutral',
    ariaLabel: `${entry.wickets} wickets for ${entry.runs} runs`,
  }))
}

// The "Not captured yet" items of one tab, from the item's own `tab` (the server decides where each belongs).
export function notCapturedFor(items: NotCapturedItem[], tab: PlayerStatsTab): NotCapturedItem[] {
  return items.filter((item) => item.tab.toLowerCase() === tab)
}
