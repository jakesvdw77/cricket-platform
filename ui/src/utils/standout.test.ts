import { describe, expect, it } from 'vitest'
import { effectiveFeatured, toggledOverride } from './standout'

describe('standout override', () => {
  it('follows the suggestion without an override', () => {
    expect(effectiveFeatured(true, null)).toBe(true)
    expect(effectiveFeatured(false, null)).toBe(false)
    expect(effectiveFeatured(undefined, undefined)).toBe(false)
  })

  it('an override beats the suggestion', () => {
    expect(effectiveFeatured(true, 'HIDE')).toBe(false)
    expect(effectiveFeatured(false, 'FEATURE')).toBe(true)
  })

  it('a tap hides a suggested row and features any other, and a second tap returns to null', () => {
    expect(toggledOverride(true, null)).toBe('HIDE')
    expect(toggledOverride(true, 'HIDE')).toBeNull()
    expect(toggledOverride(false, null)).toBe('FEATURE')
    expect(toggledOverride(false, 'FEATURE')).toBeNull()
  })
})
