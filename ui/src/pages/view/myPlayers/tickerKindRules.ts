import type { TickerKind, TickerKindRules } from './tickerTypes'

// docs/specs/146 section 2: the rules half of the kind registry (chip, tone, weight, caps), kept apart from the source functions so
// the strip and the shuffle can read it without importing any source file. A "designed for" kind is simply absent.
export const TICKER_KIND_RULES: Partial<Record<TickerKind, TickerKindRules>> = {
  result: { label: 'Result', tone: 'win', defaultWeight: 3, maxPerCycle: 5 },
  live: { label: 'Live', tone: 'live', defaultWeight: 5, maxPerCycle: 3, pinnedWhenPresent: true, pulse: true },
  upcoming: { label: 'Next', tone: 'next', defaultWeight: 2, maxPerCycle: 3 },
  poll: { label: 'Poll', tone: 'info', defaultWeight: 2, maxPerCycle: 3 },
}
