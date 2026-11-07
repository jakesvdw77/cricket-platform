import { describe, expect, it } from 'vitest'
import { item, SYNTHETIC_KINDS } from '../../../test/tickerFixtures'
import { TICKER_MAX_ITEMS } from './tickerConfig'
import type { TickerItem, TickerKind } from './tickerTypes'
import { mulberry32, orderTickerItems } from './weightedShuffle'

// docs/specs/146 section 4: the ordering rules, over many seeds, with synthetic kinds where a later kind is needed.
const kindsOf = (items: TickerItem[]) => items.map((entry) => entry.kind)
const many = (kind: TickerKind, count: number, prefix = kind as string) => Array.from({ length: count }, (_, index) => item(kind, `${prefix}${index}`))
const SEEDS = Array.from({ length: 80 }, (_, index) => index + 1)

const adjacentSame = (items: TickerItem[], skipPinned = false) =>
  items.filter((entry, index) => {
    const next = items[(index + 1) % items.length]
    return items.length > 1 && next.kind === entry.kind && !(skipPinned && entry.pinned && next.pinned)
  }).length

// Largest number of same-kind items in any window of `size` consecutive positions, around the loop.
const worstWindow = (items: TickerItem[], kind: TickerKind, size: number) => {
  let worst = 0
  for (let start = 0; start < items.length; start++) {
    let hits = 0
    for (let step = 0; step < Math.min(size, items.length); step++) if (items[(start + step) % items.length].kind === kind) hits++
    worst = Math.max(worst, hits)
  }
  return worst
}

describe('orderTickerItems: never the same kind twice in a row', () => {
  it('holds over many seeds and mixed inputs, including across the loop seam', () => {
    const mixed = [...many('result', 4), ...many('upcoming', 3), ...many('poll', 3), ...many('message', 2)]
    for (const seed of SEEDS) {
      const out = orderTickerItems(mixed, { seed, kinds: SYNTHETIC_KINDS })
      expect(out).toHaveLength(mixed.length)
      expect(adjacentSame(out)).toBe(0)
      expect(kindsOf(out)[0]).not.toBe(kindsOf(out)[out.length - 1])
    }
  })

  it('holds for a tight input where one kind needs every other slot', () => {
    const tight = [...many('result', 3), ...many('upcoming', 2), ...many('poll', 1)]
    for (const seed of SEEDS) expect(adjacentSame(orderTickerItems(tight, { seed }))).toBe(0)
  })

  it('relaxes only when one kind remains, and every item is still present', () => {
    const items = [...many('result', 4), ...many('poll', 1)]
    for (const seed of SEEDS) {
      const out = orderTickerItems(items, { seed })
      expect(out).toHaveLength(5)
      expect(new Set(out.map((entry) => entry.id))).toEqual(new Set(items.map((entry) => entry.id)))
    }
    const one = many('result', 3)
    expect(orderTickerItems(one, { seed: 1 })).toHaveLength(3)
  })
})

describe('orderTickerItems: the sponsor cap (1 in 5)', () => {
  it('never puts two sponsors in any window of 5, also across the seam', () => {
    const items = [...many('result', 4), ...many('upcoming', 3), ...many('poll', 2), ...many('sponsor', 3)]
    for (const seed of SEEDS) {
      const out = orderTickerItems(items, { seed, kinds: SYNTHETIC_KINDS })
      expect(worstWindow(out, 'sponsor', 5)).toBeLessThanOrEqual(1)
    }
  })

  it('drops a sponsor that cannot be placed instead of placing it in breach', () => {
    // Four sponsors and one other item: at most one sponsor fits in a cycle of that size.
    const items = [item('result', 'r'), ...many('sponsor', 4)]
    for (const seed of SEEDS) {
      const out = orderTickerItems(items, { seed, kinds: SYNTHETIC_KINDS })
      expect(worstWindow(out, 'sponsor', 5)).toBeLessThanOrEqual(1)
      expect(out.some((entry) => entry.kind === 'result')).toBe(true)
      expect(out.filter((entry) => entry.kind === 'sponsor').length).toBeLessThanOrEqual(1)
    }
  })

  it('keeps a single sponsor among enough other items', () => {
    const items = [...many('result', 3), ...many('upcoming', 2), ...many('sponsor', 1)]
    for (const seed of SEEDS) expect(orderTickerItems(items, { seed, kinds: SYNTHETIC_KINDS }).filter((entry) => entry.kind === 'sponsor')).toHaveLength(1)
  })
})

describe('orderTickerItems: live is pinned', () => {
  const live = (id: string) => item('live', id, { pinned: true })

  it('is always present and first', () => {
    const items = [...many('result', 3), live('m1'), ...many('poll', 2)]
    for (const seed of SEEDS) {
      const out = orderTickerItems(items, { seed })
      expect(out[0].id).toBe('m1')
      expect(out.filter((entry) => entry.kind === 'live').length).toBeGreaterThanOrEqual(1)
    }
  })

  it('is repeated once near the middle when the cycle has 6 or more items, and keeps its id', () => {
    const items = [live('m1'), ...many('result', 3), ...many('upcoming', 2), ...many('poll', 2)]
    for (const seed of SEEDS) {
      const out = orderTickerItems(items, { seed })
      const at = out.map((entry, index) => (entry.id === 'm1' ? index : -1)).filter((index) => index >= 0)
      expect(at).toHaveLength(2)
      expect(at[0]).toBe(0)
      expect(Math.abs(at[1] - out.length / 2)).toBeLessThanOrEqual(2)
    }
  })

  it('is not repeated under 6 items', () => {
    const out = orderTickerItems([live('m1'), ...many('result', 2), ...many('poll', 2)], { seed: 3 })
    expect(out.filter((entry) => entry.id === 'm1')).toHaveLength(1)
  })

  it('is never removed by the kind cap or the cycle cap', () => {
    const lives = ['a', 'b', 'c', 'd'].map(live)
    const items = [...lives, ...many('result', 5), ...many('upcoming', 3), ...many('poll', 3)]
    for (const seed of SEEDS.slice(0, 20)) {
      const out = orderTickerItems(items, { seed })
      for (const entry of lives) expect(out.some((candidate) => candidate.id === entry.id)).toBe(true)
      expect(out.length).toBeLessThanOrEqual(TICKER_MAX_ITEMS)
    }
  })

  it('works with only pinned items', () => {
    const out = orderTickerItems([live('a'), live('b')], { seed: 1 })
    expect(out.map((entry) => entry.id)).toEqual(['a', 'b'])
  })
})

describe('orderTickerItems: weights, determinism and caps', () => {
  it('picks a higher weight first more often', () => {
    const items = [item('result', 'heavy', { weight: 9 }), item('poll', 'light', { weight: 1 }), item('upcoming', 'other', { weight: 1 })]
    let heavyFirst = 0
    for (let seed = 1; seed <= 400; seed++) if (orderTickerItems(items, { seed })[0].id === 'heavy') heavyFirst++
    // 9 of 11 expected (about 82 percent); a wide tolerance.
    expect(heavyFirst).toBeGreaterThan(260)
    expect(heavyFirst).toBeLessThan(380)
  })

  it('gives the same order for the same (items, seed) and usually a different one for another seed', () => {
    const items = [...many('result', 4), ...many('upcoming', 3), ...many('poll', 3)]
    const a = orderTickerItems(items, { seed: 7 }).map((entry) => entry.id)
    expect(orderTickerItems(items, { seed: 7 }).map((entry) => entry.id)).toEqual(a)
    const others = SEEDS.slice(0, 15).filter((seed) => orderTickerItems(items, { seed }).map((entry) => entry.id).join() !== a.join())
    expect(others.length).toBeGreaterThan(10)
  })

  it('accepts an injected generator', () => {
    const items = [...many('result', 2), ...many('poll', 2)]
    const out = orderTickerItems(items, { seed: 0, rng: mulberry32(5) })
    expect(out.map((entry) => entry.id)).toEqual(orderTickerItems(items, { seed: 5 }).map((entry) => entry.id))
  })

  it('keeps the freshest (first) items of a kind when it is over its cap', () => {
    const out = orderTickerItems(many('result', 8), { seed: 2 })
    expect(out.map((entry) => entry.id).sort()).toEqual(['result0', 'result1', 'result2', 'result3', 'result4'])
  })

  it('caps the cycle at TICKER_MAX_ITEMS, taking from the largest kind first', () => {
    const items = [...many('result', 5), ...many('upcoming', 3), ...many('poll', 3), ...many('message', 3), ...many('funFact', 3)]
    const out = orderTickerItems(items, { seed: 4, kinds: SYNTHETIC_KINDS })
    expect(out).toHaveLength(TICKER_MAX_ITEMS)
    const counts = (kind: TickerKind) => out.filter((entry) => entry.kind === kind).length
    expect(counts('result')).toBeLessThanOrEqual(3)
    expect(counts('poll')).toBeGreaterThanOrEqual(2)
  })

  it('drops items of a kind with no definition', () => {
    expect(orderTickerItems([item('birthday', 'b1'), item('result', 'r1')], { seed: 1 }).map((entry) => entry.id)).toEqual(['r1'])
  })
})

describe('orderTickerItems: degenerate inputs', () => {
  it('handles empty, one item and two items of one kind', () => {
    expect(orderTickerItems([], { seed: 1 })).toEqual([])
    expect(orderTickerItems([item('result', 'a')], { seed: 1 })).toHaveLength(1)
    expect(orderTickerItems(many('result', 2), { seed: 1 })).toHaveLength(2)
  })

  it('treats a repeated kind and id as one item', () => {
    expect(orderTickerItems([item('result', 'a'), item('result', 'a')], { seed: 1 })).toHaveLength(1)
  })
})
