import { describe, expect, it } from 'vitest'
import {
  duplicateFieldId,
  effectiveOwnerType,
  emptyFieldForm,
  fieldFormFromField,
  fieldFormToPayload,
  validateFieldForm,
  validateMapUrl,
} from './fieldForm'
import type { FieldFormValues } from './fieldForm'
import { makeField } from '../test/fieldFixtures'
import { problem } from '../test/publicAvailabilityTestUtils'

function valid(overrides: Partial<FieldFormValues> = {}): FieldFormValues {
  const base = emptyFieldForm('ZA')
  return { ...base, name: 'Riverside Oval', ownerName: 'Riverside CC', address: { ...base.address, city: 'Hilton' }, ...overrides }
}

describe('fieldForm validation', () => {
  it('accepts a field with a name, owner, city and country and no street, province, map link or notes', () => {
    expect(validateFieldForm(valid())).toEqual({})
  })

  it('requires name, owner, city and country, but not street', () => {
    const errors = validateFieldForm(emptyFieldForm(''))
    expect(errors).toMatchObject({
      name: 'Name is required',
      ownerName: 'Owner is required',
      city: 'City is required',
      country: 'Country is required',
    })
    expect(errors.street).toBeUndefined()
  })

  it('treats a blank-only city or name as missing', () => {
    const base = valid()
    const errors = validateFieldForm({ ...base, name: '   ', address: { ...base.address, city: '  ' } })
    expect(errors.name).toBe('Name is required')
    expect(errors.city).toBe('City is required')
  })

  it('refuses a name over 200 characters and notes over 500', () => {
    expect(validateFieldForm(valid({ name: 'x'.repeat(201) })).name).toMatch(/200/)
    expect(validateFieldForm(valid({ locationNotes: 'x'.repeat(501) })).locationNotes).toMatch(/500/)
  })

  describe('map link', () => {
    it('is optional', () => {
      expect(validateMapUrl('')).toBeNull()
      expect(validateMapUrl('   ')).toBeNull()
    })
    it('accepts https only', () => {
      expect(validateMapUrl('https://maps.app.goo.gl/abc')).toBeNull()
      expect(validateMapUrl('http://maps.example.com')).toMatch(/https/)
      expect(validateMapUrl('javascript:alert(1)')).toMatch(/https/)
      expect(validateMapUrl('data:text/html,hi')).toMatch(/https/)
      expect(validateMapUrl('not a link')).toMatch(/https/)
    })
    it('refuses one over 500 characters', () => {
      expect(validateMapUrl(`https://example.com/${'a'.repeat(500)}`)).toMatch(/500/)
    })
    it('is reported on the form', () => {
      expect(validateFieldForm(valid({ mapUrl: 'http://x.test' })).mapUrl).toBeDefined()
    })
  })
})

describe('fieldForm payload', () => {
  it('trims text and sends empty optional parts as null', () => {
    const payload = fieldFormToPayload(valid({ name: '  Riverside Oval ', mapUrl: '', locationNotes: '  ' }))
    expect(payload.name).toBe('Riverside Oval')
    expect(payload.mapUrl).toBeNull()
    expect(payload.locationNotes).toBeNull()
    expect(payload.address).toEqual({ number: null, street: null, city: 'Hilton', provinceState: null, country: 'ZA', postalCode: null })
  })

  it('derives the owner type from the Type until the manager chooses one', () => {
    expect(effectiveOwnerType({ category: 'SCHOOL', ownerType: null })).toBe('SCHOOL')
    expect(effectiveOwnerType({ category: 'PROVINCIAL', ownerType: null })).toBe('PROVINCE')
    expect(effectiveOwnerType({ category: 'ACADEMY', ownerType: null })).toBe('OTHER')
    expect(effectiveOwnerType({ category: 'SCHOOL', ownerType: 'CLUB' })).toBe('CLUB')
    expect(fieldFormToPayload(valid({ category: 'MUNICIPAL' })).ownerType).toBe('OTHER')
  })

  it('round-trips an existing field into form values', () => {
    const field = makeField({ address: { number: null, street: null, city: 'Hilton', provinceState: null, country: 'ZA', postalCode: null }, mapUrl: null })
    const values = fieldFormFromField(field)
    expect(values.address.street).toBe('')
    expect(values.mapUrl).toBe('')
    expect(values.ownerType).toBe('CLUB')
  })
})

describe('duplicateFieldId', () => {
  it('returns the existing field id from a 409 problem', () => {
    expect(duplicateFieldId(problem(409, { existingPlayingAreaId: 'field-9' }))).toBe('field-9')
  })
  it('is null for another status, a 409 without the property, or a non-error', () => {
    expect(duplicateFieldId(problem(500, { existingPlayingAreaId: 'field-9' }))).toBeNull()
    expect(duplicateFieldId(problem(409, {}))).toBeNull()
    expect(duplicateFieldId(new Error('boom'))).toBeNull()
    expect(duplicateFieldId(undefined)).toBeNull()
  })
})
