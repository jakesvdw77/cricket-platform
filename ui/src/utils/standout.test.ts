import { describe, expect, it } from 'vitest'
import { canFeatureBatter, canFeatureBowler, canFeatureFielder, effectiveFeatured, toggledOverride } from './standout'

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

describe('canFeature', () => {
  it('a batter needs to have batted and scored', () => {
    expect(canFeatureBatter({ howOut: 'NOT_OUT', runs: 12 })).toBe(true)
    expect(canFeatureBatter({ howOut: 'DID_NOT_BAT', runs: null })).toBe(false)
    expect(canFeatureBatter({ howOut: 'CAUGHT', runs: 0 })).toBe(false)
    expect(canFeatureBatter({ howOut: 'CAUGHT', runs: null })).toBe(false)
  })

  it('a bowler needs balls bowled', () => {
    expect(canFeatureBowler({ balls: 6 })).toBe(true)
    expect(canFeatureBowler({ balls: 0 })).toBe(false)
    expect(canFeatureBowler({ balls: null })).toBe(false)
  })

  it('a fielder needs a credit', () => {
    expect(canFeatureFielder({ catches: 0, stumpings: 0, runOuts: 1 })).toBe(true)
    expect(canFeatureFielder({ catches: null, stumpings: 0, runOuts: 0 })).toBe(false)
  })
})
