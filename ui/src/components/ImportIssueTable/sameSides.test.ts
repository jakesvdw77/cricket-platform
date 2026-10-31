import { describe, expect, it } from 'vitest'
import { playsItself, squash } from './sameSides'

const layout = { primary: ['home', 'away'], differentPair: ['home', 'away'] as [string, string] }

describe('squash', () => {
  it('trims, lowercases and collapses inner spaces', () => {
    expect(squash('  CBC   U13 ')).toBe('cbc u13')
    expect(squash(undefined)).toBe('')
  })
})

describe('playsItself', () => {
  it('is true when both sides hold the same name ignoring case and spacing', () => {
    expect(playsItself({ home: 'Police 1', away: ' POLICE   1 ' }, layout)).toBe(true)
  })
  it('is false for different names, empty sides, or a layout with no pair', () => {
    expect(playsItself({ home: 'Police 1', away: 'Police 2' }, layout)).toBe(false)
    expect(playsItself({ home: '', away: '' }, layout)).toBe(false)
    expect(playsItself({ home: 'A', away: 'A' }, { primary: [] })).toBe(false)
    expect(playsItself({ home: 'A', away: 'A' }, undefined)).toBe(false)
  })
})
