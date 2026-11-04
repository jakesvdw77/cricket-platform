import { describe, expect, it } from 'vitest'
import { playerDisplayName, playerLabeler, scorecardPersonName, splitName } from './playerDisplayName'
import type { PersonName } from './playerDisplayName'

const p = (firstName: string, lastName: string, id?: string): PersonName => ({ firstName, lastName, id })
const label = (view: PersonName[], person: PersonName) => playerDisplayName(view, 'initials', person)

describe('playerDisplayName', () => {
  it('shows the full name in full mode, whatever the view holds', () => {
    const sam = p('Sam', 'Venter')
    expect(playerDisplayName([sam, p('Sam', 'Botha')], 'full', sam)).toBe('Sam Venter')
  })

  it('shows the first initial and the whole surname in initials mode, whatever the view holds', () => {
    const view = [p('Sam', 'Venter'), p('Sam', 'Botha'), p('Thabo', 'Naidoo')]
    expect(label(view, view[0])).toBe('S. Venter')
    expect(label(view, view[1])).toBe('S. Botha')
    expect(label([view[2]], view[2])).toBe('T. Naidoo')
  })

  it('keeps particle surnames whole', () => {
    expect(label([], p('Sam', 'van der Westhuizen'))).toBe('S. van der Westhuizen')
    expect(label([], p('Sam', 'de Villiers'))).toBe('S. de Villiers')
  })

  it('uses only the first letter of a double or hyphenated first name', () => {
    expect(label([], p('Jan-Willem', 'Smith'))).toBe('J. Smith')
  })

  it('handles non-Latin names', () => {
    expect(label([], p('Zoë', 'Ångström'))).toBe('Z. Ångström')
    expect(label([], p('明', '王'))).toBe('明. 王')
  })

  it('splits a guest name the same way', () => {
    expect(splitName('Sam van der Westhuizen')).toEqual({ firstName: 'Sam', lastName: 'van der Westhuizen' })
    expect(splitName('  Sam   Venter ')).toEqual({ firstName: 'Sam', lastName: 'Venter' })
    const guest = { ...splitName('Sam van der Westhuizen'), id: 'g1' }
    expect(label([guest], guest)).toBe('S. van der Westhuizen')
  })

  it('shows a one-word guest as its initial', () => {
    expect(label([], { ...splitName('Sam'), id: 'g1' })).toBe('S.')
  })

  it('playerLabeler agrees with playerDisplayName', () => {
    const view = [p('Sam', 'Venter'), p('Sam', 'van der Westhuizen'), p('Thabo', 'Naidoo')]
    const labeler = playerLabeler(view, 'initials')
    for (const person of view) expect(labeler(person)).toBe(label(view, person))
    expect(playerLabeler(view, 'full')(view[1])).toBe('Sam van der Westhuizen')
  })

  it('reads a scorecard player: registered first/last, or a guest split from the typed name', () => {
    expect(scorecardPersonName({ playerProfileId: 'p1', firstName: 'Sam', lastName: 'Venter', displayName: null })).toEqual({
      id: 'p1', firstName: 'Sam', lastName: 'Venter',
    })
    expect(scorecardPersonName({ clientKey: 'k1', displayName: 'Sam van Wyk' })).toEqual({
      id: 'k1', firstName: 'Sam', lastName: 'van Wyk',
    })
  })
})
