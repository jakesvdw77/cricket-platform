import { describe, expect, it } from 'vitest'
import { groupGames } from './gridHelpers'
import { scrollBehaviour, slotLabelText, slotNavState, slotStartAttrs } from './slotNavigation'
import { at, makeGame } from './testData'

describe('slotNavState', () => {
  const starts = [0, 400, 900, 1500]

  it('picks the group nearest the scroll position and the targets either side', () => {
    expect(slotNavState(starts, 0, 3000)).toEqual({ index: 0, previousLeft: null, nextLeft: 400 })
    expect(slotNavState(starts, 380, 3000)).toEqual({ index: 1, previousLeft: 0, nextLeft: 900 })
    expect(slotNavState(starts, 1200, 3000)).toEqual({ index: 3, previousLeft: 900, nextLeft: null })
  })

  it('reports the last group at the far end even when its start cannot be reached', () => {
    // Furthest scroll is 1300, so the last group (1500) can never be at the left edge.
    expect(slotNavState(starts, 1300, 1300)).toEqual({ index: 3, previousLeft: 900, nextLeft: null })
    expect(slotNavState(starts, 900, 1300).nextLeft).toBe(1300)
  })

  it('still moves Previous when several short groups at the end clamp to the furthest scroll', () => {
    // Furthest scroll is 1000, so the last three groups all sit at 1000 and stepping to the neighbour would not move.
    const clamped = [0, 400, 900, 1500, 1700]
    expect(slotNavState(clamped, 1000, 1000)).toEqual({ index: 4, previousLeft: 900, nextLeft: null })
    expect(slotNavState(clamped, 900, 1000)).toEqual({ index: 2, previousLeft: 400, nextLeft: 1000 })
  })

  it('has nothing to navigate without groups', () => {
    expect(slotNavState([], 0, 0)).toEqual({ index: -1, previousLeft: null, nextLeft: null })
  })
})

describe('slotStartAttrs', () => {
  it('marks the first column of each day-and-slot group with its label', () => {
    const games = [
      makeGame({ matchId: 'a', matchDate: at(10, 3, 9), dayPart: 'MORNING' }),
      makeGame({ matchId: 'b', matchDate: at(10, 3, 10), dayPart: 'MORNING' }),
      makeGame({ matchId: 'c', matchDate: at(10, 3, 14), dayPart: 'AFTERNOON' }),
    ]
    const map = slotStartAttrs(groupGames(games), (game) => game.matchId)
    expect([...map.keys()]).toEqual(['a', 'c'])
    expect(map.get('a')?.['data-slot-label']).toBe('Sat 3 Oct, Morning')
    expect(map.get('c')?.['data-slot-label']).toBe('Sat 3 Oct, Afternoon')
  })
})

describe('labels and motion', () => {
  it('formats the label with the position', () => {
    expect(slotLabelText('Sat 3 Oct, Afternoon', 2, 7)).toBe('Sat 3 Oct, Afternoon (3 of 7)')
  })

  it('scrolls smoothly unless reduced motion is requested', () => {
    const original = window.matchMedia
    window.matchMedia = ((query: string) => ({ matches: query.includes('reduce') })) as unknown as typeof window.matchMedia
    expect(scrollBehaviour()).toBe('auto')
    window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia
    expect(scrollBehaviour()).toBe('smooth')
    window.matchMedia = original
  })
})
