import type { TickerItem, TickerKindRules, TickerPart } from './tickerTypes'

// docs/specs/146 section 7: the plain-text sentence of an item for the accessible list. The main text first, then the muted tail after
// a comma ("Villagers beat Rovers by 24 runs, Over 40, Sat").
export function partsText(parts: TickerPart[]): string {
  const main = parts.filter((part) => part.type !== 'muted').map((part) => part.text).join('').replace(/\s+/g, ' ').trim()
  const tail = parts.filter((part) => part.type === 'muted').map((part) => part.text.trim()).filter(Boolean).join(', ')
  return [main, tail].filter(Boolean).join(', ')
}

export const itemSentence = (item: TickerItem): string => item.label ?? partsText(item.parts)

// The link's accessible name: the chip word, then the sentence.
export const itemName = (item: TickerItem, rules: Pick<TickerKindRules, 'label'>): string => `${rules.label}: ${itemSentence(item)}`

export const itemKey = (item: Pick<TickerItem, 'kind' | 'id'>): string => `${item.kind}:${item.id}`
