import type { MyMatchSummaryDto } from '../../../../api/myPlayersApi'
import { localDate, timeLabel } from '../leagueFormat'
import { countdownLabel, matchPath } from '../matchFormat'
import { TICKER_COUNTDOWN_HOURS, TICKER_UPCOMING_WINDOW_DAYS } from '../tickerConfig'
import { TICKER_KIND_RULES } from '../tickerKindRules'
import type { TickerContext, TickerItem } from '../tickerTypes'
import { DAY_MS, HOUR_MS, spanText, weekday } from './sourceUtils'

const RULES = TICKER_KIND_RULES.upcoming!

// The start of a match: its date and time, or (no time set) the end of its day, with no countdown.
function startOf(row: MyMatchSummaryDto): { start: Date; timed: boolean } | null {
  const day = localDate(row.date)
  if (!day) return null
  const time = /^(\d{2}):(\d{2})/.exec(row.time ?? '')
  if (!time) return { start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59), timed: false }
  return { start: new Date(day.getFullYear(), day.getMonth(), day.getDate(), Number(time[1]), Number(time[2])), timed: true }
}

// docs/specs/146 section 3: the next 3 matches starting within 7 days. Inside 24 hours the tail is a countdown ("starts in 3h 10m"),
// further out a day count ("starts in 2 days"). A match that has started leaves the list (the server then calls it live).
export function upcomingSource(ctx: TickerContext): TickerItem[] {
  const now = ctx.now.getTime()
  return (ctx.matches?.upcoming ?? [])
    .filter((row) => row.phase === 'UPCOMING')
    .map((row) => ({ row, when: startOf(row) }))
    .filter((entry): entry is { row: MyMatchSummaryDto; when: { start: Date; timed: boolean } } => entry.when !== null)
    .filter(({ when }) => when.start.getTime() > now && when.start.getTime() - now <= TICKER_UPCOMING_WINDOW_DAYS * DAY_MS)
    .sort((a, b) => a.when.start.getTime() - b.when.start.getTime())
    .slice(0, RULES.maxPerCycle)
    .map(({ row, when }) => {
      const ahead = when.start.getTime() - now
      const countdown = when.timed && ahead < TICKER_COUNTDOWN_HOURS * HOUR_MS
      const starts = countdown ? `starts in ${spanText(ahead)}` : `starts ${countdownLabel(row.date, ctx.now) || `on ${weekday(when.start)}`}`
      const time = timeLabel(row.time)
      const title = `${row.home.name} v ${row.away.name}`
      const tail = [row.venue, starts].filter(Boolean).join(', ')
      return {
        kind: 'upcoming' as const,
        id: row.matchId,
        parts: [
          { type: 'text' as const, text: `${[weekday(when.start), time].filter(Boolean).join(' ')} ` },
          { type: 'strong' as const, text: title },
          { type: 'muted' as const, text: tail },
        ],
        to: matchPath(ctx.playerKey, row.matchId),
        weight: RULES.defaultWeight,
        expiresAt: when.start.toISOString(),
      }
    })
}
