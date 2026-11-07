import type { StatsBasis, StatsCardDef, StatsGroupDef, StatsPage } from './statsCardTypes'

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
