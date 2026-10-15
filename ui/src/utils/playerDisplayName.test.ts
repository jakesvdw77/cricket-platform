import { describe, expect, it } from 'vitest'
import { playerDisplayName, playerLabeler, scorecardPersonName, splitName } from './playerDisplayName'
import type { PersonName } from './playerDisplayName'

const p = (firstName: string, lastName: string, id?: string): PersonName => ({ firstName, lastName, id })
const label = (view: PersonName[], person: PersonName) => playerDisplayName(view, 'first', person)

describe('playerDisplayName', () => {
  it('shows the full name in full mode, whatever the view holds', () => {
    const sam = p('Sam', 'Venter')
    expect(playerDisplayName([sam, p('Sam', 'Botha')], 'full', sam)).toBe('Sam Venter')
  })

  it('shows the plain first name when it is unique in the view', () => {
    const view = [p('Sam', 'Venter'), p('Thabo', 'Naidoo')]
    expect(label(view, view[0])).toBe('Sam')
    expect(label(view, view[1])).toBe('Thabo')
  })

  it('adds the first letter of the surname only where two first names collide', () => {
    const view = [p('Sam', 'Venter'), p('Sam', 'Botha'), p('Thabo', 'Naidoo')]
    expect(label(view, view[0])).toBe('Sam V')
    expect(label(view, view[1])).toBe('Sam B')
    expect(label(view, view[2])).toBe('Thabo')
  })

  it('tags a player only against the names in the same view', () => {
    const botha = p('Sam', 'Botha')
    expect(label([botha, p('Thabo', 'Naidoo')], botha)).toBe('Sam')
    expect(label([botha, p('Sam', 'Venter')], botha)).toBe('Sam B')
  })

  it('abbreviates particle surnames: initials in lower case plus the main surname letter', () => {
    const cases: Array<[string, string]> = [
      ['van der Westhuizen', 'Sam vdW'],
      ['van Wyk', 'Sam vW'],
      ['de Villiers', 'Sam dV'],
      ['Du Plessis', 'Sam dP'],
      ['von Bergen', 'Sam vB'],
      ['di Marco', 'Sam dM'],
      ['ten Doeschate', 'Sam tD'],
      ['ter Haar', 'Sam tH'],
      ['le Roux', 'Sam lR'],
    ]
    for (const [surname, expected] of cases) {
      const person = p('Sam', surname)
      expect(label([person, p('Sam', 'Zulu')], person)).toBe(expected)
    }
  })

  it('lengthens colliding tags one letter at a time', () => {
    const view = [p('Sam', 'Venter'), p('Sam', 'Vickers'), p('Sam', 'Visser'), p('Sam', 'Botha')]
    expect(label(view, view[0])).toBe('Sam Ve')
    expect(label(view, view[1])).toBe('Sam Vic')
    expect(label(view, view[2])).toBe('Sam Vis')
    expect(label(view, view[3])).toBe('Sam B')
  })

  it('lengthens a particle tag too', () => {
    const view = [p('Sam', 'van der Westhuizen'), p('Sam', 'van der Walt')]
    expect(label(view, view[0])).toBe('Sam vdWe')
    expect(label(view, view[1])).toBe('Sam vdWa')
  })

  it('falls back to the full surname when the tags can never differ', () => {
    const view = [p('Sam', 'Venter', 'a'), p('Sam', 'Venter', 'b')]
    expect(label(view, view[0])).toBe('Sam Venter')
    expect(label(view, view[1])).toBe('Sam Venter')
  })

  it('counts the same player listed twice once', () => {
    const view = [p('Sam', 'Venter', 'x'), p('Sam', 'Venter', 'x'), p('Thabo', 'Naidoo')]
    expect(label(view, view[0])).toBe('Sam')
  })

  it('handles hyphenated and non-Latin surnames', () => {
    const view = [p('Sam', 'Smith-Jones'), p('Sam', 'Botha')]
    expect(label(view, view[0])).toBe('Sam S')
    const unicode = [p('Zoë', 'Ångström'), p('Zoë', 'Östberg')]
    expect(label(unicode, unicode[0])).toBe('Zoë Å')
    const cjk = [p('明', '王'), p('明', '李')]
    expect(label(cjk, cjk[0])).toBe('明 王')
  })

  it('splits a guest name the same way and tags a guest against a registered player', () => {
    expect(splitName('Sam van der Westhuizen')).toEqual({ firstName: 'Sam', lastName: 'van der Westhuizen' })
    expect(splitName('  Sam   Venter ')).toEqual({ firstName: 'Sam', lastName: 'Venter' })
    const registered = p('Sam', 'Botha')
    const guest = { ...splitName('Sam van der Westhuizen'), id: 'g1' }
    expect(label([registered, guest], guest)).toBe('Sam vdW')
    expect(label([registered, guest], registered)).toBe('Sam B')
  })

  it('tags two guests named Sam', () => {
    const view = [{ ...splitName('Sam Venter'), id: 'g1' }, { ...splitName('Sam Botha'), id: 'g2' }]
    expect(label(view, view[0])).toBe('Sam V')
    expect(label(view, view[1])).toBe('Sam B')
  })

  it('leaves a one-word guest as typed, whatever else is in the view', () => {
    const lone = { ...splitName('Sam'), id: 'g1' }
    const registered = p('Sam', 'Venter')
    expect(label([lone, registered], lone)).toBe('Sam')
    expect(label([lone, registered], registered)).toBe('Sam V')
    const twoLone = [lone, { ...splitName('Sam'), id: 'g2' }]
    expect(label(twoLone, twoLone[0])).toBe('Sam')
  })

  it('compares first names without regard to case', () => {
    const view = [p('sam', 'Venter'), p('Sam', 'Botha')]
    expect(label(view, view[0])).toBe('sam V')
  })

  it('playerLabeler agrees with playerDisplayName', () => {
    const view = [p('Sam', 'Venter'), p('Sam', 'van der Westhuizen'), p('Thabo', 'Naidoo')]
    const labeler = playerLabeler(view, 'first')
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
