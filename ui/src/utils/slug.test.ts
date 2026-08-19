import { describe, expect, it } from 'vitest'
import { deriveSlug, validateSlug } from './slug'

describe('deriveSlug', () => {
  it('lowercases, hyphenates, and trims a name into a slug shape', () => {
    expect(deriveSlug('Riverside Cricket Club!')).toBe('riverside-cricket-club')
  })

  it('returns an empty string for a blank name', () => {
    expect(deriveSlug('   ')).toBe('')
  })
})

describe('validateSlug', () => {
  it('requires a non-blank slug', () => {
    expect(validateSlug('')).toBe('Slug is required')
    expect(validateSlug('   ')).toBe('Slug is required')
  })

  it('rejects a too-short or too-long slug', () => {
    expect(validateSlug('ab')).toBe('Slug must be between 3 and 63 characters')
    expect(validateSlug('a'.repeat(64))).toBe('Slug must be between 3 and 63 characters')
  })

  it('rejects a slug that does not match the lowercase-hyphenated shape', () => {
    expect(validateSlug('Riverside CC')).toBe('Use lowercase letters, numbers, and single hyphens, e.g. riverside-cc')
  })

  it('accepts a valid slug', () => {
    expect(validateSlug('riverside-cc')).toBeUndefined()
  })
})
