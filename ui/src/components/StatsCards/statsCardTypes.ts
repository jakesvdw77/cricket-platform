import type { FC } from 'react'

// docs/specs/147 section 3: the card contract. A card is one file exporting a StatsCardDef plus one line in a registry; the page, the
// grid, the shell and FlipCard never change to add one. Shared (not under pages/) so the manager's Team and Player stats can reuse it
// (spec 147 Addendum): each page family supplies its own payload type P, its own registry and its own group list.

export type StatsPage = 'mine' | 'team' | 'boards'
export type MineGroup = 'batting' | 'bowling' | 'fielding' | 'teammate'
export type TeamGroup = 'record' | 'contribution' | 'matchups' | 'squad'
export type BoardGroup = 'standing'
export type StatsGroupId = MineGroup | TeamGroup | BoardGroup

// What the scorecard can support: a property of the card, written in its definition.
export type DataTag = 'HAVE' | 'PARTLY' | 'NOT_CAPTURED'
// What this scope actually has: computed at render by the card's pure `state`.
export type CardState = 'ready' | 'partial' | 'empty' | 'missing'

// A tile, band or slice that opens the innings behind it (the match drill). `kind` and `filter` are the server's tokens, advertised by
// the payload; the client builds no query of its own.
export type DrillKind = 'BATTING' | 'BOWLING' | 'FIELDING' | 'MATCHES'
export interface DrillTarget {
  kind: DrillKind
  filter?: string
  // The sub-view's heading and the link's accessible name ("Runs", "Scores of 50 or more").
  label: string
}

// What every card is given besides the payload. Links are built by the page, so a card stays router-free.
export interface CardCtx {
  // The player's first name, "This Player" as the fallback. Copy always names the player.
  firstName: string
  teamName?: string
  // The scope as words ("2025/26 · Under 13s"), shown on the card so a screenshot is never misleading.
  scopeLabel: string
  // The Hub Result page for a match, carrying the origin so Back returns to this page and scope.
  resultHref: (matchId: string) => string
  // The drill sub-view for a target, carrying the scope.
  drillHref: (target: DrillTarget) => string
}

// "Based on N of M results": N counted for this card (its coverage), M the results in scope.
export interface StatsBasis {
  counted: number
  total: number
}

export interface CardFaceProps<P> {
  payload: P
  ctx: CardCtx
  state: CardState
  // True when the card is expanded over the stats view (desktop). A face may lay its content out larger; absent or false, the same layout.
  expanded?: boolean
}

// Row layout (docs/specs/147 Amendment 2 item 10): a `normal` card takes one cell of a row of three equal-height cards; a `tall` card
// followed by two normal cards sits beside them, the two stacked.
export type CardSize = 'normal' | 'tall'

// Dotted paths into the payload, to a depth of four levels; an array's elements are reached through the array's own key
// (`series.battingInnings` or `series.battingInnings.runs`). A `needs` entry that is not a path of P does not compile.
type Primitive = string | number | boolean | bigint | symbol | null | undefined
type Prev = [never, 0, 1, 2, 3, 4]
type PathsOf<T, D extends number> = [D] extends [never]
  ? never
  : T extends Primitive
    ? never
    : T extends readonly (infer U)[]
      ? PathsOf<U, Prev[D]>
      : {
          [K in keyof T & string]-?: K | (NonNullable<T[K]> extends Primitive ? never : `${K}.${PathsOf<NonNullable<T[K]>, Prev[D]>}`)
        }[keyof T & string]
export type NeedsPath<P> = PathsOf<P, 3>

export interface StatsCardDef<P> {
  // Stable and unique: 'mine.innings'.
  id: string
  page: StatsPage
  group: StatsGroupId
  title: (ctx: CardCtx) => string
  tag: DataTag
  // The payload paths the card reads (checked at compile time).
  needs: NeedsPath<P>[]
  // Unique within its page; cards sort by (group order, order).
  order: number
  // Row layout size; default 'normal'. See layoutRows.
  size?: CardSize
  // Amendment 2 item 7: a hidden card stays registered but is left off the page (cardsFor skips it) until the owner decides.
  hidden?: boolean
  // Missing data: render nothing, or the "Not captured yet" state.
  whenMissing: 'hide' | 'notCaptured'
  // Pure; reads only `needs`.
  state: (payload: P, ctx: CardCtx) => CardState
  // One plain sentence: the accessible description of the card.
  summary: (payload: P, ctx: CardCtx) => string
  Front: FC<CardFaceProps<P>>
  // Always includes a text alternative of any drawing.
  Back: FC<CardFaceProps<P>>
  drill?: (payload: P) => DrillTarget | null
  // Shown on a 'partial' card (what is partial).
  partialNote?: (payload: P, ctx: CardCtx) => string
  // The card's own coverage for "Based on N of M results" when it differs from the page's (balls recorded in 18 of 24 innings).
  basis?: (payload: P, ctx: CardCtx) => StatsBasis | null
  // One line for the empty state ("Not enough innings yet") and for the Not captured yet state.
  emptyText?: string
  missingText?: string
}

export interface StatsGroupDef {
  id: StatsGroupId
  label: string
}
