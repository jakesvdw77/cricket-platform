import { describe, expect, it } from 'vitest'
import { parseMapCoords, placeFromAddress, placeKey } from './mapCoords'
import { describeWeatherCode, summariseForecast } from './wmo'
import { daysUntil, inForecastRange, localDateIso } from './forecastWindow'

describe('parseMapCoords', () => {
  it('reads @lat,lng', () => {
    expect(parseMapCoords('https://www.google.com/maps/place/Park/@-25.7461,28.1881,17z/data=x')).toEqual({ lat: -25.7461, lng: 28.1881 })
  })
  it('reads !3d!4d', () => {
    expect(parseMapCoords('https://www.google.com/maps/place/x/data=!3d-25.5!4d28.25')).toEqual({ lat: -25.5, lng: 28.25 })
  })
  it('reads q=lat,lng', () => {
    expect(parseMapCoords('https://maps.google.com/?q=-26.2,28.04')).toEqual({ lat: -26.2, lng: 28.04 })
  })
  it('gives null for a short link, a missing or a malformed url', () => {
    expect(parseMapCoords('https://maps.app.goo.gl/AbCdEf')).toBeNull()
    expect(parseMapCoords(null)).toBeNull()
    expect(parseMapCoords('https://x.test/@abc,def')).toBeNull()
    expect(parseMapCoords('https://x.test/@95.0,28.1')).toBeNull()
  })
})

describe('placeFromAddress', () => {
  it('needs a city and reads the country code', () => {
    expect(placeFromAddress({ city: ' Pretoria ', provinceState: 'Gauteng', country: 'za' })).toEqual({ city: 'Pretoria', provinceState: 'Gauteng', countryCode: 'ZA' })
    expect(placeFromAddress({ city: null, provinceState: 'Gauteng', country: 'ZA' })).toBeNull()
    expect(placeFromAddress({ city: 'Irene', provinceState: null, country: 'South Africa' })?.countryCode).toBeNull()
    expect(placeKey({ city: 'Pretoria', provinceState: 'Gauteng', countryCode: 'ZA' })).toBe('pretoria, gauteng, za')
  })
})

describe('weather words', () => {
  it('maps every code group to a label and icon', () => {
    const groups: [number, string, string][] = [
      [0, 'Sunny', 'sunny'], [1, 'Mostly sunny', 'sunny'], [2, 'Partly cloudy', 'partly'], [3, 'Cloudy', 'cloudy'], [45, 'Fog', 'fog'],
      [53, 'Drizzle', 'rain'], [63, 'Rain', 'rain'], [73, 'Snow', 'snow'], [81, 'Showers', 'rain'], [86, 'Snow showers', 'snow'], [96, 'Thunderstorms', 'storm'], [10, 'Mixed weather', 'cloudy'],
    ]
    for (const [code, label, icon] of groups) expect(describeWeatherCode(code)).toEqual({ label, icon })
  })
  it('builds the sentence', () => {
    const summary = summariseForecast({ date: 'd', code: 1, tempMax: 26.6, tempMin: 14.4, rainChance: 20 })
    expect(summary.text).toBe('Mostly sunny, 14 to 27 degrees, 20% rain')
    expect(summariseForecast({ date: 'd', code: 0, tempMax: 20, tempMin: 10, rainChance: null }).text).toBe('Sunny, 10 to 20 degrees')
  })
})

describe('forecast window', () => {
  const now = new Date(2026, 10, 3, 12, 0)
  it('counts calendar days', () => {
    expect(daysUntil('2026-11-06T09:15:00', now)).toBe(3)
    expect(daysUntil('2026-11-03T18:00:00', now)).toBe(0)
    expect(daysUntil('2026-11-02T18:00:00', now)).toBe(-1)
    expect(localDateIso(new Date(2026, 10, 6, 9, 15))).toBe('2026-11-06')
  })
  it('is in range for today to six days ahead only', () => {
    expect(inForecastRange('2026-11-03T08:00:00', now)).toBe(true)
    expect(inForecastRange('2026-11-09T08:00:00', now)).toBe(true)
    expect(inForecastRange('2026-11-10T08:00:00', now)).toBe(false)
    expect(inForecastRange('2026-11-02T08:00:00', now)).toBe(false)
    expect(inForecastRange('not a date', now)).toBe(false)
  })
})
