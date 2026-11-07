import { TICKER_MAX_ITEMS } from './tickerConfig'
import { TICKER_KIND_RULES } from './tickerKindRules'
import { itemKey } from './tickerText'
import type { TickerItem, TickerKind, TickerKindRules } from './tickerTypes'

// docs/specs/146 section 4: the ordering of ONE ticker cycle (every item once; the strip then loops). Pure and seeded: the same
// (items, seed) always gives the same order. Imports no source file (a guard test pins it).
//
// Input order matters: within a kind the items arrive freshest first, and a cap keeps the first ones.
export type KindRules = Partial<Record<TickerKind, TickerKindRules>>

export interface OrderOptions {
  seed: number
  // Replaces the seeded generator (a test).
  rng?: () => number
  // Defaults to the built kinds; a story or a test passes synthetic kinds.
  kinds?: KindRules
  maxItems?: number
}

// mulberry32: a small seeded generator returning [0, 1).
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ATTEMPTS = 60

export function orderTickerItems(input: TickerItem[], options: OrderOptions): TickerItem[] {
  const rules = options.kinds ?? TICKER_KIND_RULES
  const maxItems = options.maxItems ?? TICKER_MAX_ITEMS
  const rng = options.rng ?? mulberry32(options.seed)
  const isPinned = (item: TickerItem) => Boolean(item.pinned || rules[item.kind]?.pinnedWhenPresent)

  // A kind with no definition has no code path; a repeated id is one item.
  const seen = new Set<string>()
  let items = input.filter((item) => {
    if (!rules[item.kind] || seen.has(itemKey(item))) return false
    seen.add(itemKey(item))
    return true
  })

  // Rule 1a: per-kind caps (the freshest, i.e. the first, are kept; a pinned item is never removed).
  const perKind = new Map<TickerKind, number>()
  items = items.filter((item) => {
    if (isPinned(item)) return true
    const taken = perKind.get(item.kind) ?? 0
    if (taken >= (rules[item.kind]?.maxPerCycle ?? Infinity)) return false
    perKind.set(item.kind, taken + 1)
    return true
  })

  // Rule 1b: the whole cycle (pinned items count again when they are repeated) is capped; the kind with the most items loses its
  // stalest first, never a pinned item.
  const total = (list: TickerItem[]) => list.length + (list.length >= 6 && list.some(isPinned) ? list.filter(isPinned).length : 0)
  while (total(items) > maxItems) {
    const counts = new Map<TickerKind, number>()
    for (const item of items) if (!isPinned(item)) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1)
    if (counts.size === 0) break
    const [victim] = [...counts.entries()].sort((a, b) => b[1] - a[1] || (rules[a[0]]?.defaultWeight ?? 0) - (rules[b[0]]?.defaultWeight ?? 0))[0]
    const index = items.map((item) => item.kind === victim && !isPinned(item)).lastIndexOf(true)
    items = items.filter((_, position) => position !== index)
  }

  const pinned = items.filter(isPinned)
  const body = items.filter((item) => !isPinned(item))
  if (items.length === 0) return []

  let best: { sequence: TickerItem[]; broken: number; adjacent: number } | null = null
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const sequence = buildSequence(pinned, body, rules, rng, items.length >= 6)
    const score = violations(sequence, rules, isPinned)
    if (!best || score.broken < best.broken || (score.broken === best.broken && score.adjacent < best.adjacent)) best = { sequence, ...score }
    if (score.broken === 0 && score.adjacent === 0) break
  }
  // A sponsor still in breach is dropped, never placed anyway.
  return dropBreaches(best?.sequence ?? [], rules)
}

function weightOf(item: TickerItem, rules: KindRules): number {
  return item.weight > 0 ? item.weight : (rules[item.kind]?.defaultWeight ?? 1)
}

// One greedy pass: the pinned items lead, the body is placed one position at a time, and (for 6 or more items) the pinned block is
// repeated near the middle.
function buildSequence(pinned: TickerItem[], body: TickerItem[], rules: KindRules, rng: () => number, repeat: boolean): TickerItem[] {
  const sequence: TickerItem[] = [...pinned]
  let pool = [...body]
  const middle = pinned.length + Math.floor(body.length / 2)
  let repeated = !(repeat && pinned.length > 0 && body.length > 0)

  while (pool.length > 0) {
    if (!repeated && sequence.length >= middle) {
      sequence.push(...pinned)
      repeated = true
    }
    const previous = sequence[sequence.length - 1]
    const at = sequence.length
    // The cyclic length of the finished cycle (the loop seam is measured against it).
    const length = at + pool.length + (repeated ? 0 : pinned.length)
    const fitsShare = (candidate: TickerItem) => {
      const inN = rules[candidate.kind]?.maxShare?.inN
      if (!inN) return true
      for (let back = 1; back < inN; back++) if (at - back >= 0 && sequence[at - back].kind === candidate.kind) return false
      // Across the seam: position j of the next loop is (length - at + j) places after this one.
      for (let j = 0; j < at && length - at + j < inN; j++) if (sequence[j].kind === candidate.kind) return false
      return true
    }

    const allowedShare = pool.filter(fitsShare)
    if (allowedShare.length === 0) {
      // Everything left would break the share rule: those sponsors cannot be placed this cycle.
      pool = []
      break
    }
    // Rule 4, relaxed only when nothing else is left.
    const isLast = pool.length === 1
    const first = sequence[0]
    const preferred = allowedShare.filter((candidate) => candidate.kind !== previous?.kind && !(isLast && first && candidate.kind === first.kind))
    let choices = preferred.length > 0 ? preferred : allowedShare
    // A kind that needs every other slot to fit must go now (otherwise the walk paints itself into a corner).
    const left = pool.length
    if (left % 2 === 1) {
      const counts = new Map<TickerKind, number>()
      for (const candidate of pool) counts.set(candidate.kind, (counts.get(candidate.kind) ?? 0) + 1)
      const forced = [...counts.entries()].find(([, count]) => count === (left + 1) / 2)
      if (forced) {
        const forcedChoices = choices.filter((candidate) => candidate.kind === forced[0])
        if (forcedChoices.length > 0) choices = forcedChoices
      }
    }
    const picked = choose(choices, rules, rng)
    sequence.push(picked)
    pool = pool.filter((candidate) => candidate !== picked)
  }
  return sequence
}

function choose(candidates: TickerItem[], rules: KindRules, rng: () => number): TickerItem {
  const weights = candidates.map((candidate) => weightOf(candidate, rules))
  const sum = weights.reduce((a, b) => a + b, 0)
  let ticket = rng() * sum
  for (let index = 0; index < candidates.length; index++) {
    ticket -= weights[index]
    if (ticket < 0) return candidates[index]
  }
  return candidates[candidates.length - 1]
}

// Counts, around the loop: share breaches (rule 3, never allowed) and same-kind neighbours (rule 4), ignoring the pinned block.
function violations(sequence: TickerItem[], rules: KindRules, isPinned: (item: TickerItem) => boolean) {
  const length = sequence.length
  let broken = 0
  let adjacent = 0
  for (let i = 0; i < length; i++) {
    const item = sequence[i]
    const inN = rules[item.kind]?.maxShare?.inN
    if (inN && length > 1) {
      for (let step = 1; step < inN && step < length; step++) if (sequence[(i + step) % length].kind === item.kind && (i + step) % length !== i) broken++
    }
    const next = sequence[(i + 1) % length]
    if (length > 1 && next.kind === item.kind && !(isPinned(item) && isPinned(next))) adjacent++
  }
  return { broken, adjacent }
}

function dropBreaches(sequence: TickerItem[], rules: KindRules): TickerItem[] {
  const out = [...sequence]
  for (let i = out.length - 1; i >= 0; i--) {
    const inN = rules[out[i].kind]?.maxShare?.inN
    if (!inN || out.length < 2) continue
    for (let step = 1; step < inN && step < out.length; step++) {
      if (out[(i + out.length - step) % out.length].kind === out[i].kind && (i + out.length - step) % out.length !== i) {
        out.splice(i, 1)
        break
      }
    }
  }
  return out
}
