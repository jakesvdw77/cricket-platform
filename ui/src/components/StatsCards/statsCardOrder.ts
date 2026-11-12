import type { CardSize, StatsBasis, StatsCardDef, StatsGroupDef, StatsPage } from './statsCardTypes'

// Pure helpers shared by every registry and the grid. No React.

// The cards of one page in display order: by the group's position in `groups`, then by `order`. A card whose group is not listed is dropped.
export function sortCards<P>(cards: StatsCardDef<P>[], page: StatsPage, groups: StatsGroupDef[]): StatsCardDef<P>[] {
  const position = (id: string) => groups.findIndex((group) => group.id === id)
  return cards
    .filter((card) => card.page === page && position(card.group) >= 0)
    .sort((a, b) => position(a.group) - position(b.group) || a.order - b.order)
}

// The honesty line: "Based on 6 of 7 results".
export function basedOnText(basis: StatsBasis, noun = 'results'): string {
  return `Based on ${basis.counted} of ${basis.total} ${noun}`
}

// Row layout. `three`: up to three equal-height cards; `tall`: a tall card (first) beside two stacked normal cards; `pair`: two equal
// halves; `single`: one card, full width up to a cap; `compact`: up to three compact (tile) cards. A row never has a ragged edge: the
// trailing cards of a group take equal widths. Every row kind has fixed card heights (statsCardStyle CARD_HEIGHT_REM).
export type CardRowKind = 'three' | 'tall' | 'pair' | 'single' | 'compact'
export interface CardRow<T> {
  kind: CardRowKind
  cards: T[]
}

const sizeAt = <T extends { size?: CardSize }>(cards: T[], index: number): CardSize | undefined => (cards[index] ? (cards[index].size ?? 'normal') : undefined)

const isTallGroupAt = <T extends { size?: CardSize }>(cards: T[], index: number): boolean =>
  sizeAt(cards, index) === 'tall' && sizeAt(cards, index + 1) === 'normal' && sizeAt(cards, index + 2) === 'normal'

export const COMPACT_PER_ROW = 3

// Walks the visible cards of one group in order. Compact cards are chunked three to a row. A tall card followed by two normal cards is
// one tall row; otherwise up to three cards make a row (a tall card with no two normal cards after it counts as normal; a row stops
// early where a tall group or a compact card begins, so the tall card keeps its place). A group with 3, 6 ... normal cards has only
// `three` rows; a short last row is `pair` or `single`.
export function layoutRows<T extends { size?: CardSize }>(cards: T[]): CardRow<T>[] {
  const rows: CardRow<T>[] = []
  let index = 0
  while (index < cards.length) {
    if (sizeAt(cards, index) === 'compact') {
      let end = index + 1
      while (end < cards.length && end - index < COMPACT_PER_ROW && sizeAt(cards, end) === 'compact') end += 1
      rows.push({ kind: 'compact', cards: cards.slice(index, end) })
      index = end
      continue
    }
    if (isTallGroupAt(cards, index)) {
      rows.push({ kind: 'tall', cards: cards.slice(index, index + 3) })
      index += 3
      continue
    }
    let end = index + 1
    while (end < cards.length && end - index < 3 && sizeAt(cards, end) !== 'compact' && !isTallGroupAt(cards, end)) end += 1
    const slice = cards.slice(index, end)
    rows.push({ kind: slice.length === 3 ? 'three' : slice.length === 2 ? 'pair' : 'single', cards: slice })
    index = end
  }
  return rows
}
