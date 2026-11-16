import { describe, expect, it } from 'vitest'
import { MEDIUM_SIDE, THUMB_SIDE, fitWithin } from './resizePhoto'

// docs/specs/157: the longest side fits the target, the shape is kept and a small photo is never made larger.
describe('fitWithin', () => {
  it('scales a landscape photo to the target on its longest side, keeping the shape', () => {
    expect(fitWithin(4000, 3000, MEDIUM_SIDE)).toEqual({ width: 1280, height: 960 })
    expect(fitWithin(4000, 3000, THUMB_SIDE)).toEqual({ width: 320, height: 240 })
  })

  it('scales a portrait photo on its height', () => {
    expect(fitWithin(3000, 4000, MEDIUM_SIDE)).toEqual({ width: 960, height: 1280 })
  })

  it('never makes a small photo larger', () => {
    expect(fitWithin(800, 600, MEDIUM_SIDE)).toEqual({ width: 800, height: 600 })
  })

  it('keeps at least one pixel on a very thin photo', () => {
    expect(fitWithin(10000, 2, THUMB_SIDE)).toEqual({ width: 320, height: 1 })
  })
})
