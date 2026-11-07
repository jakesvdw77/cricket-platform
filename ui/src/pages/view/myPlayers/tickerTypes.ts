import type { MyMatchListDto, MyPoll } from '../../../api/myPlayersApi'
import type { MyResultRow } from '../../../api/meResultsApi'

// docs/specs/146 section 2: the item contract. A kind is added with one TickerKindDef (tickerKinds.ts) and one source file; the
// ticker, the shuffle and the footer are never edited for it.
export type TickerKind =
  | 'result' | 'live' | 'upcoming' | 'poll' // built now
  | 'message' | 'sponsor' | 'milestone' | 'standing' | 'birthday' | 'weather' | 'onThisDay' | 'funFact' // designed for, not built

// Typed text, never HTML.
export type TickerPart =
  | { type: 'strong'; text: string } // gold, the key words
  | { type: 'text'; text: string }
  | { type: 'muted'; text: string }
  | { type: 'plate'; text: string; logoUrl?: string | null } // sponsors only

export interface TickerItem {
  kind: TickerKind
  // Stable and unique within the kind, e.g. the matchId, resultId, pollId.
  id: string
  // Rendered in order, in one line.
  parts: TickerPart[]
  // In-app path the item links to; null means not a link (a fun fact).
  to: string | null
  // Relative chance of being picked next; > 0; defaults from the registry.
  weight: number
  // ISO instant after which the item is dropped (a poll close time, a kickoff).
  expiresAt?: string | null
  // A live match: always in the cycle, first.
  pinned?: boolean
  // Plain-text sentence for the accessible list; built from the parts when absent.
  label?: string
}

export type TickerTone = 'win' | 'live' | 'next' | 'message' | 'sponsor' | 'info'

// What the strip and the shuffle need to know about a kind (no source function, so neither imports a source file).
export interface TickerKindRules {
  // The chip text, Title Case: "Result", "Live", "Next", "Poll".
  label: string
  tone: TickerTone
  defaultWeight: number
  // Cap on how many items of this kind enter one cycle (a pinned item is never removed by it).
  maxPerCycle: number
  // Sponsor: { inN: 5 } means at most 1 in any 5 consecutive items.
  maxShare?: { inN: number }
  pinnedWhenPresent?: boolean
  // The chip carries a pulsing dot (Live). The dot stands still under reduced motion.
  pulse?: boolean
}

export interface TickerKindDef extends TickerKindRules {
  source: (ctx: TickerContext) => TickerItem[]
}

// Only what the sources need. Sources never fetch; a read still loading or failed is `undefined`.
export interface TickerContext {
  playerKey: string
  firstName: string | null
  now: Date
  routeKey: string
  matches?: MyMatchListDto
  // Results page 0, newest first.
  results?: MyResultRow[]
  polls?: MyPoll[]
}
