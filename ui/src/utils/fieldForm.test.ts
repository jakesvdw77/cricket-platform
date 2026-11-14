import { describe, expect, it } from 'vitest'
import {
  duplicateFieldForm,
  duplicateFieldId,
  effectiveOwnerType,
  emptyFieldForm,
  fieldFormFromField,
  fieldFormToPayload,
  nextFieldName,
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

// docs/specs/133
describe('coordinates and the access point', () => {
  const base = (patch: Partial<FieldFormValues> = {}): FieldFormValues => ({
    ...emptyFieldForm('ZA'),
    name: 'Wanderers',
    ownerName: 'Club',
    address: { number: null, street: '', city: 'Johannesburg', provinceState: '', country: 'ZA', postalCode: '' },
    ...patch,
  })

  it('accepts none, a full pair, and the boundaries 90 and 180', () => {
    expect(validateFieldForm(base())).toEqual({})
    expect(validateFieldForm(base({ latitude: '-26.1325', longitude: '28.0567' }))).toEqual({})
    expect(validateFieldForm(base({ latitude: '90', longitude: '-180' }))).toEqual({})
  })

  it('refuses a number out of range or text', () => {
    expect(validateFieldForm(base({ latitude: '90.1', longitude: '10' })).latitude).toMatch(/between -90 and 90/)
    expect(validateFieldForm(base({ latitude: '10', longitude: '181' })).longitude).toMatch(/between -180 and 180/)
    expect(validateFieldForm(base({ latitude: 'north', longitude: '10' })).latitude).toMatch(/Enter a number/)
  })

  it('wants both or neither, with the error on the missing half', () => {
    expect(validateFieldForm(base({ latitude: '10' })).longitude).toMatch(/longitude too/)
    expect(validateFieldForm(base({ longitude: '10' })).latitude).toMatch(/latitude too/)
    expect(validateFieldForm(base({ accessLatitude: '10' })).accessLongitude).toMatch(/longitude too/)
  })

  it('allows an access note only with an access pair, at most 200 characters', () => {
    expect(validateFieldForm(base({ accessNote: 'Gate 2' })).accessNote).toMatch(/position/)
    expect(validateFieldForm(base({ accessLatitude: '1', accessLongitude: '2', accessNote: 'Gate 2' }))).toEqual({})
    expect(validateFieldForm(base({ accessLatitude: '1', accessLongitude: '2', accessNote: 'x'.repeat(201) })).accessNote).toMatch(/200/)
  })

  it('sends numbers, or null for what is empty', () => {
    const payload = fieldFormToPayload(base({ latitude: ' -26.1325 ', longitude: '28.0567', accessNote: '' }))
    expect(payload).toMatchObject({ latitude: -26.1325, longitude: 28.0567, accessLatitude: null, accessLongitude: null, accessNote: null })
  })

  it('loads a stored field into the inputs and back', () => {
    const values = fieldFormFromField(makeField({ latitude: -26.1325, longitude: 28.0567, accessLatitude: -26.2, accessLongitude: 28.1, accessNote: 'Gate 2' }))
    expect(values).toMatchObject({ latitude: '-26.1325', longitude: '28.0567', accessLatitude: '-26.2', accessLongitude: '28.1', accessNote: 'Gate 2' })
    expect(fieldFormToPayload(values)).toMatchObject({ latitude: -26.1325, accessLongitude: 28.1, accessNote: 'Gate 2' })
  })
})

// docs/specs/151, slice C
describe('nextFieldName', () => {
  it.each([
    ['Oval A', 'Oval B'],
    ['Carltonville CC (A)', 'Carltonville CC (B)'],
    ['Carltonville CC (Y)', 'Carltonville CC (Z)'],
    ['Hilton College', 'Hilton College B'],
    ['Oval Z', 'Oval Z B'],
    ['  Riverside Oval  ', 'Riverside Oval B'],
    ['A', 'A B'],
  ])('moves "%s" on to "%s"', (name, expected) => {
    expect(nextFieldName(name)).toBe(expected)
  })
})

describe('duplicateFieldForm', () => {
  it('copies everything of a field and moves only the name on', () => {
    const field = makeField({ name: 'Irene Oval A', contactName: 'Sam Smith', contactPhone: '082 555 0100', photoUrl: '/media/oval.jpg', locationNotes: 'Gate B' })

    const form = duplicateFieldForm(field)

    expect(form.name).toBe('Irene Oval B')
    expect(form.ownerName).toBe(field.ownerName)
    expect(form.address).toEqual(expect.objectContaining({ street: 'River Road', city: 'Hilton', country: 'ZA' }))
    expect(form.mapUrl).toBe(field.mapUrl)
    expect(form.locationNotes).toBe('Gate B')
    expect(form.contactName).toBe('Sam Smith')
    expect(form.contactPhone).toBe('082 555 0100')
    expect(form.photoUrl).toBe('/media/oval.jpg')
  })
})

describe('field contact and photo', () => {
  it('starts empty, is read from a field and goes into the payload trimmed, with blanks as null', () => {
    expect(emptyFieldForm('ZA')).toEqual(expect.objectContaining({ contactName: '', contactPhone: '', photoUrl: '' }))
    expect(fieldFormFromField(makeField({ contactName: 'Sam', contactPhone: '082', photoUrl: '/p.jpg' }))).toEqual(
      expect.objectContaining({ contactName: 'Sam', contactPhone: '082', photoUrl: '/p.jpg' }),
    )
    expect(fieldFormFromField(makeField())).toEqual(expect.objectContaining({ contactName: '', contactPhone: '', photoUrl: '' }))

    expect(fieldFormToPayload(valid({ contactName: '  Sam Smith ', contactPhone: ' 082 555 0100 ', photoUrl: ' /p.jpg ' }))).toEqual(
      expect.objectContaining({ contactName: 'Sam Smith', contactPhone: '082 555 0100', photoUrl: '/p.jpg' }),
    )
    expect(fieldFormToPayload(valid({ contactName: '  ', contactPhone: '', photoUrl: '' }))).toEqual(
      expect.objectContaining({ contactName: null, contactPhone: null, photoUrl: null }),
    )
  })

  it('refuses a contact person over 100 characters and a number over 30', () => {
    expect(validateFieldForm(valid({ contactName: 'x'.repeat(101) })).contactName).toBe('Contact person must be 100 characters or fewer')
    expect(validateFieldForm(valid({ contactPhone: '9'.repeat(31) })).contactPhone).toBe('Contact number must be 30 characters or fewer')
    expect(validateFieldForm(valid({ contactName: 'x'.repeat(100), contactPhone: '9'.repeat(30) }))).toEqual({})
  })
})
