import { describe, expect, it } from 'vitest'
import { basedOnText, layoutRows, sortCards } from './statsCardOrder'
import type { CardSize, StatsCardDef, StatsGroupDef } from './statsCardTypes'

// docs/specs/147 Amendment 2 item 10: the row layout rules. Cards are reduced to their size and an id.
const make = (sizes: (CardSize | undefined)[]) => sizes.map((size, index) => ({ id: `c${index}`, size }))
const shape = (sizes: (CardSize | undefined)[]) => layoutRows(make(sizes)).map((row) => `${row.kind}:${row.cards.map((card) => card.id).join(',')}`)

describe('layoutRows', () => {
  it('lays three normal cards as one three row and returns nothing for no cards', () => {
    expect(layoutRows([])).toEqual([])
    expect(shape([undefined, 'normal', undefined])).toEqual(['three:c0,c1,c2'])
  })

  it('ends a group with a pair or a single when the cards do not divide by three', () => {
    expect(shape(['normal', 'normal', 'normal', 'normal'])).toEqual(['three:c0,c1,c2', 'single:c3'])
    expect(shape(['normal', 'normal', 'normal', 'normal', 'normal'])).toEqual(['three:c0,c1,c2', 'pair:c3,c4'])
    expect(shape(['normal', 'normal'])).toEqual(['pair:c0,c1'])
    expect(shape(['normal'])).toEqual(['single:c0'])
  })

  it('makes a tall card followed by two normal cards one tall row', () => {
    expect(shape(['tall', 'normal', 'normal'])).toEqual(['tall:c0,c1,c2'])
    expect(shape(['normal', 'normal', 'normal', 'tall', 'normal', 'normal', 'normal'])).toEqual(['three:c0,c1,c2', 'tall:c3,c4,c5', 'single:c6'])
  })

  it('treats a tall card without two normal cards after it as a normal one', () => {
    expect(shape(['tall'])).toEqual(['single:c0'])
    expect(shape(['tall', 'normal'])).toEqual(['pair:c0,c1'])
    expect(shape(['tall', 'compact', 'normal'])).toEqual(['single:c0', 'compact:c1', 'single:c2'])
  })

  it('stops a row early where a tall group begins, so the tall card keeps its place', () => {
    expect(shape(['normal', 'tall', 'normal', 'normal'])).toEqual(['single:c0', 'tall:c1,c2,c3'])
    expect(shape(['normal', 'normal', 'tall', 'normal', 'normal'])).toEqual(['pair:c0,c1', 'tall:c2,c3,c4'])
  })

  it('chunks compact cards three to a row (3 + 3 + 2) and stops a normal row where a compact card begins', () => {
    expect(shape(Array(8).fill('compact'))).toEqual(['compact:c0,c1,c2', 'compact:c3,c4,c5', 'compact:c6,c7'])
    expect(shape(['normal', 'compact', 'compact'])).toEqual(['single:c0', 'compact:c1,c2'])
    expect(shape(['compact', 'normal', 'normal', 'normal'])).toEqual(['compact:c0', 'three:c1,c2,c3'])
  })

  it('never loses or repeats a card whatever the mix', () => {
    const sizes: CardSize[] = ['normal', 'tall', 'compact', 'normal', 'normal', 'tall', 'normal', 'normal', 'compact', 'compact', 'compact', 'compact', 'normal']
    const ids = layoutRows(make(sizes)).flatMap((row) => row.cards.map((card) => card.id))
    expect(ids).toEqual(sizes.map((_, index) => `c${index}`))
  })
})

describe('sortCards', () => {
  const groups: StatsGroupDef[] = [{ id: 'summary', label: 'Summary' }, { id: 'batting', label: 'Batting' }]
  const card = (id: string, page: string, group: string, order: number) => ({ id, page, group, order }) as unknown as StatsCardDef<unknown>

  it('orders by the group position then the card order, and drops other pages and unlisted groups', () => {
    const cards = [card('a', 'mine', 'batting', 1), card('b', 'mine', 'summary', 9), card('c', 'mine', 'summary', 2), card('d', 'team', 'summary', 1), card('e', 'mine', 'bowling', 1)]
    expect(sortCards(cards, 'mine', groups).map((entry) => entry.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('basedOnText', () => {
  it('writes the honesty line', () => {
    expect(basedOnText({ counted: 6, total: 7 })).toBe('Based on 6 of 7 results')
    expect(basedOnText({ counted: 1, total: 1 }, 'innings')).toBe('Based on 1 of 1 innings')
  })
})
