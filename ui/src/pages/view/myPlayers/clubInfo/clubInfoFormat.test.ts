import { describe, expect, it } from 'vitest'
import { addressLines, emailHref, letterOf, logoFileName, mapsUrl, phoneHref } from './clubInfoFormat'

// docs/specs/148: the pure helpers behind the Call, Email, Open In Maps and Download links.
describe('phoneHref', () => {
  it('drops spaces, dashes, dots and brackets and keeps a leading +', () => {
    expect(phoneHref('082 555 0100')).toBe('tel:0825550100')
    expect(phoneHref('+27 (0)31-555.0100')).toBe('tel:+270315550100')
  })

  it('gives null for letters, an empty value, a misplaced plus or nothing', () => {
    expect(phoneHref('call 0825550100')).toBeNull()
    expect(phoneHref('082 CRICKET')).toBeNull()
    expect(phoneHref('   ')).toBeNull()
    expect(phoneHref(null)).toBeNull()
    expect(phoneHref(undefined)).toBeNull()
    expect(phoneHref('082+555')).toBeNull()
  })
})

describe('emailHref', () => {
  it('builds a mailto link for a plain address and trims it', () => {
    expect(emailHref(' a@b.co ')).toBe('mailto:a@b.co')
  })

  it('rejects anything that is not one plain address', () => {
    for (const bad of ['', 'nope', 'a@b', 'a b@c.com', 'a@b.com, c@d.com', '<a@b.com>', null, undefined]) expect(emailHref(bad)).toBeNull()
  })
})

describe('addressLines and mapsUrl', () => {
  it('lays the address out as street; city, province postal code; country', () => {
    expect(addressLines({ number: '12', street: 'Oval Road', city: 'Durban', provinceState: 'KZN', country: 'South Africa', postalCode: '4001' })).toEqual(['12 Oval Road', 'Durban, KZN 4001', 'South Africa'])
  })

  it('leaves out the lines that have no value, and gives none for a missing address', () => {
    expect(addressLines({ number: null, street: null, city: 'Durban', provinceState: null, country: null, postalCode: null })).toEqual(['Durban'])
    expect(addressLines(null)).toEqual([])
    expect(addressLines(undefined)).toEqual([])
  })

  it('builds the maps search from the address text only, encoded, and nothing when there is none', () => {
    expect(mapsUrl(['12 Oval Road', 'Durban, KZN 4001'])).toBe('https://www.google.com/maps/search/?api=1&query=12%20Oval%20Road%2C%20Durban%2C%20KZN%204001')
    expect(mapsUrl([])).toBeNull()
    expect(mapsUrl(['  ', ''])).toBeNull()
  })
})

describe('letterOf', () => {
  it('gives the upper case first letter A to Z and # for anything else', () => {
    expect(letterOf('khan')).toBe('K')
    expect(letterOf('  van Wyk')).toBe('V')
    expect(letterOf('9lives')).toBe('#')
    expect(letterOf('Édith')).toBe('#')
    expect(letterOf('')).toBe('#')
    expect(letterOf(null)).toBe('#')
  })
})

describe('logoFileName', () => {
  it('is the club slug, the kind and the stored extension', () => {
    expect(logoFileName('Riverside CC', 'logo', 'https://cdn.example/a/b.PNG?v=2')).toBe('riverside-cc-logo.png')
    expect(logoFileName('Riverside CC', 'banner', 'https://cdn.example/banner.jpeg#x')).toBe('riverside-cc-banner.jpeg')
  })

  it('falls back to png when the url has no extension, and to club when the name has no letters', () => {
    expect(logoFileName('Riverside CC', 'logo', 'https://cdn.example/logo')).toBe('riverside-cc-logo.png')
    expect(logoFileName('!!!', 'logo', 'https://cdn.example/x.gif')).toBe('club-logo.gif')
  })

  it('strips accents from the club name', () => {
    expect(logoFileName('Café Cricket', 'logo', 'x.png')).toBe('cafe-cricket-logo.png')
  })
})
