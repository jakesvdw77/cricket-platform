import { describe, expect, it } from 'vitest'
import { guestPersonName, initialsCollisions, shareName } from './shareName'

const person = (firstName: string, lastName: string, id?: string) => ({ firstName, lastName, id })

describe('shareName', () => {
  it('writes initial plus surname when off and two initials when on', () => {
    expect(shareName(person('Mpho', 'Naidoo'), false)).toBe('M. Naidoo')
    expect(shareName(person('Mpho', 'Naidoo'), true)).toBe('M. N.')
  })

  it('keeps particles when off and drops them from the initial when on', () => {
    expect(shareName(person('Sam', 'van der Westhuizen'), false)).toBe('S. van der Westhuizen')
    expect(shareName(person('Sam', 'van der Westhuizen'), true)).toBe('S. W.')
  })

  it('uses the first letter only of a double or hyphenated first name', () => {
    expect(shareName(person('Jean-Marc', 'Smith'), true)).toBe('J. S.')
    expect(shareName(person('Mary Jane', 'Smith'), false)).toBe('M. Smith')
  })

  it('handles accents and an empty name', () => {
    expect(shareName(person('émile', 'Öztürk'), true)).toBe('É. Ö.')
    expect(shareName(person('', ''), true)).toBe('')
  })

  it('treats a one-word guest as S. on and as typed off', () => {
    const guest = guestPersonName('Sipho')
    expect(shareName(guest, true)).toBe('S.')
    expect(shareName(guest, false)).toBe('Sipho')
  })

  it('gives a guest and a registered player the same result', () => {
    const guest = guestPersonName('Sam van der Westhuizen')
    expect(shareName(guest, true)).toBe('S. W.')
    expect(shareName(guest, false)).toBe('S. van der Westhuizen')
  })
})

describe('initialsCollisions', () => {
  it('reports initials shared by two different players only', () => {
    const people = [person('Sam', 'Khan', 'a'), person('Sara', 'Kruger', 'b'), person('Sam', 'Khan', 'a'), person('Tim', 'Ng', 'c')]
    expect(initialsCollisions(people)).toEqual(['S. K.'])
  })

  it('reports nothing when initials are all different', () => {
    expect(initialsCollisions([person('Sam', 'Khan', 'a'), person('Tim', 'Ng', 'b')])).toEqual([])
  })
})
