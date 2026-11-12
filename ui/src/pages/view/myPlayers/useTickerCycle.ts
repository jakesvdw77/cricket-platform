import { useMemo } from 'react'
import { TICKER_KIND_RULES } from './tickerKindRules'
import { itemKey } from './tickerText'
import type { TickerItem } from './tickerTypes'
import { orderTickerItems } from './weightedShuffle'
import type { KindRules } from './weightedShuffle'

// docs/specs/146 section 5: the ordered cycle, memoised on (the set of items, the seed). A re-render, a refetch that returns the same
// items, a window-focus refetch or a pause does not reorder; a new seed (a route change) or a different set of items does. Time-based
// text in an item (a countdown) is refreshed in place without touching the order.
export function useTickerCycle(items: TickerItem[], seed: number, kinds: KindRules = TICKER_KIND_RULES): TickerItem[] {
  const signature = items.map(itemKey).join('|')
  const order = useMemo(
    () => orderTickerItems(items, { seed, kinds }).map(itemKey),
    // `items` is deliberately not a dependency: the signature stands for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, seed, kinds],
  )
  return useMemo(() => {
    const latest = new Map(items.map((item) => [itemKey(item), item]))
    return order.map((key) => latest.get(key)).filter((item): item is TickerItem => Boolean(item))
  }, [order, items])
}
