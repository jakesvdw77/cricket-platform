import { describe, expect, it } from 'vitest'
import { COUNTRY_CODES, countryName, countryOptions, DEFAULT_PROVINCE_LABEL, isoFromCountryName, provinceLabel } from './countries'

describe('countries', () => {
  it('shows a country code by its English name, and an unknown or empty code as it is', () => {
    expect(countryName('ZA')).toBe('South Africa')
    expect(countryName('za')).toBe('South Africa')
    expect(countryName('')).toBe('')
    expect(countryName(null)).toBe('')
  })

  it('lists every country sorted by name', () => {
    const names = countryOptions().map((option) => option.name)
    expect(names).toHaveLength(COUNTRY_CODES.length)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
  })

  describe('isoFromCountryName', () => {
    it('keeps a valid code, maps a name and an alias, and gives empty for what it cannot tell', () => {
      expect(isoFromCountryName('ZA')).toBe('ZA')
      expect(isoFromCountryName('South Africa')).toBe('ZA')
      expect(isoFromCountryName(' south africa ')).toBe('ZA')
      expect(isoFromCountryName('UK')).toBe('GB')
      expect(isoFromCountryName('USA')).toBe('US')
      expect(isoFromCountryName('Atlantis')).toBe('')
      expect(isoFromCountryName('')).toBe('')
      expect(isoFromCountryName(undefined)).toBe('')
    })
  })

  describe('provinceLabel', () => {
    it('follows the country: Province, County, State, else the neutral label', () => {
      expect(provinceLabel('ZA')).toBe('Province')
      expect(provinceLabel('GB')).toBe('County')
      expect(provinceLabel('IE')).toBe('County')
      expect(provinceLabel('US')).toBe('State')
      expect(provinceLabel('AU')).toBe('State')
      expect(provinceLabel('IN')).toBe('State')
      expect(provinceLabel('NZ')).toBe(DEFAULT_PROVINCE_LABEL)
      expect(provinceLabel('')).toBe('Province/County/State')
      expect(provinceLabel(null)).toBe('Province/County/State')
    })
  })
})
