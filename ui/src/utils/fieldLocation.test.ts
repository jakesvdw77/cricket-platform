import { describe, expect, it } from 'vitest'
import { copyAddressText, directionsTarget, needsTownLookup, resolveFieldLocation } from './fieldLocation'
import { appleMapsDirectionsUrl, googleMapsDirectionsUrl, isIosDevice, wazeDirectionsUrl } from './directions'
import { isShortMapLink, parseMapCoords } from './weather/mapCoords'

const GOOGLE = 'https://www.google.com/maps/place/Wanderers/@-26.1325,28.0567,17z/data=!3m1'

describe('parseMapCoords (docs/specs/133)', () => {
  it('reads @lat,lng, ?q=lat,lng and !3d!4d', () => {
    expect(parseMapCoords(GOOGLE)).toEqual({ lat: -26.1325, lng: 28.0567 })
    expect(parseMapCoords('https://maps.google.com/?q=-25.75,28.19')).toEqual({ lat: -25.75, lng: 28.19 })
    expect(parseMapCoords('https://www.google.com/maps/place/X/data=!3d-26.5!4d27.9')).toEqual({ lat: -26.5, lng: 27.9 })
  })

  it('gives null for a short link, a malformed link and an out of range pair', () => {
    expect(parseMapCoords('https://maps.app.goo.gl/abc123')).toBeNull()
    expect(parseMapCoords('https://www.google.com/maps/@north,east')).toBeNull()
    expect(parseMapCoords('https://www.google.com/maps/@95.5,28.0,17z')).toBeNull()
    expect(parseMapCoords('https://www.google.com/maps/@10,190.5,17z')).toBeNull()
    expect(parseMapCoords(null)).toBeNull()
  })

  it('recognises a short link', () => {
    expect(isShortMapLink('https://maps.app.goo.gl/abc123')).toBe(true)
    expect(isShortMapLink('https://goo.gl/maps/xyz')).toBe(true)
    expect(isShortMapLink(GOOGLE)).toBe(false)
    expect(isShortMapLink('')).toBe(false)
  })
})

describe('resolveFieldLocation', () => {
  it('goes stored, then map URL, then town, then nothing', () => {
    expect(resolveFieldLocation({ latitude: -1, longitude: 2, mapUrl: GOOGLE })).toEqual({ point: { lat: -1, lng: 2 }, source: 'STORED' })
    expect(resolveFieldLocation({ mapUrl: GOOGLE })).toEqual({ point: { lat: -26.1325, lng: 28.0567 }, source: 'MAP_URL' })
    expect(resolveFieldLocation({ mapUrl: 'https://maps.app.goo.gl/x' }, { lat: 5, lng: 6 })).toEqual({ point: { lat: 5, lng: 6 }, source: 'TOWN' })
    expect(resolveFieldLocation({ mapUrl: 'https://maps.app.goo.gl/x' })).toEqual({ point: null, source: null })
    expect(resolveFieldLocation(null)).toEqual({ point: null, source: null })
  })

  it('a half pair is not a stored point', () => {
    expect(resolveFieldLocation({ latitude: -1, longitude: null }).point).toBeNull()
  })

  it('needs a town lookup only when nothing else resolves', () => {
    expect(needsTownLookup({ latitude: 1, longitude: 2 })).toBe(false)
    expect(needsTownLookup({ mapUrl: GOOGLE })).toBe(false)
    expect(needsTownLookup({ address: { city: 'Springs' } })).toBe(true)
  })

  it('never uses the access point', () => {
    expect(resolveFieldLocation({ accessLatitude: -26.1, accessLongitude: 28 }).point).toBeNull()
  })
})

describe('directionsTarget', () => {
  it('goes to the access point when set, even if the field has coordinates', () => {
    const target = directionsTarget({ name: 'Wanderers', latitude: -26.1, longitude: 28, accessLatitude: -26.2, accessLongitude: 28.1, accessNote: ' Use gate 2 ' })
    expect(target).toMatchObject({ point: { lat: -26.2, lng: 28.1 }, viaAccess: true, approximate: false, accessNote: 'Use gate 2' })
  })

  it('is exact for stored coordinates and approximate for a map URL or a town', () => {
    expect(directionsTarget({ name: 'A', latitude: 1, longitude: 2 })?.approximate).toBe(false)
    expect(directionsTarget({ name: 'A', mapUrl: GOOGLE })?.approximate).toBe(true)
    expect(directionsTarget({ name: 'A' }, { lat: 1, lng: 2 })?.approximate).toBe(true)
  })

  it('is null when nothing resolves', () => {
    expect(directionsTarget({ name: 'A' })).toBeNull()
    expect(directionsTarget(undefined)).toBeNull()
  })
})

describe('copyAddressText', () => {
  it('lists the name, the address lines and the access note', () => {
    expect(
      copyAddressText({ name: 'Wanderers', address: { number: '21', street: 'Corlett Dr', city: 'Johannesburg', provinceState: 'Gauteng', postalCode: '2196', country: 'South Africa' }, accessNote: 'Use gate 2 off Main Rd' }),
    ).toBe('Wanderers\n21 Corlett Dr\nJohannesburg, Gauteng 2196\nSouth Africa\nAccess: Use gate 2 off Main Rd')
  })

  it('leaves out what is missing', () => {
    expect(copyAddressText({ name: 'Wanderers' })).toBe('Wanderers')
  })
})

describe('directions urls', () => {
  it('has the exact shapes, with negative numbers', () => {
    const point = { lat: -26.1325, lng: -28.0567 }
    expect(googleMapsDirectionsUrl(point)).toBe('https://www.google.com/maps/dir/?api=1&destination=-26.1325,-28.0567')
    expect(appleMapsDirectionsUrl(point)).toBe('https://maps.apple.com/?daddr=-26.1325,-28.0567')
    expect(wazeDirectionsUrl(point)).toBe('https://waze.com/ul?ll=-26.1325,-28.0567&navigate=yes')
  })

  it('offers Apple Maps on iPhone and iPad only', () => {
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', platform: 'iPhone', maxTouchPoints: 5 })).toBe(true)
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true)
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false)
    expect(isIosDevice({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false)
  })
})
