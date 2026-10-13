import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserDefaultCountry, countryFromLocale, countryFromTimeZone, defaultCountryCode } from './countryFromTimeZone'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('countryFromTimeZone', () => {
  it('maps a known IANA time zone to its ISO country and an unknown or missing one to empty', () => {
    expect(countryFromTimeZone('Africa/Johannesburg')).toBe('ZA')
    expect(countryFromTimeZone('Europe/London')).toBe('GB')
    expect(countryFromTimeZone('Mars/Olympus_Mons')).toBe('')
    expect(countryFromTimeZone(null)).toBe('')
  })

  it('reads the region of a locale and ignores a bare language or a bad region', () => {
    expect(countryFromLocale('en-ZA')).toBe('ZA')
    expect(countryFromLocale('en_GB')).toBe('GB')
    expect(countryFromLocale('en')).toBe('')
    expect(countryFromLocale('en-XX')).toBe('')
    expect(countryFromLocale(undefined)).toBe('')
  })

  describe('defaultCountryCode order: time zone, then locale, then club country, then empty', () => {
    it('prefers the time zone over everything', () => {
      expect(defaultCountryCode({ timeZone: 'Africa/Johannesburg', locale: 'en-US', clubCountry: 'Australia' })).toBe('ZA')
    })

    it('falls back to the locale region when the time zone is not known', () => {
      expect(defaultCountryCode({ timeZone: 'Mars/Olympus_Mons', locale: 'en-GB', clubCountry: 'Australia' })).toBe('GB')
    })

    it('falls back to the club profile country (a name) when the browser says nothing', () => {
      expect(defaultCountryCode({ timeZone: null, locale: 'en', clubCountry: 'Australia' })).toBe('AU')
    })

    it('is empty when nothing can be told', () => {
      expect(defaultCountryCode({ timeZone: null, locale: 'en', clubCountry: 'Atlantis' })).toBe('')
      expect(defaultCountryCode({})).toBe('')
    })
  })

  describe('browserDefaultCountry', () => {
    it('reads the browser time zone first', () => {
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'Australia/Perth' } as Intl.ResolvedDateTimeFormatOptions)
      vi.stubGlobal('navigator', { language: 'en-GB' })
      expect(browserDefaultCountry()).toBe('AU')
    })

    it('then the locale region', () => {
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ timeZone: 'UTC' } as Intl.ResolvedDateTimeFormatOptions)
      vi.stubGlobal('navigator', { language: 'en-NZ' })
      expect(browserDefaultCountry()).toBe('NZ')
    })

    it('then the club country, and survives an Intl that throws', () => {
      vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(() => {
        throw new Error('no Intl')
      })
      vi.stubGlobal('navigator', { language: 'en' })
      expect(browserDefaultCountry('South Africa')).toBe('ZA')
      expect(browserDefaultCountry()).toBe('')
    })
  })
})
