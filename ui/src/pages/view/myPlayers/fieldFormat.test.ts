import { describe, expect, it } from 'vitest'
import type { FieldDto } from '../../../api/myPlayersApi'
import { isHttpsUrl, joinAddress, matchesSearch } from './fieldFormat'

const field: FieldDto = {
  id: '1', name: 'Oval Ground', owner: 'City Council', addressLine1: '1 Main Rd', city: 'Paarl', provinceState: 'Western Cape',
  postalCode: null, country: 'ZA', mapUrl: null, verified: true, home: true,
}

describe('fieldFormat', () => {
  it('accepts only https urls', () => {
    expect(isHttpsUrl('https://maps.example/x')).toBe(true)
    expect(isHttpsUrl('http://maps.example/x')).toBe(false)
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpsUrl('data:text/html,hi')).toBe(false)
    expect(isHttpsUrl('not a url')).toBe(false)
    expect(isHttpsUrl(null)).toBe(false)
  })
  it('joins the address and skips empty parts', () => {
    expect(joinAddress(field)).toBe('1 Main Rd, Paarl, Western Cape, South Africa')
    expect(joinAddress({ ...field, addressLine1: null, provinceState: ' ' })).toBe('Paarl, South Africa')
  })
  it('searches name, address and owner case-insensitively', () => {
    expect(matchesSearch(field, 'oval')).toBe(true)
    expect(matchesSearch(field, 'PAARL')).toBe(true)
    expect(matchesSearch(field, 'council')).toBe(true)
    expect(matchesSearch(field, 'nowhere')).toBe(false)
    expect(matchesSearch(field, '  ')).toBe(true)
  })
})
