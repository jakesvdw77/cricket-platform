import { describe, expect, it } from 'vitest'
import { splitGuestName } from './guestNameSplit'

describe('splitGuestName', () => {
  it('splits two words into first name and surname', () => {
    expect(splitGuestName('Cilliers Retief')).toEqual({ firstName: 'Cilliers', lastName: 'Retief' })
  })
  it('starts the surname at the first particle', () => {
    expect(splitGuestName('Jan van der Berg')).toEqual({ firstName: 'Jan', lastName: 'van der Berg' })
  })
  it('makes a single word the surname', () => {
    expect(splitGuestName('Madonna')).toEqual({ firstName: '', lastName: 'Madonna' })
  })
  it('keeps several first names before a particle', () => {
    expect(splitGuestName('A B de Villiers')).toEqual({ firstName: 'A B', lastName: 'de Villiers' })
  })
  it('uses the last word when there is no particle, and copes with spacing and empty input', () => {
    expect(splitGuestName('  Mary  Ann   Smith ')).toEqual({ firstName: 'Mary Ann', lastName: 'Smith' })
    expect(splitGuestName('')).toEqual({ firstName: '', lastName: '' })
    expect(splitGuestName(null)).toEqual({ firstName: '', lastName: '' })
  })
})
