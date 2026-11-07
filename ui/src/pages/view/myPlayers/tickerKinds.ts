import { TICKER_KIND_RULES } from './tickerKindRules'
import { liveSource } from './tickerSources/liveSource'
import { pollsSource } from './tickerSources/pollsSource'
import { resultsSource } from './tickerSources/resultsSource'
import { upcomingSource } from './tickerSources/upcomingSource'
import type { TickerKind, TickerKindDef } from './tickerTypes'

// docs/specs/146 section 2: the kind registry. Adding a kind later is one entry in tickerKindRules.ts, its source function here, and a
// chip tone in brandTokens.ts if the tone is new; the ticker, the footer and the shuffle are not edited. A "designed for" kind
// (message, sponsor, milestone, standing, birthday, weather, onThisDay, funFact) is absent: no item, no chip, no code path.
export const TICKER_KINDS: Record<TickerKind, TickerKindDef | undefined> = {
  result: { ...TICKER_KIND_RULES.result!, source: resultsSource },
  live: { ...TICKER_KIND_RULES.live!, source: liveSource },
  upcoming: { ...TICKER_KIND_RULES.upcoming!, source: upcomingSource },
  poll: { ...TICKER_KIND_RULES.poll!, source: pollsSource },
  message: undefined,
  sponsor: undefined,
  milestone: undefined,
  standing: undefined,
  birthday: undefined,
  weather: undefined,
  onThisDay: undefined,
  funFact: undefined,
}
