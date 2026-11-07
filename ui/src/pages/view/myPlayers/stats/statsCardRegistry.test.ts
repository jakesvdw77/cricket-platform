import { describe, expect, it } from 'vitest'
import type { CardCtx, CardState, StatsPage } from '../../../../components/StatsCards'
import { MINE_OPTIONAL_BLOCKS, TEAM_OPTIONAL_BLOCKS, makeEmptyMyStats, makeMyStats, makeMyTeamStats, makeStanding, withoutBlocks } from '../../../../test/statsFixtures'
import { groupsFor } from './statsCardGroups'
import { allCards, cardsFor, placeholdersFor } from './statsCardRegistry'

// docs/specs/147 Test Plan, Unit: the registry. Adding a card is one file and one line, so these guards are what keep every card honest.
const ctx: CardCtx = { firstName: 'Sam', scopeLabel: '2025/26', resultHref: (id) => `/r/${id}`, drillHref: (target) => `/d/${target.kind}` }
const PAGES: StatsPage[] = ['mine', 'team', 'boards']
const FIXTURE: Record<StatsPage, object> = { mine: makeMyStats(), team: makeMyTeamStats(), boards: makeStanding() }
const STATES: CardState[] = ['ready', 'partial', 'empty', 'missing']

const stateOf = (state: () => CardState): CardState => {
  try {
    return state()
  } catch {
    return 'missing'
  }
}
const has = (payload: object, path: string): boolean => {
  let value: unknown = payload
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object' || !(part in value)) return false
    value = (value as Record<string, unknown>)[part]
  }
  return value !== undefined
}

describe('the registry', () => {
  it('has unique ids across every page, each prefixed by its page', () => {
    const cards = allCards() as unknown as { id: string; page: StatsPage }[]
    expect(new Set(cards.map((card) => card.id)).size).toBe(cards.length)
    for (const card of cards) expect(card.id.startsWith(card.page === 'boards' ? 'boards.' : `${card.page}.`), card.id).toBe(true)
  })

  it('has unique orders within a group of a page (cards sort by group position, then order)', () => {
    const cards = allCards() as unknown as { page: StatsPage; group: string; order: number; id: string }[]
    const keys = cards.map((card) => `${card.page}/${card.group}/${card.order}`)
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([])
  })

  it('gives every card a title, a summary, a Front, a Back, a valid tag, a listed group and a missing-data rule', () => {
    for (const card of allCards()) {
      expect(card.title(ctx), card.id).toBeTruthy()
      expect(typeof card.Front, `${card.id} Front`).toBe('function')
      expect(typeof card.Back, `${card.id} Back`).toBe('function')
      expect(typeof card.state, `${card.id} state`).toBe('function')
      expect(typeof card.summary, `${card.id} summary`).toBe('function')
      expect(['HAVE', 'PARTLY', 'NOT_CAPTURED'], card.id).toContain(card.tag)
      expect(['hide', 'notCaptured'], card.id).toContain(card.whenMissing)
      expect(groupsFor(card.page).map((group) => group.id), card.id).toContain(card.group)
      expect(card.needs.length, `${card.id} needs`).toBeGreaterThan(0)
    }
  })

  it('has every `needs` path present in a full fixture of its page', () => {
    for (const card of allCards()) {
      for (const path of card.needs as string[]) expect(has(FIXTURE[card.page], path), `${card.id} needs ${path}`).toBe(true)
    }
  })

  it('gives a state() of a known kind on a full fixture, and never "missing" there', () => {
    for (const card of allCards()) {
      const state = stateOf(() => card.state(FIXTURE[card.page], ctx))
      expect(STATES, card.id).toContain(state)
      expect(state, `${card.id} on a full payload`).not.toBe('missing')
    }
  })

  it('reports a card whose optional block an older backend omits as missing (or throws, which the grid turns into missing), never ready', () => {
    const stripped: Record<string, { page: StatsPage; payload: object; blocks: string[] }> = {
      mine: { page: 'mine', payload: withoutBlocks(makeMyStats(), ...MINE_OPTIONAL_BLOCKS), blocks: MINE_OPTIONAL_BLOCKS },
      team: { page: 'team', payload: withoutBlocks(makeMyTeamStats(), ...TEAM_OPTIONAL_BLOCKS), blocks: TEAM_OPTIONAL_BLOCKS },
    }
    let checked = 0
    for (const { page, payload, blocks } of Object.values(stripped)) {
      for (const card of allCards().filter((entry) => entry.page === page)) {
        if (!(card.needs as string[]).some((path) => blocks.includes(path))) continue
        checked += 1
        expect(stateOf(() => card.state(payload, ctx)), card.id).toBe('missing')
      }
    }
    expect(checked).toBeGreaterThan(10)
  })

  it('reports an empty state for a scope with no innings on the My stats batting cards', () => {
    const empty = makeEmptyMyStats()
    const ids = ['mine.innings', 'mine.milestone', 'mine.sum-runs']
    for (const id of ids) {
      const card = allCards().find((entry) => entry.id === id)
      expect(card, id).toBeDefined()
      expect(stateOf(() => card!.state(empty, ctx)), id).toBe('empty')
    }
  })

  it('marks a truncated history as partial on the history cards', () => {
    const payload = makeMyStats({ basis: { ...makeMyStats().basis, truncated: true } })
    const card = allCards().find((entry) => entry.id === 'mine.innings')!
    expect(card.state(payload, ctx)).toBe('partial')
    expect(card.partialNote?.(payload, ctx)).toContain('newest 50')
  })
})

describe('cardsFor and placeholdersFor', () => {
  it('returns each page in group order then card order, with no hidden or not-captured card', () => {
    for (const page of PAGES) {
      const cards = cardsFor(page) as unknown as { id: string; group: string; order: number; hidden?: boolean; tag: string }[]
      const groups = groupsFor(page).map((group) => group.id)
      const keys = cards.map((card) => groups.indexOf(card.group as never) * 1000 + card.order)
      expect(keys, page).toEqual([...keys].sort((a, b) => a - b))
      for (const card of cards) {
        expect(card.hidden, card.id).toBeFalsy()
        expect(card.tag, card.id).not.toBe('NOT_CAPTURED')
      }
    }
  })

  it('leaves the hidden fires card registered but off the page', () => {
    const fires = (allCards() as unknown as { id: string; hidden?: boolean }[]).find((card) => card.id === 'mine.fires')
    expect(fires?.hidden).toBe(true)
    expect(cardsFor('mine').some((card) => card.id === 'mine.fires')).toBe(false)
  })

  it('opens Mine and Team with the Summary group, and placeholders hold only NOT_CAPTURED cards', () => {
    expect(cardsFor('mine')[0].group).toBe('summary')
    expect(cardsFor('team')[0].group).toBe('summary')
    expect(groupsFor('mine').map((group) => group.id)).toEqual(['summary', 'batting', 'bowling', 'fielding', 'teammate'])
    expect(groupsFor('team').map((group) => group.id)).toEqual(['summary', 'batting', 'bowling', 'fielding', 'squad'])
    for (const page of PAGES) for (const card of placeholdersFor(page)) expect(card.tag).toBe('NOT_CAPTURED')
  })

  it('puts the Summary cards as compact tiles and the standing card alone in its group', () => {
    for (const card of cardsFor('mine').filter((entry) => entry.group === 'summary')) expect(card.size, card.id).toBe('compact')
    expect(cardsFor('boards').map((card) => card.id)).toEqual(['boards.standing'])
  })
})
