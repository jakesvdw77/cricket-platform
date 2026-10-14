import { describe, expect, it } from 'vitest'
import { maxPositionFor, moveId, placeAtPosition, placeAtSlot } from './reorderRows'

const IDS = ['a', 'b', 'c']

describe('reorderRows', () => {
  it('moves a row one place and stops at the ends', () => {
    expect(moveId(IDS, 'b', -1)).toEqual(['b', 'a', 'c'])
    expect(moveId(IDS, 'b', 1)).toEqual(['a', 'c', 'b'])
    expect(moveId(IDS, 'a', -1)).toBeNull()
    expect(moveId(IDS, 'c', 1)).toBeNull()
    expect(moveId(IDS, 'x', 1)).toBeNull()
  })

  it('places a row at a typed position, clamped, and ignores a no-op or non-number', () => {
    expect(placeAtPosition(IDS, 'c', '1')).toEqual(['c', 'a', 'b'])
    expect(placeAtPosition(IDS, 'a', '9')).toEqual(['b', 'c', 'a'])
    expect(placeAtPosition(IDS, 'b', '2')).toBeNull()
    expect(placeAtPosition(IDS, 'b', '')).toBeNull()
    expect(placeAtPosition(IDS, 'b', 'x')).toBeNull()
  })

  it('adds an unlisted row, within the places allowed', () => {
    expect(maxPositionFor(IDS, 'x', 11)).toBe(4)
    expect(maxPositionFor(IDS, 'x', 3)).toBe(3)
    expect(maxPositionFor([], 'x')).toBe(1)
    expect(placeAtPosition(IDS, 'x', '2', 11)).toEqual(['a', 'x', 'b', 'c'])
  })

  it('drops at a slot, adjusting for the row leaving its old place', () => {
    expect(placeAtSlot(IDS, 'a', 3)).toEqual(['b', 'c', 'a'])
    expect(placeAtSlot(IDS, 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(placeAtSlot(IDS, 'a', 1)).toBeNull()
    expect(placeAtSlot(IDS, 'x', 1, 3)).toBeNull()
    expect(placeAtSlot(IDS, 'x', 1, 4)).toEqual(['a', 'x', 'b', 'c'])
  })
})
