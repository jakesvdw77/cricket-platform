import type { MyPoll } from '../../../../api/myPlayersApi'
import { TICKER_POLL_WINDOW_HOURS } from '../tickerConfig'
import { TICKER_KIND_RULES } from '../tickerKindRules'
import type { TickerContext, TickerItem } from '../tickerTypes'
import { HOUR_MS, clock, dayOf, sameDay, spanText, weekday } from './sourceUtils'

const RULES = TICKER_KIND_RULES.poll!

// The held player's own answer is the only answer read: a squad poll is answered by one answer, a group poll by one per open window.
function answered(poll: MyPoll): boolean {
  if (poll.kind === 'GROUP') return poll.answers.length >= Math.max(1, poll.windows.filter((window) => window.open).length)
  return poll.answers.length > 0
}

// "in 45m", "in 5h 10m" (under 6 hours), "tonight" (this evening), "today 14:00", "tomorrow 18:00", "Sat 18:00".
export function closesPhrase(close: Date, now: Date): string {
  const ahead = close.getTime() - now.getTime()
  if (ahead < 6 * HOUR_MS) return `in ${spanText(ahead)}`
  if (sameDay(close, now)) return close.getHours() >= 17 ? 'tonight' : `today ${clock(close)}`
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  if (sameDay(close, tomorrow)) return `tomorrow ${clock(close)}`
  return `${weekday(close)} ${clock(close)}`
}

// docs/specs/146 section 3: open polls closing within 48 hours that the held player has not answered, at most 3.
export function pollsSource(ctx: TickerContext): TickerItem[] {
  const now = ctx.now.getTime()
  return (ctx.polls ?? [])
    .map((poll) => ({ poll, close: poll.scheduledCloseAt ? new Date(poll.scheduledCloseAt) : null }))
    .filter((entry): entry is { poll: MyPoll; close: Date } => entry.close !== null && !Number.isNaN(entry.close.getTime()))
    .filter(({ poll, close }) => close.getTime() > now && close.getTime() - now <= TICKER_POLL_WINDOW_HOURS * HOUR_MS && !answered(poll))
    .sort((a, b) => a.close.getTime() - b.close.getTime())
    .slice(0, RULES.maxPerCycle)
    .map(({ poll, close }) => {
      const day = poll.matchDate ? dayOf(poll.matchDate) : null
      const subject = day ? weekday(day, 'long') : poll.teamName || poll.title
      const when = closesPhrase(close, ctx.now)
      return {
        kind: 'poll' as const,
        id: poll.pollId,
        parts: [
          { type: 'text' as const, text: 'Availability for ' },
          { type: 'strong' as const, text: subject },
          { type: 'text' as const, text: ' closes ' },
          { type: 'strong' as const, text: when },
        ],
        to: `/account/players/${ctx.playerKey}/availability#poll-${poll.pollId}`,
        weight: RULES.defaultWeight,
        expiresAt: close.toISOString(),
      }
    })
}
