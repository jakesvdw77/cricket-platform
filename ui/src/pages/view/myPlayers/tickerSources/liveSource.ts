import { elapsedLabel, matchPath } from '../matchFormat'
import { TICKER_KIND_RULES } from '../tickerKindRules'
import type { TickerContext, TickerItem, TickerPart } from '../tickerTypes'

const RULES = TICKER_KIND_RULES.live!

// docs/specs/146 section 3: matches the server says are live (phase LIVE, docs/specs/135). Pinned. The match and the time since it
// started; never a score (there is no in-app score yet).
export function liveSource(ctx: TickerContext): TickerItem[] {
  return (ctx.matches?.live ?? [])
    .filter((row) => row.phase === 'LIVE')
    .slice(0, RULES.maxPerCycle)
    .map((row) => {
      const elapsed = elapsedLabel(row.startedAt, ctx.now)
      const parts: TickerPart[] = [{ type: 'strong', text: `${row.home.name} v ${row.away.name}` }]
      if (elapsed) parts.push({ type: 'muted', text: elapsed })
      return { kind: 'live' as const, id: row.matchId, parts, to: matchPath(ctx.playerKey, row.matchId), weight: RULES.defaultWeight, pinned: true }
    })
}
