import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { item } from '../../../test/tickerFixtures'
import { itemKey } from './tickerText'
import { useTickerCycle } from './useTickerCycle'

// docs/specs/146 section 5: the order is memoised on (the set of items, the seed).
const set = () => [item('result', 'a'), item('result', 'b'), item('upcoming', 'c'), item('poll', 'd'), item('poll', 'e')]

describe('useTickerCycle', () => {
  it('keeps the order across a re-render and a refetch that returns the same items', () => {
    const { result, rerender } = renderHook(({ items, seed }) => useTickerCycle(items, seed), { initialProps: { items: set(), seed: 5 } })
    const first = result.current.map(itemKey)
    rerender({ items: set(), seed: 5 })
    expect(result.current.map(itemKey)).toEqual(first)
  })

  it('updates the text of an item in place without reordering', () => {
    const { result, rerender } = renderHook(({ items }) => useTickerCycle(items, 9), { initialProps: { items: set() } })
    const order = result.current.map(itemKey)
    rerender({ items: set().map((entry) => ({ ...entry, parts: [{ type: 'text' as const, text: 'changed' }] })) })
    expect(result.current.map(itemKey)).toEqual(order)
    expect(result.current[0].parts).toEqual([{ type: 'text', text: 'changed' }])
  })

  it('draws a new order for a new seed and for a different set of items', () => {
    const { result, rerender } = renderHook(({ items, seed }) => useTickerCycle(items, seed), { initialProps: { items: set(), seed: 1 } })
    const first = result.current.map(itemKey).join()
    const orders = new Set<string>()
    for (let seed = 2; seed < 12; seed++) {
      rerender({ items: set(), seed })
      orders.add(result.current.map(itemKey).join())
    }
    expect([...orders].some((order) => order !== first)).toBe(true)
    rerender({ items: set().slice(0, 3), seed: 1 })
    expect(result.current).toHaveLength(3)
  })
})
