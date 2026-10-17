import { describe, expect, it } from 'vitest'
import { guestPersonName, initialsCollisions, shareName } from './shareName'

const person = (firstName: string, lastName: string, id?: string) => ({ firstName, lastName, id })

describe('shareName', () => {
  it('writes the full name when off and first initial plus surname when on', () => {
    expect(shareName(person('Mpho', 'Naidoo'), false)).toBe('Mpho Naidoo')
    expect(shareName(person('Mpho', 'Naidoo'), true)).toBe('M. Naidoo')
  })

  it('keeps particles in the surname both ways', () => {
    expect(shareName(person('Sam', 'van der Westhuizen'), false)).toBe('Sam van der Westhuizen')
    expect(shareName(person('Sam', 'van der Westhuizen'), true)).toBe('S. van der Westhuizen')
  })

  it('uses the first letter only of a double or hyphenated first name when on', () => {
    expect(shareName(person('Jean-Marc', 'Smith'), true)).toBe('J. Smith')
    expect(shareName(person('Mary Jane', 'Smith'), true)).toBe('M. Smith')
    expect(shareName(person('Mary Jane', 'Smith'), false)).toBe('Mary Jane Smith')
  })

  it('handles accents and an empty name', () => {
    expect(shareName(person('émile', 'Öztürk'), true)).toBe('É. Öztürk')
    expect(shareName(person('', ''), true)).toBe('')
  })

  it('treats a one-word guest as S. on and as typed off', () => {
    const guest = guestPersonName('Sipho')
    expect(shareName(guest, true)).toBe('S.')
    expect(shareName(guest, false)).toBe('Sipho')
  })

  it('gives a guest and a registered player the same result', () => {
    const guest = guestPersonName('Sam van der Westhuizen')
    expect(shareName(guest, true)).toBe('S. van der Westhuizen')
    expect(shareName(guest, false)).toBe('Sam van der Westhuizen')
  })
})

describe('initialsCollisions', () => {
  it('reports shared names of two different players only', () => {
    const people = [person('Sam', 'Khan', 'a'), person('Sara', 'Khan', 'b'), person('Sam', 'Khan', 'a'), person('Tim', 'Ng', 'c')]
    expect(initialsCollisions(people)).toEqual(['S. Khan'])
  })

  it('reports nothing when the shared names are all different', () => {
    expect(initialsCollisions([person('Sam', 'Khan', 'a'), person('Tim', 'Ng', 'b')])).toEqual([])
  })
})

describe('shareName edge cases', () => {
  it('shortens only the first name(s), whatever the shape of the surname', () => {
    const cases: [string, string, string, string][] = [
      ['Mpho', 'Naidoo', 'Mpho Naidoo', 'M. Naidoo'],
      ['Sam', 'van der Westhuizen', 'Sam van der Westhuizen', 'S. van der Westhuizen'],
      ['Anna', "O'Brien", "Anna O'Brien", "A. O'Brien"],
      ['Jean-Marc', 'de Villiers', 'Jean-Marc de Villiers', 'J. de Villiers'],
      ['Mary Jane', 'Smith-Jones', 'Mary Jane Smith-Jones', 'M. Smith-Jones'],
    ]
    for (const [first, last, off, on] of cases) {
      expect(shareName(person(first, last), false)).toBe(off)
      expect(shareName(person(first, last), true)).toBe(on)
    }
  })

  it('never shows the second given name of a double first name when on', () => {
    expect(shareName(person('Mary Jane', 'Smith'), true)).not.toContain('Jane')
    expect(shareName(person('Jean-Marc', 'Smith'), true)).not.toContain('Marc')
  })

  it('keeps accents and upper-cases an accented lower-case initial', () => {
    expect(shareName(person('Zoë', 'Müller'), false)).toBe('Zoë Müller')
    expect(shareName(person('Zoë', 'Müller'), true)).toBe('Z. Müller')
    expect(shareName(person('émile', 'Zola'), true)).toBe('É. Zola')
    expect(shareName(person('Ørjan', 'Berg'), true)).toBe('Ø. Berg')
  })

  it('skips leading punctuation when finding the initial', () => {
    expect(shareName(person("'Tumi", 'Dlamini'), true)).toBe('T. Dlamini')
  })

  it('trims and collapses stray spaces, and tolerates null parts', () => {
    expect(shareName(person('  Mpho ', ' Naidoo  '), false)).toBe('Mpho Naidoo')
    expect(shareName(person('Mary   Jane', 'Smith'), false)).toBe('Mary Jane Smith')
    expect(shareName({ firstName: null, lastName: null } as never, true)).toBe('')
    expect(shareName({} as never, false)).toBe('')
  })

  it('treats an empty first name as a one-word name', () => {
    expect(shareName(person('', 'Naidoo'), false)).toBe('Naidoo')
    expect(shareName(person('', 'Naidoo'), true)).toBe('N.')
    expect(shareName(person('Mpho', ''), true)).toBe('M.')
  })

  it('gives a registered player and a guest of the same name identical results, particles and all', () => {
    for (const [first, last] of [
      ['Mpho', 'Naidoo'],
      ['Sam', 'van der Westhuizen'],
      ['Jean-Marc', 'de Villiers'],
      ['Mary Jane', 'Smith'],
    ]) {
      const registered = person(first, last, 'r1')
      const guest = guestPersonName(`${first} ${last}`, 'g1')
      for (const initialsOnly of [false, true]) {
        expect(shareName(guest, initialsOnly)).toBe(shareName(registered, initialsOnly))
      }
    }
  })

  it('carries the id through guestPersonName and splits a blank or missing name to nothing', () => {
    expect(guestPersonName('Sipho Dlamini', 'g9')).toEqual({ id: 'g9', firstName: 'Sipho', lastName: 'Dlamini' })
    expect(shareName(guestPersonName(null), true)).toBe('')
    expect(shareName(guestPersonName('   '), false)).toBe('')
  })

  it('returns the same result every time for the same input (pure)', () => {
    const subject = person('Mpho', 'Naidoo')
    expect(shareName(subject, true)).toBe(shareName(subject, true))
    expect(subject).toEqual({ firstName: 'Mpho', lastName: 'Naidoo', id: undefined })
  })
})

describe('initialsCollisions edge cases', () => {
  it('reports each shared name once, in order of first appearance', () => {
    const people = [
      person('Mpho', 'Naidoo', 'a'),
      person('Mandla', 'Naidoo', 'b'),
      person('Sam', 'Khan', 'c'),
      person('Sara', 'Khan', 'd'),
      person('Mpho', 'Naidoo', 'a'),
      person('Maria', 'Naidoo', 'e'),
    ]
    expect(initialsCollisions(people)).toEqual(['M. Naidoo', 'S. Khan'])
  })

  it('tells people apart by name when they have no id, and ignores nameless people', () => {
    expect(initialsCollisions([person('Sam', 'Khan'), person('sam', 'KHAN'), person('', '')])).toEqual([])
    expect(initialsCollisions([person('Sam', 'Khan'), person('Sara', 'Khan')])).toEqual(['S. Khan'])
  })

  it('does not collide a particle surname with a plain one', () => {
    expect(initialsCollisions([person('Sam', 'van der Berg', 'a'), person('Sara', 'Berg', 'b')])).toEqual([])
  })

  it('reports nothing for an empty list', () => {
    expect(initialsCollisions([])).toEqual([])
  })
})
