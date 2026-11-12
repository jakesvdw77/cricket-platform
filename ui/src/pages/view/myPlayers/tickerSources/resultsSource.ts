import { resultPath, resultWord, competitionText } from '../resultsFormat'
import { TICKER_KIND_RULES } from '../tickerKindRules'
import { TICKER_RESULT_MAX_AGE_DAYS } from '../tickerConfig'
import type { TickerContext, TickerItem, TickerPart } from '../tickerTypes'
import { DAY_MS, dayOf, highlightNames, weekday } from './sourceUtils'

const RULES = TICKER_KIND_RULES.result!

// docs/specs/146 section 3: published results the Hub results read returns (already Show In Player Hub only), newest first, at most 5,
// none older than 14 days. Team names and scores only: no player figure, no player name.
export function resultsSource(ctx: TickerContext): TickerItem[] {
  const now = ctx.now.getTime()
  return (ctx.results ?? [])
    .map((row) => ({ row, day: dayOf(row.matchDate) }))
    .filter((entry): entry is { row: typeof entry.row; day: Date } => entry.day !== null && now - entry.day.getTime() <= TICKER_RESULT_MAX_AGE_DAYS * DAY_MS)
    .sort((a, b) => b.day.getTime() - a.day.getTime())
    .slice(0, RULES.maxPerCycle)
    .map(({ row, day }) => {
      const line = row.resultLine?.trim()
      const head: TickerPart[] = line ? highlightNames(line, [row.homeName, row.awayName]) : [{ type: 'strong', text: `${row.homeName} v ${row.awayName}` }]
      const tail = [line ? null : resultWord(row.result), competitionText(row), weekday(day)].filter(Boolean).join(', ')
      return {
        kind: 'result' as const,
        id: row.matchId,
        parts: [...head, { type: 'muted' as const, text: tail }],
        to: resultPath(ctx.playerKey, row.matchId),
        weight: RULES.defaultWeight,
        label: `${line || `${row.homeName} v ${row.awayName}`}, ${[line ? null : resultWord(row.result), competitionText(row), weekday(day, 'long')].filter(Boolean).join(', ')}`,
      }
    })
}
