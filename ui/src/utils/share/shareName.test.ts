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
