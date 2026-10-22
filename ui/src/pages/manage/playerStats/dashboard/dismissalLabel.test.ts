import { describe, expect, it } from 'vitest'
import { dismissalLabel } from './dismissalLabel'

describe('dismissalLabel', () => {
  it('turns a stored type into its words, passes an unknown one through, and a dash for none', () => {
    expect(dismissalLabel('CAUGHT')).toBe('Caught')
    expect(dismissalLabel('SOMETHING_NEW')).toBe('SOMETHING_NEW')
    expect(dismissalLabel(null)).toBe('–')
  })
})
