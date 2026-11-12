import { TICKER_KINDS } from './tickerKinds'
import type { TickerContext, TickerItem } from './tickerTypes'

// docs/specs/146 section 1: composes the sources in the kind registry and drops what has expired. Pure; an empty list means the
// footer is exactly today's footer. Ordering is orderTickerItems' job.
export function buildTickerItems(ctx: TickerContext): TickerItem[] {
  const now = ctx.now.getTime()
  return Object.values(TICKER_KINDS)
    .flatMap((def) => (def ? def.source(ctx) : []))
    .filter((item) => !item.expiresAt || new Date(item.expiresAt).getTime() > now)
}
